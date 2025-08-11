import { EventEmitter } from 'events'
import util from './lib/util.js'
import url from 'url'
import _ from 'koa-route'
import HttpsProxyAgent from 'https-proxy-agent'
import HttpProxyAgent from 'http-proxy-agent'
import http from 'http'
import https from 'https'

class Rewrite extends EventEmitter {
  description() {
    return 'URL Rewriting. Use to re-route requests to local or remote resources.'
  }

  optionDefinitions() {
    return [
      {
        name: 'rewrite',
        alias: 'r',
        type: String,
        multiple: true,
        typeLabel: '{underline expression} ...',
        description: "A list of URL rewrite rules. For each rule, separate the 'from' and 'to' routes with '->'. Whitespace surrounding the routes is ignored. E.g. '/from -> /to'."
      },
      {
        name: 'rewrite.keep-secure-attr',
        type: Boolean,
        description: 'When local-web-server is running in plain, insecure HTTP mode (not HTTPS or HTTP2), stripping the `secure` attribute from remote, rewrite-target cookies is the default behaviour. Set this flag to leave remote `secure` cookies untouched - this may prevent cookies functioning correctly when your server is plain HTTP.'
      }
    ]
  }

  middleware(options, lws) {
    const rules = util.parseRewriteRules(options.rewrite)
    let httpProxyAgent, httpsProxyAgent
    const httpProxy = process.env.http_proxy
    if (httpProxy) {
      httpsProxyAgent = new HttpsProxyAgent(httpProxy)
      httpProxyAgent = new HttpProxyAgent(httpProxy)
    }
    if (rules.length) {
      this.emit('verbose', 'middleware.rewrite.config', { rewrite: rules })
      /* attach websocket proxy (upgrade) handler once if there are any remote-capable rules */
      setupWebSocketProxy(rules, this, lws, { httpProxyAgent, httpsProxyAgent })
      /* return one middleware per defined rewrite rule */
      return rules.map(rule => {
        if (rule.to) {
          /* `to` address is remote if the url specifies a host */
          if (url.parse(rule.to).host) {
            return _.all(rule.from, proxyRequest(rule, this, lws, { httpProxyAgent, httpsProxyAgent }))
          } else {
            const rmw = rewrite(rule.from, rule.to, this)
            return rmw
          }
        }
      })
    }
  }
}

function setupWebSocketProxy(rules, mw, lws, { httpProxyAgent, httpsProxyAgent }) {
  /* only attach if there’s at least one rule pointing to a remote host (http/https/ws/wss) */
  const hasRemoteRule = rules.some(r => {
    if (!r || !r.to) return false
    const parsed = url.parse(r.to)
    return !!parsed.host && /^(https?:|wss?:)$/.test(parsed.protocol || 'http:')
  })
  if (!hasRemoteRule) return

  let attached = false

  function attachUpgrade(server) {
    if (attached || !server) return
    attached = true

    server.on('upgrade', (req, socket, head) => {
      /* find a remote rule which matches the request */
      const remoteRule = rules.find(rule => {
        if (rule.to && url.parse(rule.to).host) {
          const re = util.pathToRegexp(rule.from)
          return re.test(req.url)
        }
      })

      if (remoteRule) {
        const targetUrl = util.getTargetUrl(remoteRule.from, remoteRule.to, req.url)
        mw.emit('verbose', 'middleware.rewrite.ws.proxy', { from: req.url, to: targetUrl })

        const remoteReqOptions = url.parse(targetUrl)
        remoteReqOptions.headers = req.headers
        remoteReqOptions.rejectUnauthorized = false
        if (remoteReqOptions.protocol === 'ws:') {
          remoteReqOptions.protocol = 'http:'
        } else if (remoteReqOptions.protocol === 'wss:') {
          remoteReqOptions.protocol = 'https:'
        }

        let transport
        const protocol = remoteReqOptions.protocol
        if (protocol === 'http:') {
          transport = http
          remoteReqOptions.agent = httpProxyAgent
        } else if (protocol === 'https:') {
          transport = https
          remoteReqOptions.agent = httpsProxyAgent
        }

        const remoteReq = transport.request(remoteReqOptions)

        remoteReq.on('response', (res) => {
          /* the remote server sent a regular http response, not an upgrade, write it back to the client */
          let headers = ''
          for (const [key, value] of Object.entries(res.headers)) {
            headers += `${key}: ${value}\r\n`
          }
          socket.write(`HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n${headers}\r\n`)
          res.pipe(socket)
        })

        remoteReq.on('upgrade', (remoteRes, remoteSocket, remoteHead) => {
          /* write the upgrade response from target back to client */
          let response = `HTTP/1.1 ${remoteRes.statusCode} ${remoteRes.statusMessage}\r\n`
          for (let i = 0; i < remoteRes.rawHeaders.length; i += 2) {
            response += `${remoteRes.rawHeaders[i]}: ${remoteRes.rawHeaders[i + 1]}\r\n`
          }
          response += '\r\n'
          socket.write(response)

          if (remoteHead && remoteHead.length) remoteSocket.write(remoteHead)
          if (head && head.length) socket.write(head)

          remoteSocket.pipe(socket).pipe(remoteSocket)

          remoteSocket.on('error', (err) => { mw.emit('error', 'middleware.rewrite.ws.remote-socket-error', { err }); socket.destroy() })
          socket.on('error', (err) => { mw.emit('error', 'middleware.rewrite.ws.client-socket-error', { err }); remoteSocket.destroy() })
          remoteSocket.on('close', () => socket.destroy())
          socket.on('close', () => remoteSocket.destroy())
        })

        remoteReq.on('error', (err) => {
          mw.emit('error', 'middleware.rewrite.ws.error', { err })
          socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
        })

        remoteReq.end()
      }
    })
  }

  if (lws && lws.server) {
    attachUpgrade(lws.server)
  } else {
    /* server may not exist yet – try attaching shortly after */
    const tryAttach = () => {
      if (lws && lws.server) attachUpgrade(lws.server)
      else setTimeout(tryAttach, 10)
    }
    tryAttach()
  }
}


