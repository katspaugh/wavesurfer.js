const { merge } = require('webpack-merge');
const path = require('path');

const common = require('./fragments/common');
const dev = require('./fragments/dev');
const htmlinit = require('./fragments/htmlinit');

module.exports = merge(common, dev, htmlinit);
