const Tom = require('test-runner').Tom
const Rewrite = require('../')
const Static = require('lws-static')
const Lws = require('lws')
const fetch = require('node-fetch')
const a = require('assert')

const tom = module.exports = new Tom('rewrite')

tom.test('simple', async function () {
  const port = 8000 + this.index
  const lws = new Lws()
  const server = lws.listen({
    port,
    stack: [ Rewrite, Static ],
    directory: 'test/fixture',
    rewrite: { from: '/two.html', to: '/one.html' }
  })
  const response = await fetch(`http://localhost:${port}/two.html`)
  const body = await response.text()
  a.strictEqual(body, 'one\n')
  server.close()
})
