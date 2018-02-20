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
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            sourceMap: true
        }),
        bannerPlugin
    ]
};
