'use strict'

class Rewrite {
  description () {
    return 'Adds URL rewriting. If rewriting to a remote host the request will be proxied.'
  }
  optionDefinitions () {
    return {
      name: 'rewrite',
      alias: 'r',
      type: String,
      multiple: true,
      typeLabel: '[underline]{expression} ...',
      description: "A list of URL rewrite rules. For each rule, separate the 'from' and 'to' routes with '->'. Whitespace surrounded the routes is ignored. E.g. '/from -> /to'."
    }
  }
  middleware (options) {
    const url = require('url')
    const arrayify = require('array-back')
    const routes = parseRewriteRules(arrayify(options.rewrite))
    this.view.write('rewrite-routes', routes)
    if (routes.length) {
      return routes.map(route => {
        if (route.to) {
          /* `to` address is remote if the url specifies a host */
          if (url.parse(route.to).host) {
            const _ = require('koa-route')
            return _.all(route.from, proxyRequest(route, this))
          } else {
            const rewrite = require('koa-rewrite')
            const rmw = rewrite(route.from, route.to)
            rmw._name = 'rewrite'
            return rmw
          }
        }
      })
    }
  }
}

function parseRewriteRules (rules) {
  const t = require('typical')
  return rules && rules.map(rule => {
    if (t.isString(rule)) {
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

function proxyRequest (route, feature) {
  const pathToRegexp = require('path-to-regexp')
  const url = require('url')

  return function proxyMiddleware () {
    const keys = []
    const routeRe = pathToRegexp(route.from, keys)
    let remoteUrl = this.url.replace(routeRe, route.to)

    keys.forEach((key, index) => {
      const re = RegExp(`:${key.name}`, 'g')
      remoteUrl = remoteUrl.replace(re, arguments[index + 1] || '')
    })

    const request = require('req-then')

    /* copy incoming request method and header to the proxy request */
    const reqOptions = Object.assign(url.parse(remoteUrl), {
      method: this.request.method,
      headers: this.request.headers
    })

    /* proxy request alterations */
    reqOptions.host = reqOptions.host
    reqOptions.headers.host = reqOptions.host

    return new Promise((resolve, reject) => {
      let buf = Buffer.alloc(0)
      this.req.on('data', chunk => {
        buf = Buffer.concat([ buf, Buffer.from(chunk) ])
      })
      this.req.on('end', () => {
        feature.view.write('rewrite-log', `${this.request.method} ${this.request.url} -> ${reqOptions.method} ${reqOptions.href}`)
        request(reqOptions, buf)
          .then(response => {
            this.status = response.res.statusCode
            this.body = response.data
            this.set(response.res.headers)
          })
          .then(resolve)
          .catch(err => {
            err.message = `[${err.code}] Failed to proxy to ${reqOptions.href}`
            reject(err)
          })
      })
    })
  }
}

module.exports = Rewrite
