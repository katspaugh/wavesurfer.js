const { merge } = require('webpack-merge');
const path = require('path');

const common = require('./fragments/common');
const prod = require('./fragments/prod');
const htmlinit = require('./fragments/htmlinit');

module.exports = merge(common, prod, htmlinit);
