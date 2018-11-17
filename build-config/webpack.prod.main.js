const merge = require('webpack-merge');

const common = require('./fragments/common');
const prod = require('./fragments/prod');
const main = require('./fragments/main');

module.exports = merge(common, prod, main);
