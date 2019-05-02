/* eslint-env node */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const banner = require('./banner');

const rootDir = path.resolve(__dirname, '..', '..');
const pluginSrcDir = path.join(rootDir, 'src', 'plugin');

// find plugins
const PLUGINS = [];
fs.readdirSync(pluginSrcDir).forEach(plugin => {
    PLUGINS.push(plugin);
});

/**
 * buildPluginEntry - Description
 *
 * @param {Array} plugins Name of plugins in src/plugin
 *
 * @returns {object} Entry object { name: nameUrl }
 */
function buildPluginEntry(plugins) {
    const result = {};
    plugins.forEach(
        plugin =>
            (result[path.basename(plugin, '.js')] = path.join(
                pluginSrcDir,
                plugin
            ))
    );
    return result;
}

module.exports = {
    entry: buildPluginEntry(PLUGINS),
    output: {
        path: path.join(rootDir, process.env.OUTPUT_DIR, 'plugin'),
        filename: 'wavesurfer.[name].js',
        library: ['WaveSurfer', '[name]'],
        publicPath: 'localhost:8080/dist/plugin/'
    },
    devServer: {
        publicPath: 'localhost:8080/dist/plugin/'
    },
    plugins: [banner.pluginBanner]
};
