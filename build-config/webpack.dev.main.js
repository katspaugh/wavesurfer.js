const merge = require('webpack-merge');
const path = require('path');

const common = require('./fragments/common');
const dev = require('./fragments/dev');
const main = require('./fragments/main');

module.exports = merge(common, dev, main);
