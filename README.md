[![view on npm](http://img.shields.io/npm/v/local-web-server-rewrite.svg)](https://www.npmjs.org/package/local-web-server-rewrite)
[![npm module downloads](http://img.shields.io/npm/dt/local-web-server-rewrite.svg)](https://www.npmjs.org/package/llocal-web-server-rewrite)
[![Build Status](https://travis-ci.org/local-web-server/rewrite.svg?branch=master)](https://travis-ci.org/local-web-server/rewrite)
[![Dependency Status](https://david-dm.org/local-web-server/rewrite.svg)](https://david-dm.org/local-web-server/rewrite)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)

# rewrite

Adds URL rewriting to local-web-server. If rewriting to a remote host the request will be proxied. See [path-to-regexp](https://github.com/pillarjs/path-to-regexp#parameters) for the `from` route syntax.

## Options

One option is added to the tool:

```
-r, --rewrite expression ...   A list of URL rewrite rules. For each rule, separate the 'from' and 'to'
                               routes with '->'. Whitespace surrounded the routes is ignored. E.g. '/from ->
                               /to'.
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

&copy; 2016 Lloyd Brookes <75pound@gmail.com>.
