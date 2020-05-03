/* eslint-env node */
const fs = require('fs');
const path = require('path');
const banner = require('./banner');

const rootDir = path.resolve(__dirname, '..', '..');
const pluginSrcDir = path.join(rootDir, 'src', 'plugin');

// find plugins
const PLUGINS = [];
fs.readdirSync(pluginSrcDir).forEach(plugin => {
    findInDirectory(plugin, pluginSrcDir);
});

/**
 * findInDirectory - Description: search recursively plugins and push them in PLUGINS Array
 *
 * @param {String} plugin Name of plugin
 *
 * @param {String} directory Path of plugin directory
 */
function findInDirectory(plugin, directory) {
    const pluginPath = path.join(directory, plugin);
    if (fs.statSync(pluginPath).isDirectory()) {
        fs.readdirSync(pluginPath).forEach(pluginInDir => {
            findInDirectory(pluginInDir, pluginPath);
        });
    }
    else {
        const relativePluginPath = path.relative(pluginSrcDir, pluginPath);
        PLUGINS.push(relativePluginPath);
    }
}

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
        path: path.join(rootDir, 'dist', 'plugin'),
        filename: 'wavesurfer.[name].js',
        library: ['WaveSurfer', '[name]'],
        publicPath: 'localhost:8080/dist/plugin/'
    },
    devServer: {
        publicPath: 'localhost:8080/dist/plugin/'
    },
    plugins: [banner.pluginBanner]
};
