/* eslint-env node */

const path = require('path');

module.exports = {
    entry: {
        wavesurfer: path.resolve(
            __dirname,
            '../',
            '../',
            'src',
            'wavesurfer.js'
        )
    },
    output: {
        path: path.resolve(__dirname, '../', '../', 'dist'),
        filename: '[name].js',
        library: 'WaveSurfer'
    }
};
