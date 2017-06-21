'use strict'

class Rewrite {
  description () {
    return 'Adds URL rewriting. If rewriting to a remote host the request will be proxied.'
  }
  optionDefinitions () {
    return [
      {
        name: 'rewrite',
        alias: 'r',
        type: String,
        multiple: true,
        typeLabel: '[underline]{expression} ...',
        description: "A list of URL rewrite rules. For each rule, separate the 'from' and 'to' routes with '->'. Whitespace surrounded the routes is ignored. E.g. '/from -> /to'."
      }
    ]
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
            return _.all(route.from, proxyRequest(route, this.view))
          } else {
            const rewrite = require('koa-rewrite')
            const rmw = rewrite(route.from, route.to)
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

function proxyRequest (route, view) {
  const pathToRegexp = require('path-to-regexp')
  const url = require('url')
  let id = 1
  const http = require('http')
  http.globalAgent = new http.Agent({ keepAlive: true })
  const https = require('https')
  https.globalAgent = new https.Agent({ keepAlive: true })

  return function proxyMiddleware () {
    const ctx = this
    ctx.state.id = id++
    view.write('rewrite-incoming', ctx.request)
    /* build the remote URL using the 'to' address and route param values */
    const keys = []
    const routeRe = pathToRegexp(route.from, keys)
    let remoteUrl = ctx.url.replace(routeRe, route.to)
    keys.forEach((key, index) => {
      const re = RegExp(`:${key.name}`, 'g')
      remoteUrl = remoteUrl.replace(re, arguments[index + 1] || '')
    })

    /* copy incoming request method and headers to the proxy request */
    const proxyReq = Object.assign(url.parse(remoteUrl), {
      id: ctx.state.id,
      method: ctx.request.method,
      headers: ctx.request.headers,
      /* ignore CA verification imperfections by default */
      rejectUnauthorized: false
    })

    /* proxy request alterations */
    proxyReq.headers.host = proxyReq.host

    return new Promise(async (resolve, reject) => {
      const streamReadAll = require('stream-read-all')
      const reqData = await streamReadAll(ctx.req)
      try {
        view.write('rewrite-proxy-req', { req: proxyReq, data: reqData.toString() })
        const request = require('req-then')
        const response = await request(proxyReq, reqData)
        const viewResponse = Object.assign({}, response)
        viewResponse.data = viewResponse.data.toString()
        view.write('rewrite-proxy-res', viewResponse)
        ctx.status = response.res.statusCode
        ctx.body = response.data
        ctx.set(response.res.headers)
        resolve()
      } catch (err) {
        reject(err)
        view.write('rewrite-error', { code: err.code, message: err.message, stack: err.stack })
        view.write('rewrite-fail', `#${ctx.state.id} ${ctx.request.method} ${ctx.request.url} -> ${proxyReq.method} ${proxyReq.href}`)
      }
    })
  }
}

module.exports = Rewrite
