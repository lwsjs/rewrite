function parseRewriteRules (rules) {
  const arrayify = require('array-back')

  return rules && arrayify(rules).map(rule => {
    if (typeof rule === 'string') {
      const matches = rule.match(/(\S*)\s*->\s*(\S*)/)
      if (!(matches && matches.length >= 3)) throw new Error('Invalid rule: ' + rule)
      return {
        from: matches[1],
        to: matches[2]
      }
    } else {
      return rule
    }
  })
}

function getToUrl (reqUrl, route, args) {
  /* build the remote URL using the 'to' address and route param values */
  const keys = []
  const pathToRegexp = require('path-to-regexp')
  const routeRe = pathToRegexp(route.from, keys)
  let remoteUrl = reqUrl.replace(routeRe, route.to)
  keys.forEach((key, index) => {
    if (typeof key.name === 'string') {
      const re = RegExp(`:${key.name}`, 'g')
      remoteUrl = remoteUrl.replace(re, args[index + 1] || '')
    }
  })
  return remoteUrl
}

async function fetchRemoteResource (remoteUrl, method, headers, body) {
  /* copy incoming request method and headers to the proxy request */
  const remoteReq = {
    url: remoteUrl,
    method,
    headers: headers || {},
    gzip: true
  }
  if (body && body.length) remoteReq.body = body

  /* proxy request alterations */
  const url = require('url')
  remoteReq.headers.host = url.parse(remoteUrl).host

  /* fetch remote resource */
  const requestCb = require('request')
  const util = require('util')
  const request = util.promisify(requestCb)

  const response = await request(remoteReq)
  return response
}

exports.parseRewriteRules = parseRewriteRules
exports.getToUrl = getToUrl
exports.fetchRemoteResource = fetchRemoteResource
