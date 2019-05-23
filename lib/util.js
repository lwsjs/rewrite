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

function getToUrl (fromUrl, route) {
  const pathToRegexp = require('path-to-regexp')
  const fromParams = []
  const re = pathToRegexp(route.from, fromParams)
  const fromMatches = re.exec(fromUrl)

  let toUrl = route.to

  for (const [ index, fromParam ] of fromParams.entries()) {
    fromParam.value = fromMatches[index + 1]
  }

  /* replace named params */
  for (const fromParam of fromParams) {
    if (typeof fromParam.name === 'string') {
      toUrl = toUrl.replace(new RegExp(`:${fromParam.name}`, 'g'), fromParam.value)
    }
  }

  /* replace positional params */
  for (const fromParam of fromParams) {
    if (typeof fromParam.name !== 'string') {
      toUrl = fromUrl.replace(re, toUrl)
    }
  }

  return toUrl
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
