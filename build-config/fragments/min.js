/* eslint-env node */

const path = require('path');
const webpack = require('webpack');

module.exports = {
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            sourceMap: true
        })
    ]
};
