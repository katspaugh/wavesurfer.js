/* eslint-env node */

const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    mode: 'production',
    optimization: {
        minimizer: [
            new TerserPlugin({
                sourceMap: true,
                parallel: true,
                cache: './.build_cache/terser',
                terserOptions: {
                    output: {
                        comments: false
                    }
                }
            })
        ]
    }
};
