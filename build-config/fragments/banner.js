/* eslint-env node */

const path = require('path');
const webpack = require('webpack');
const datefns = require('date-fns');

const rootDir = path.resolve(__dirname, '..', '..');
const date = datefns.format(new Date(), 'yyyy-MM-dd');
const pckg = require(path.join(rootDir, 'package.json'));

// library JS banner with copyright and version info
// prettier-ignore
const jsBanner = `${pckg.name} ${pckg.version} (${date})
${pckg.homepage}
@license ${pckg.license}`;
const libBanner = new webpack.BannerPlugin({
    banner: jsBanner,
    test: /\.js$/
});

// plugin JS banner with copyright and version info
// prettier-ignore
const jsPluginBanner = `${pckg.name} [name] plugin ${pckg.version} (${date})
${pckg.homepage}
@license ${pckg.license}`;
const pluginBanner = new webpack.BannerPlugin({
    banner: jsPluginBanner,
    test: /\.js$/
});

module.exports = { libBanner, pluginBanner };
