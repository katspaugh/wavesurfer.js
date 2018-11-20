const merge = require('webpack-merge');

const common = require('./fragments/common');
const dev = require('./fragments/dev');
const plugins = require('./fragments/plugins');

module.exports = merge(common, dev, plugins);
