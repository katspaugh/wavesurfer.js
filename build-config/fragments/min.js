/* eslint-env node */

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
    optimization: {
        minimizer: [
            new UglifyJSPlugin({
                sourceMap: true
            })
        ]
    }
};
