module.exports = MiddlewareBase => class Rewrite extends MiddlewareBase {
  description () {
    return 'URL Rewriting. Use to re-route requests to local or remote destinations.'
  }

  optionDefinitions () {
    return [
      {
        name: 'rewrite',
        alias: 'r',
        type: String,
        multiple: true,
        typeLabel: '{underline expression} ...',
        description: "A list of URL rewrite rules. For each rule, separate the 'from' and 'to' routes with '->'. Whitespace surrounded the routes is ignored. E.g. '/from -> /to'."
      }
    ]
  }

  middleware (options) {
    const url = require('url')
    const util = require('./lib/util')
    const routes = util.parseRewriteRules(options.rewrite)
    if (routes.length) {
      this.emit('verbose', 'middleware.rewrite.config', { rewrite: routes })
      return routes.map(route => {
        if (route.to) {
          /* `to` address is remote if the url specifies a host */
          if (url.parse(route.to).host) {
            const _ = require('koa-route')
            return _.all(route.from, proxyRequest(route, this))
          } else {
            const rewrite = require('koa-rewrite-75lb')
            const rmw = rewrite(route.from, route.to, this)
            return rmw
          }
        }
      })
    }
  }
}

function proxyRequest (route, mw) {
  let id = 1
  return async function proxyMiddleware (ctx, ...paramValues) {
    const util = require('./lib/util')
    ctx.state.id = id++

    /* get incoming request body */
    let reqBody
    if (ctx.request.rawBody) {
      reqBody = ctx.request.rawBody
    } else {
      const streamReadAll = require('stream-read-all')
      reqBody = await streamReadAll(ctx.req)
    }

    /* get remote URL */
    const remoteUrl = util.getToUrl(ctx.url, route, paramValues)

    mw.emit('verbose', 'middleware.rewrite.proxy', {
      from: ctx.url,
      to: remoteUrl
    })

    /* emit verbose info */
    const reqInfo = {
      rewriteId: ctx.state.id,
      method: ctx.request.method,
      headers: ctx.request.headers
    }
    if (reqBody && reqBody.length) reqInfo.body = reqBody.toString()
    mw.emit('verbose', 'middleware.rewrite.proxy.request', reqInfo)

    const response = await util.fetchRemoteResource(remoteUrl, ctx.request.method, ctx.request.headers, reqBody)

    ctx.status = response.statusCode
    const ignored = [ 'transfer-encoding', 'content-encoding' ]
    // for (const [ key, value ] of response.headers) {
    //   if (!ignored.includes(key.toLowerCase())) {
    //     console.log('set', key, value)
    //     ctx.response.set(key, value)
    //   }
    // }
    ctx.response.set('content-type', response.headers['content-type'])
    ctx.response.body = response.body

    // const viewResponse = Object.assign({}, response)
    // if (typeof viewResponse.data === 'string' || Buffer.isBuffer(viewResponse.data)) {
    //   viewResponse.data = viewResponse.data.toString()
    //   /* if JSON was returned, parse it */
    //   try {
    //     viewResponse.data = JSON.parse(viewResponse.data)
    //   } catch (err) {}
    // }
    // mw.emit('verbose', 'middleware.rewrite.proxy.response', {
    //   rewriteId: ctx.state.id,
    //   res: viewResponse.res,
    //   data: viewResponse.data
    // })
  }
}
