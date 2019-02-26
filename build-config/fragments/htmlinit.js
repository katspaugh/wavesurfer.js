/* eslint-env node */

const path = require('path');
const banner = require('./banner');

const rootDir = path.resolve(__dirname, '..', '..');

module.exports = {
    entry: {
        'html-init': path.join(rootDir, 'src', 'html-init.js')
    },
    output: {
        path: path.join(rootDir, 'dist'),
        filename: 'wavesurfer-[name].js',
        library: ['WaveSurfer', '[name]']
    },
    plugins: [banner.libBanner]
};
