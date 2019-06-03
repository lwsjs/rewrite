const Tom = require('test-runner').Tom
const Rewrite = require('../')
const Static = require('lws-static')
const Lws = require('lws')
const fetch = require('node-fetch')
const a = require('assert')

const tom = module.exports = new Tom('local')

tom.test('simple', async function () {
  const port = 8050 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    directory: 'test/fixture',
    rewrite: { from: '/two.html', to: '/one.html' }
  })
  const response = await fetch(`http://localhost:${port}/two.html`)
  const body = await response.text()
  a.strictEqual(body, 'one\n')
  lws.server.close()
})

tom.test('wildcard parameter', async function () {
  const port = 8050 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    directory: 'test/fixture',
    rewrite: { from: '/(.*)', to: '/$1.html' }
  })
  const response = await fetch(`http://localhost:${port}/one`)
  const body = await response.text()
  a.strictEqual(body, 'one\n')
  lws.server.close()
})
