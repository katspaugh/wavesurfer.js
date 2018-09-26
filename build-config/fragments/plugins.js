/* eslint-env node */

const path = require('path');
const rootDir = path.resolve(__dirname, '..', '..');

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
        plugin => (result[plugin] = path.join(rootDir, 'src', 'plugin', plugin))
    );
    return result;
}

module.exports = {
    entry: buildPluginEntry([
        'timeline',
        'minimap',
        'regions',
        'spectrogram',
        'cursor',
        'microphone',
        'mediasession',
        'elan'
    ]),
    output: {
        path: path.join(rootDir, 'dist', 'plugin'),
        filename: 'wavesurfer.[name].js',
        library: ['WaveSurfer', '[name]'],
        publicPath: 'localhost:8080/dist/plugin/'
    },
    devServer: {
        publicPath: 'localhost:8080/dist/plugin/'
    }
};
