/* eslint-env node */

const path = require('path');
const webpack = require('webpack');

const time = new Date();
const pckg = require(path.join(__dirname, '..', '..', 'package.json'));
// prettier-ignore
const bannerPlugin = new webpack.BannerPlugin(
`${pckg.name} ${pckg.version} (${time})
${pckg.homepage}
@license ${pckg.license}`
);

module.exports = {
    context: path.resolve(__dirname, '../', '../'),
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
    plugins: [bannerPlugin]
};
