/* eslint-env node */

const path = require('path');
const banner = require('./banner');

const rootDir = path.resolve(__dirname, '..', '..');

module.exports = {
    entry: {
        wavesurfer: path.join(rootDir, 'src', 'wavesurfer.js')
    },
    output: {
        path: path.join(rootDir, 'dist'),
        filename: '[name].js',
        library: 'WaveSurfer'
    },
    plugins: [banner.libBanner]
};
