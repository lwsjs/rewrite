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
