/* eslint-env node */

require('dotenv').config();
const path = require('path');
const banner = require('./banner');

const rootDir = path.resolve(__dirname, '..', '..');

module.exports = {
    entry: {
        'html-init': path.join(rootDir, 'src', 'html-init.js')
    },
    output: {
        path: path.join(rootDir, process.env.OUTPUT_DIR),
        filename: 'wavesurfer-[name].js',
        library: ['WaveSurfer', '[name]']
    },
    plugins: [banner.libBanner]
};
