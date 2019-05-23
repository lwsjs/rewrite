const Tom = require('test-runner').Tom
const util = require('../lib/util')
const a = require('assert')

const tom = module.exports = new Tom('util')

tom.test('parseRewriteRules: empty', async function () {
  const rules = []
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

tom.test('fetchRemoteResource', async function () {
  const response = await util.fetchRemoteResource('https://jsonplaceholder.typicode.com/posts/1')
  a.strictEqual(response.statusCode, 200)
  a.strictEqual(JSON.parse(response.body).id, 1)
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
