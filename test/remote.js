const Tom = require('test-runner').Tom
const Rewrite = require('../')
const Static = require('lws-static')
const Lws = require('lws')
const fetch = require('node-fetch')
const a = require('assert')

const tom = module.exports = new Tom('remote')

async function fetchHttp2 (host, path, reqHeaders) {
  const http2 = require('http2')
  return new Promise((resolve, reject) => {
    const client = http2.connect(host, {
      rejectUnauthorized: false
    })
    client.on('error', reject)

    const req = client.request(Object.assign({ ':path': path }, reqHeaders))

    let headers = {}
    req.on('response', (hdrs, flags) => {
      headers = hdrs
    })

    req.setEncoding('utf8')
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      client.close()
      resolve({ headers, body })
    })
    req.end()
  })
}

tom.test('GET', async function () {
  const port = 8100 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/json/:name/:id', to: 'http://jsonplaceholder.typicode.com/posts/:id' }
  })
  try {
    const response = await fetch(`http://localhost:${port}/json/lloyd/1`)
    a.strictEqual(response.status, 200)
    const body = await response.json()
    a.strictEqual(body.id, 1)
  } finally {
    lws.server.close()
  }
}, { timeout: 120000 })

tom.test('GET HTTPS', async function () {
  const port = 8100 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/json/:name/:id', to: 'https://jsonplaceholder.typicode.com/posts/:id' }
  })
  try {
    const response = await fetch(`http://localhost:${port}/json/lloyd/1`)
    a.strictEqual(response.status, 200)
    const body = await response.json()
    a.strictEqual(body.id, 1)
  } finally {
    lws.server.close()
  }
}, { timeout: 120000 })

tom.test('POST', async function () {
  const port = 8100 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/api/posts', to: 'https://jsonplaceholder.typicode.com/posts' }
  })
  try {
    const response = await fetch(`http://localhost:${port}/api/posts`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'title',
        body: 'body',
        userId: 1
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8'
      }
    })
    a.strictEqual(response.status, 201)
    const body = await response.json()
    a.strictEqual(body.title, 'title')
    a.strictEqual(body.body, 'body')
  } finally {
    lws.server.close()
  }
}, { timeout: 120000 })

tom.test('GET http2', async function () {
  const port = 8100 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/json/:name/:id', to: 'https://jsonplaceholder.typicode.com/posts/:id' },
    http2: true
  })
  try {
    const response = await fetchHttp2(`https://localhost:${port}`, '/json/lloyd/1')
    a.strictEqual(response.headers[':status'], 200)
    a.strictEqual(JSON.parse(response.body).id, 1)
  } finally {
    lws.server.close()
  }
}, { timeout: 120000 })

tom.skip('GET HTTP2 npm, transfer-encoding', async function () {
  const port = 8100 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/npm/(.*)', to: 'http://registry.npmjs.org/$1' },
    http2: true
  })
  try {
    const response = await fetchHttp2(`https://localhost:${port}`, '/npm/local-web-server', {
      'transfer-encoding': 'chunked'
    })
    a.strictEqual(response.headers[':status'], 200)
    a.strictEqual(JSON.parse(response.body).name, 'local-web-server')
  } finally {
    lws.server.close()
  }
}, { timeout: 120000 })

tom.test('target host does not exist', async function () {
  const port = 8100 + this.index
  const lws = Lws.create({
    port,
    stack: [ require('lws-err-detail'), Rewrite, Static ],
    rewrite: { from: '/', to: 'http://a.broken.target.net' }
  })
  try {
    const response = await fetch(`http://localhost:${port}/`)
    a.strictEqual(response.status, 500)
    const body = await response.text()
    a.ok(/Error: connect/.test(body))
  } finally {
    lws.server.close()
  }
}, { timeout: 120000 })

tom.test('404 GET', async function () {
  const port = 8100 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/(.*)', to: 'http://jsonplaceholder.typicode.com/$1' }
  })
  try {
    const response = await fetch(`http://localhost:${port}/broken`)
    a.strictEqual(response.status, 404)
  } finally {
    lws.server.close()
  }
}, { timeout: 120000 })

tom.test('server connection reset', async function () {
  const net = require('net')
  const remoteServer = net.createServer(socket => {
    socket.end()
  })
  remoteServer.listen({ port: 10010 })

  const port = 8100 + this.index
  const lws = Lws.create({
    port,
    stack: [ require('lws-err-detail'), Rewrite, Static ],
    rewrite: { from: '/(.*)', to: 'http://localhost:10010/$1' }
  })
  try {
    const response = await fetch(`http://localhost:${port}/package.json`)
    a.strictEqual(response.status, 500)
    const body = await response.text()
    a.ok(/socket hang up/.test(body))
  } finally {
    lws.server.close()
    remoteServer.close()
  }
}, { timeout: 120000 })

tom.test('GET HTTPS, self-signed', async function () {
  const remoteLws = Lws.create({
    port: 10000,
    https: true,
    stack: [ Static ]
  })

  const port = 8100 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/(.*)', to: 'https://localhost:10000/$1' }
  })
  try {
    const response = await fetch(`http://localhost:${port}/package.json`)
    a.strictEqual(response.status, 200)
    const body = await response.json()
    a.strictEqual(body.name, 'lws-rewrite')
  } finally {
    lws.server.close()
    remoteLws.server.close()
  }
}, { timeout: 120000 })
