#!/usr/bin/env node
const util = require('../lib/util')
const [from, to, url] = process.argv.slice(2)

if (!(from && to && url)) {
  console.log('USAGE:')
  console.log('$ lws-rewrite <from> <to> <url>')
} else {
  const urlUtil = require('url')
  if (urlUtil.parse(to).host) {
    console.log(util.getRemoteTargetUrl(from, to, url))
  } else {
    console.log(util.getRemoteTargetUrl(from, to, url))
  }
}