function proxyRequest(route, mw, lws, { httpProxyAgent, httpsProxyAgent }) {
  let id = 1

  return function proxyMiddleware(ctx) {
    return new Promise((resolve, reject) => {
      const isHttp2 = ctx.req.httpVersion === '2.0'
      ctx.state.id = id++

      /* disable Koa response mechanism, create and send response manually */
      ctx.respond = false

      /* get remote URL */
      const remoteUrl = util.getTargetUrl(route.from, route.to, ctx.url)

      /* info about this rewrite */
      const rewrite = {
        id: ctx.state.id,
        from: ctx.url,
        to: remoteUrl
      }

      /* if lws-request-monitor added a `requestId`, include that in the verbose output */
      if (typeof ctx.req.requestId === 'number') {
        rewrite.requestId = ctx.req.requestId
      }

      const reqInfo = {
        rewrite,
        method: ctx.request.method,
        headers: ctx.request.headers
      }

      /* ensure host header is set */
      reqInfo.headers.host = url.parse(reqInfo.rewrite.to).host

      /* remove HTTP2 request headers */
      if (isHttp2) {
        for (const prop of Object.keys(ctx.request.headers)) {
          if (prop.substr(0, 1) === ':') {
            delete reqInfo.headers[prop]
          }
        }
      }

      reqInfo.headers.via = '1.1 lws-rewrite'

      util.removeHopSpecificHeaders(reqInfo.headers)

      let transport
      const remoteReqOptions = url.parse(reqInfo.rewrite.to)
      remoteReqOptions.method = reqInfo.method
      remoteReqOptions.headers = reqInfo.headers
      remoteReqOptions.rejectUnauthorized = false

      /* emit verbose info */
      mw.emit('verbose', 'middleware.rewrite.remote.request', reqInfo)

      const protocol = remoteReqOptions.protocol
      if (protocol === 'http:') {
        transport = http
        remoteReqOptions.agent = httpProxyAgent
      } else if (protocol === 'https:') {
        transport = https
        remoteReqOptions.agent = httpsProxyAgent
      } else {
        return reject(new Error('Protocol missing from request: ' + reqInfo.rewrite.to))
      }

      const remoteReq = transport.request(remoteReqOptions, (remoteRes) => {
        remoteRes.headers.via = remoteRes.headers.via
          ? `${remoteRes.headers.via}, 1.1 lws-rewrite`
          : '1.1 lws-rewrite'
        mw.emit('verbose', 'middleware.rewrite.remote.response', {
          rewrite,
          status: remoteRes.statusCode,
          headers: remoteRes.headers
        })
        util.removeHopSpecificHeaders(remoteRes.headers)

        /* On insecure connections, remove `secure` attribute from remote cookies */
        const setCookies = remoteRes.headers['set-cookie']
        if (!ctx.req.socket.encrypted && !lws.config.rewriteKeepSecureAttr && setCookies && setCookies.length) {
          const cookies = setCookies.map(c => {
            let result = util.removeCookieAttribute(c, 'secure')
            if (/samesite=none/.test(result)) {
              result = util.removeCookieAttribute(result, 'samesite=none')
            }
            return result
          })
          remoteRes.headers['set-cookie'] = cookies
        }

        ctx.res.writeHead(remoteRes.statusCode, remoteRes.headers)
        remoteRes.pipe(ctx.res)
        resolve()
      })
      if (ctx.request.rawBody) {
        remoteReq.end(ctx.request.rawBody)
      } else {
        ctx.req.pipe(remoteReq)
      }
      remoteReq.on('error', reject)
    })
  }
}

function rewrite(from, to, mw) {
  return async function (ctx, next) {
    const targetUrl = util.getTargetUrl(from, to, ctx.url)
    if (ctx.url !== targetUrl) {
      const initialUrl = ctx.url
      ctx.url = targetUrl

      mw.emit('verbose', 'middleware.rewrite.local', {
        from: initialUrl,
        to: ctx.url
      })

      await next()
      ctx.url = initialUrl
    } else {
      await next()
    }
  }
}

export default Rewrite
