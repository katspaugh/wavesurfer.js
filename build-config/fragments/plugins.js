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
 * findInDirectory - Description: search plugins and push them in PLUGINS Array: if finds a directory, take the plugin
 *                   called index.js
 *
 * @param {String} plugin Name of plugin
 *
 * @param {String} directory Path of plugin directory
 */
function findInDirectory(plugin, directory) {
    const pluginPath = path.join(directory, plugin);
    let relativePluginPath = null;

    if (fs.statSync(pluginPath).isDirectory()) {
        fs.readdirSync(pluginPath).forEach(pluginInDir => {
            if (pluginInDir === 'index.js') {
                const pathInDirectory = path.join(pluginPath, pluginInDir);
                relativePluginPath = path.relative(pluginSrcDir, pathInDirectory);
                PLUGINS.push(relativePluginPath);
            }
        });
    }
    else {
        relativePluginPath = path.relative(pluginSrcDir, pluginPath);
        PLUGINS.push(relativePluginPath);
    }
}

/**
 * buildPluginEntry - Description: build the plugin entry based on PLUGINS array: if plugin name is index.js, it is
 *                    it is renamed with his parent directory name
 *
 * @param {Array} plugins Name of plugins in src/plugin
 *
 * @returns {object} Entry object { name: nameUrl }
 */
function buildPluginEntry(plugins) {
    const result = {};
    plugins.forEach(
        plugin => {
            let basename = path.basename(plugin, '.js');
            if (basename === 'index') {
                basename = path.basename(path.dirname(plugin));
            }
            return (result[path.basename(basename, '.js')] = path.join(
                pluginSrcDir,
                plugin
            ));
        }
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
