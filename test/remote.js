const Tom = require('test-runner').Tom
const Rewrite = require('../')
const Static = require('lws-static')
const Lws = require('lws')
const fetch = require('node-fetch')
const a = require('assert')

const tom = module.exports = new Tom('remote')

tom.test('GET', async function () {
  const port = 8100 + this.index
  const lws = new Lws()
  const server = lws.listen({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/json/:name/:id', to: 'https://jsonplaceholder.typicode.com/posts/:id' }
  })
  // lws.on('verbose', console.error)
  try {
    const response = await fetch(`http://localhost:${port}/json/lloyd/1`)
    a.strictEqual(response.status, 200)
    const body = await response.json()
    a.strictEqual(body.id, 1)
  } finally {
    server.close()
  }
})

tom.test('POST', async function () {
  const port = 8100 + this.index
  const lws = new Lws()
  const server = lws.listen({
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
    server.close()
  }
})
