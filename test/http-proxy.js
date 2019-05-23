const Tom = require('test-runner').Tom
const Rewrite = require('../')
const Static = require('lws-static')
const Lws = require('lws')
const fetch = require('node-fetch')
const a = require('assert')

const tom = module.exports = new Tom('proxy')

tom.test('CONNECT request made to proxy', async function () {
  const port = 8200 + this.index
  const lws = new Lws()
  const server = lws.listen({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/one', to: 'https://jsonplaceholder.typicode.com/posts/1' }
  })

  let proxyConnected = false
  const net = require('net')
  const proxyServer = net.createServer(function (c) {
    c.end('OK')
    proxyConnected = true
  })
  proxyServer.listen(9000)

  try {
    process.env.http_proxy = 'http://127.0.0.1:9000'
    const response = await fetch(`http://localhost:${port}/one`)
    delete process.env.http_proxy
    a.strictEqual(proxyConnected, true)
  } finally {
    server.close()
    proxyServer.close()
  }
})
