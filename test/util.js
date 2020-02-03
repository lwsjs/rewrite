const Tom = require('test-runner').Tom
const util = require('../lib/util')
const a = require('assert')

const tom = module.exports = new Tom('util')

tom.test('parseRewriteRules: empty', async function () {
  const rules = []
  const result = util.parseRewriteRules(rules)
  a.deepStrictEqual(result, [])
})

tom.test('parseRewriteRules: undefined', async function () {
  const rules = undefined
  const result = util.parseRewriteRules(rules)
  a.deepStrictEqual(result, [])
})

tom.test('parseRewriteRules', async function () {
  const rules = [
    '/one -> /two',
    '/three -> http://example.com/four'
  ]
  const result = util.parseRewriteRules(rules)
  a.deepStrictEqual(result, [
    { from: '/one', to: '/two' },
    { from: '/three', to: 'http://example.com/four' }
  ])
})

tom.test('getToUrl: no params', async function () {
  const route = { from: '/one', to: '/two' }
  const result = util.getToUrl('/one', route)
  a.strictEqual(result, '/two')
})

tom.test('getToUrl: replace named parameter', async function () {
  const route = { from: '/one/:id', to: '/:id/two' }
  const result = util.getToUrl('/one/2', route)
  a.strictEqual(result, '/2/two')
})

tom.test('getToUrl: replace named parameter twice', async function () {
  const route = { from: '/one/:id', to: '/:id/two/:id' }
  const result = util.getToUrl('/one/2', route)
  a.strictEqual(result, '/2/two/2')
})

tom.test('getToUrl: replaced wildcard', async function () {
  const route = { from: '/(.*)', to: 'http://example.com/$1' }
  const result = util.getToUrl('/api/2/data', route)
  a.strictEqual(result, 'http://example.com/api/2/data')
})

tom.test('getToUrl: replaced named param plus wildcard', async function () {
  const route = { from: '/:name/(.*)', to: 'http://example.com/$2/:name' }
  const result = util.getToUrl('/api/2/data', route)
  a.strictEqual(result, 'http://example.com/2/data/api')
})

tom.test('removeHopSpecificHeaders', async function () {
  const headers = {
    'connection': 'test',
    'keep-alive': 'test',
    'proxy-authenticate': 'test',
    'proxy-authorization': 'test',
    'te': 'test',
    'trailer': 'test',
    'transfer-encoding': 'test',
    'upgrade': 'test'
  }
  util.removeHopSpecificHeaders(headers)
  a.deepStrictEqual(headers, {})
})

tom.test('removeCookieAttribute', async function () {
  const setCookie = 'lastVisit=03/02/2020, 23:02:40; path=/; secure; httponly'
  const result = util.removeCookieAttribute(setCookie, 'secure')
  a.strictEqual(result, 'lastVisit=03/02/2020, 23:02:40; path=/; httponly')
})

tom.test('removeCookieAttribute 2', async function () {
  const setCookie = 'lastVisit=03/02/2020, 23:02:40;Secure; httponly'
  const result = util.removeCookieAttribute(setCookie, 'secure')
  a.strictEqual(result, 'lastVisit=03/02/2020, 23:02:40; httponly')
})

tom.test('removeCookieAttribute 3', async function () {
  const setCookie = ''
  const result = util.removeCookieAttribute(setCookie, 'secure')
  a.strictEqual(result, '')
})

tom.test('removeCookieAttribute 4', async function () {
  const setCookie = undefined
  const result = util.removeCookieAttribute(setCookie, 'secure')
  a.strictEqual(result, '')
})
