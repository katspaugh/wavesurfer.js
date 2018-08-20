/* eslint-env node */

const path = require('path');
const webpack = require('webpack');

const time = new Date();
var rootDir = path.resolve(__dirname, '..', '..');
const pckg = require(path.join(rootDir, 'package.json'));

// add JS banner with copyright and version info
// prettier-ignore
const jsBanner = `${pckg.name} ${pckg.version} (${time})
${pckg.homepage}
@license ${pckg.license}`;
const jsBannerPlugin = new webpack.BannerPlugin({
    banner: jsBanner,
    test: /\.js$/
});

// inject JS version number
const jsVersionPlugin = new webpack.DefinePlugin({
    __VERSION__: JSON.stringify(pckg.version)
});

module.exports = {
    context: rootDir,
    mode: 'development',
    output: {
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    performance: {
        hints: false
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                enforce: 'pre',
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'eslint-loader'
                    }
                ]
            },
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
    plugins: [jsBannerPlugin, jsVersionPlugin]
};
