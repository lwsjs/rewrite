function parseRewriteRules (rules) {
  const arrayify = require('array-back')

  return arrayify(rules).map(rule => {
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

function getRemoteTargetUrl (from, to, url) {
  const { pathToRegexp } = require('path-to-regexp')
  const fromParams = []
  const re = pathToRegexp(from, fromParams)
  const fromMatches = re.exec(url)
  let toUrl = to

  for (const [index, fromParam] of fromParams.entries()) {
    if (fromMatches && fromMatches[index + 1]) {
      fromParam.value = fromMatches[index + 1]
    }
  }

  /* replace named params */
  for (const fromParam of fromParams) {
    if (typeof fromParam.name === 'string') {
      if (fromParam.value) {
        toUrl = toUrl.replace(new RegExp(`:${fromParam.name}`, 'g'), fromParam.value)
      } else {
        toUrl = url
      }
    }
  }

  /* replace positional params */
  for (const fromParam of fromParams) {
    if (typeof fromParam.name !== 'string') {
      toUrl = url.replace(re, toUrl)
    }
  }

  return toUrl
}

function removeHopSpecificHeaders (headers) {
  const hopSpecificHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']
  for (const hopHeader of hopSpecificHeaders) {
    delete headers[hopHeader]
  }
}

function removeCookieAttribute (cookie = '', attr) {
  return cookie.split(';')
    .map(a => a.trim())
    .filter(a => a.toLowerCase() !== attr)
    .join('; ')
}

function getLocalTargetUrl (from, to, url) {
  const { pathToRegexp } = require('path-to-regexp')
  const keys = []
  const re = pathToRegexp(from, keys)
  const keysObject = toObject(keys)
  const matches = re.exec(url)

  if (matches) {
    return to.replace(/\$(\d+)|(?::(\w+))/g, (_, n, name) => {
      if (name) return matches[keysObject[name].index + 1] || ''
      return matches[n] || ''
    })
  } else {
    return url
  }
}

function toObject (params) {
  const object = {}
  params.forEach((param, i) => {
    param.index = i
    object[param.name] = param
  })
  return object
}

exports.parseRewriteRules = parseRewriteRules
exports.getRemoteTargetUrl = getRemoteTargetUrl
exports.removeHopSpecificHeaders = removeHopSpecificHeaders
exports.removeCookieAttribute = removeCookieAttribute
exports.getLocalTargetUrl = getLocalTargetUrl
