import { strict as a } from 'assert'
import TestRunner from 'test-runner'
import Rewrite from 'lws-rewrite'
import Static from 'lws-static'
import Lws from 'lws'
import WebSocket, { WebSocketServer } from 'ws'

const tom = new TestRunner.Tom('websocket')

tom.test('proxy WS echo', async function () {
    const remotePort = 12000 + this.index
    const localPort = 8300 + this.index

    /* remote WS echo server */
    const remoteWss = new WebSocketServer({ port: remotePort })
    await new Promise(resolve => remoteWss.on('listening', resolve))
    remoteWss.on('connection', ws => {
        ws.on('message', msg => ws.send(msg))
    })

    const lws = await Lws.create({
        port: localPort,
        stack: [Rewrite, Static],
        rewrite: { from: '/ws/(.*)', to: `ws://localhost:${remotePort}/$1` }
    })

    try {
        const client = new WebSocket(`ws://localhost:${localPort}/ws/echo`)
        const msg = await new Promise((resolve, reject) => {
            client.once('open', () => client.send('hello'))
            client.once('message', data => resolve(data.toString()))
            client.once('error', reject)
        })
        a.equal(msg, 'hello')
        client.close()
    } finally {
        lws.server.close()
        remoteWss.close()
    }
}, { timeout: 120000 })

tom.test('proxy WS with path tokens', async function () {
    const remotePort = 12000 + this.index
    const localPort = 8300 + this.index
    let lastRequestedPath = null

    /* remote WS echo server that records request path */
    const remoteWss = new WebSocketServer({ port: remotePort })
    await new Promise(resolve => remoteWss.on('listening', resolve))
    remoteWss.on('connection', (ws, req) => {
        lastRequestedPath = req.url
        ws.on('message', msg => ws.send(msg))
    })

    const lws = await Lws.create({
        port: localPort,
        stack: [Rewrite, Static],
        rewrite: { from: '/ws/:room/:id', to: `ws://localhost:${remotePort}/rooms/:room?id=:id` }
    })

    try {
        const client = new WebSocket(`ws://localhost:${localPort}/ws/chat/42`)
        const msg = await new Promise((resolve, reject) => {
            client.once('open', () => client.send('hey'))
            client.once('message', data => resolve(data.toString()))
            client.once('error', reject)
        })
        a.equal(msg, 'hey')
        a.equal(lastRequestedPath, '/rooms/chat?id=42')
        client.close()
    } finally {
        lws.server.close()
        remoteWss.close()
    }
}, { timeout: 120000 })

tom.test('proxy WS when rule target is http (auto-convert to ws)', async function () {
    const remotePort = 12000 + this.index
    const localPort = 8300 + this.index

    /* remote WS echo server */
    const remoteWss = new WebSocketServer({ port: remotePort })
    await new Promise(resolve => remoteWss.on('listening', resolve))
    remoteWss.on('connection', ws => {
        ws.on('message', msg => ws.send(msg))
    })

    /* note the `http://` target – should be auto-converted to ws:// for the upgrade path */
    const lws = await Lws.create({
        port: localPort,
        stack: [Rewrite, Static],
        rewrite: { from: '/ws/(.*)', to: `http://localhost:${remotePort}/$1` }
    })

    try {
        const client = new WebSocket(`ws://localhost:${localPort}/ws/echo2`)
        const msg = await new Promise((resolve, reject) => {
            client.once('open', () => client.send('auto'))
            client.once('message', data => resolve(data.toString()))
            client.once('error', reject)
        })
        a.equal(msg, 'auto')
        client.close()
    } finally {
        lws.server.close()
        remoteWss.close()
    }
}, { timeout: 120000 })

export default tom