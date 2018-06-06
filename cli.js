#!/usr/bin/env node

/* eslint no-console:0 */

global.CLI_MODE = true
;(async (...args) =>
  console.log(JSON.stringify(await require('./')(...args), null, 2)))(
  require('minimist')(process.argv.slice(2), {
    string: ['dir', 'title', 'podcast', 'author', 'cover'],
    boolean: ['clean'],
    default: {
      podcast: 'My Audiobooks',
      author: 'Author',
      cover: 'cover.jpg',
      clean: true,
      bitrate: 64
    }
  })
)
