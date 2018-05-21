/* eslint-env node */

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
    mode: 'production',
    optimization: {
        minimizer: [
            new UglifyJSPlugin({
                sourceMap: true
            })
        ]
    }
};
