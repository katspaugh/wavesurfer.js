/* eslint-env node */

const path = require('path');

module.exports = {
    entry: {
        'html-init': path.resolve(
            __dirname,
            '../',
            '../',
            'src',
            'html-init.js'
        )
    },
    output: {
        path: path.resolve(__dirname, '../', '../', 'dist'),
        filename: 'wavesurfer-[name].js',
        library: ['WaveSurfer', '[name]']
    }
};
