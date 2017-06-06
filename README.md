[![view on npm](https://img.shields.io/npm/v/lws-rewrite.svg)](https://www.npmjs.org/package/lws-rewrite)
[![npm module downloads](https://img.shields.io/npm/dt/lws-rewrite.svg)](https://www.npmjs.org/package/llws-rewrite)
[![Build Status](https://travis-ci.org/lwsjs/rewrite.svg?branch=master)](https://travis-ci.org/lwsjs/rewrite)
[![Dependency Status](https://david-dm.org/lwsjs/rewrite.svg)](https://david-dm.org/lwsjs/rewrite)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)

# rewrite

URL rewriting feature for lws. Adds URL rewriting to local-web-server. If rewriting to a remote host the request will be proxied. See [path-to-regexp](https://github.com/pillarjs/path-to-regexp#parameters) for the `from` route syntax.

## Options

One option is added to the tool:

```
-r, --rewrite expression ...   A list of URL rewrite rules. For each rule, separate the
                               'from' and 'to' routes with '->'. Whitespace surrounded
                               the routes is ignored. E.g. '/from -> /to'.
```

For example, use rewrites to try a new stylesheet (without modifying code) and proxy to the npm registry:

```
$ ws --rewrite '/css/* -> /build/styles/$1' '/npm/* -> http://registry.npmjs.org/$1'
```

## Config

Config example:

```json
{
  "rewrite": [
    { "from": "/css/*", "to": "/build/styles/$1" },
    { "from": "/npm/*", "to": "http://registry.npmjs.org/$1" },
    { "from": "/broken/*", "to": "http://localhost:9999" },
    { "from": "/:user/repos/:name", "to": "https://api.github.com/repos/:user/:name" }
  ]
}
```

* * *

&copy; 2016-17 Lloyd Brookes <75pound@gmail.com>.
