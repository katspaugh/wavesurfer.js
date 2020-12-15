/* eslint-env node */

const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    mode: 'production',
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                parallel: true,
                extractComments: false,
                terserOptions: {
                    output: {
                        // preserve license comments
                        comments: /@license/i
                    }
                }
            })
        ]
    }
};
