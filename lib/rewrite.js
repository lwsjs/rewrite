'use strict'
const EventEmitter = require('events').EventEmitter

class Rewrite extends EventEmitter {
  optionDefinitions () {
    return {
      name: 'rewrite', alias: 'r', type: String, multiple: true,
      typeLabel: '[underline]{expression} ...',
      description: "A list of URL rewrite rules. For each rule, separate the 'from' and 'to' routes with '->'. Whitespace surrounded the routes is ignored. E.g. '/from -> /to'."
    }
  }
  middleware (options) {
    const url = require('url')
    const arrayify = require('array-back')
    const routes = parseRewriteRules(arrayify(options.rewrite))
    if (routes.length) {
      return routes.map(route => {
        if (route.to) {
          /* `to` address is remote if the url specifies a host */
          this.emit('verbose', 'Route', `${route.from} -> ${route.to}`)
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

function proxyRequest (route, mw) {
  const httpProxy = require('http-proxy')
  const pathToRegexp = require('path-to-regexp')
  const url = require('url')

  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    secure: false
  })

  return function proxyMiddleware () {
    this.response = false
    const keys = []
    route.re = pathToRegexp(route.from, keys)
    route.new = this.url.replace(route.re, route.to)

    keys.forEach((key, index) => {
      const re = RegExp(`:${key.name}`, 'g')
      route.new = route.new
        .replace(re, arguments[index + 1] || '')
    })

    return new Promise((resolve, reject) => {
      proxy.once('error', err => {
        err.message = `[PROXY] Error: ${err.message} Target: ${route.new}`
        reject(err)
      })
      proxy.once('proxyReq', function (proxyReq) {
        proxyReq.path = url.parse(route.new).path
      })
      proxy.once('close', resolve)
      mw.emit('verbose', 'Remote request', route.new)
      proxy.web(this.req, this.res, { target: route.new })
    })
  }
}

module.exports = Rewrite
