/* eslint-env node */

const path = require('path');
const webpack = require('webpack');
const datefns = require('date-fns');

const rootDir = path.resolve(__dirname, '..', '..');
const pckg = require(path.join(rootDir, 'package.json'));

// inject JS version number
const jsVersionPlugin = new webpack.DefinePlugin({
    __VERSION__: JSON.stringify(pckg.version)
});

module.exports = {
    context: rootDir,
    mode: 'development',
    output: {
        libraryTarget: 'umd',
        umdNamedDefine: true,
        globalObject: 'this'
    },
    performance: {
        hints: false
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader'
                    }
                ]
            }
        ]
    },
    plugins: [jsVersionPlugin]
};
