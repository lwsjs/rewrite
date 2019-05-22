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
    directory: 'test/fixture',
    rewrite: { from: '/json', to: 'https://jsonplaceholder.typicode.com/posts/1' }
  })
  // lws.on('verbose', console.error)
  try {
    const response = await fetch(`http://localhost:${port}/json`)
    a.strictEqual(response.status, 200)
    const body = await response.json()
    a.strictEqual(body.id, 1)
  } finally {
    server.close()
  }
})
