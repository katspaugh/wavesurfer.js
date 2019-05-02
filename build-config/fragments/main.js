/* eslint-env node */

require('dotenv').config();
const path = require('path');
const banner = require('./banner');

const rootDir = path.resolve(__dirname, '..', '..');

module.exports = {
    entry: {
        wavesurfer: path.join(rootDir, 'src', 'wavesurfer.js')
    },
    output: {
        path: path.join(rootDir, process.env.OUTPUT_DIR),
        filename: '[name].js',
        library: 'WaveSurfer'
    },
    plugins: [banner.libBanner]
};
