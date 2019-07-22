const Tom = require('test-runner').Tom
const Rewrite = require('../')
const Static = require('lws-static')
const Lws = require('lws')
const fetch = require('node-fetch')
const a = require('assert')

const tom = module.exports = new Tom('proxy')

tom.test('CONNECT request made to proxy', async function () {
  const port = 8200 + this.index
  const lws = Lws.create({
    port,
    stack: [ Rewrite, Static ],
    rewrite: { from: '/one', to: 'http://jsonplaceholder.typicode.com/posts/1' }
  })

  let proxyConnected = false
  const net = require('net')
  const proxyServer = net.createServer(async function (c) {
    proxyConnected = true
    c.end(`HTTP/1.1 200 Connection Established\nConnection: close\n\n`)
  })
  proxyServer.listen(9000)

  try {
    process.env.http_proxy = 'http://127.0.0.1:9000'
    await fetch(`http://localhost:${port}/one`)
    delete process.env.http_proxy
    a.strictEqual(proxyConnected, true)
  } finally {
    lws.server.close()
    proxyServer.close()
  }
})
