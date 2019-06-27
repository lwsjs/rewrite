const Tom = require('test-runner').Tom
const Rewrite = require('../')
const Static = require('lws-static')
const Lws = require('lws')
const fetch = require('node-fetch')
const a = require('assert')

const tom = module.exports = new Tom('remote')

async function fetchHttp2 (host, path) {
  const http2 = require('http2')
  return new Promise((resolve, reject) => {
    const client = http2.connect(host, {
      rejectUnauthorized: false
    })
    client.on('error', reject)

    const req = client.request({ ':path': path })

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
})

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
})

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
})
