module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: [
            'jasmine',
            'jasmine-matchers'
        ],
        hostname: 'localhost',
        post: 9876,
        singleRun: true,
        autoWatch: false,
        files: [
            'dist/wavesurfer.min.js',

            {
                pattern: 'dist/wavesurfer.min.js.map',
                included: false,
                watched: false,
                served: true
            },
            {
                pattern: 'spec/support/demo.wav',
                included: false,
                watched: false,
                served: true
            },

            // specs
            'spec/**/*.js'
        ],
        plugins: [
            'karma-jasmine',
            'karma-jasmine-matchers',
            'karma-chrome-launcher'
        ],
        browsers: [
            'Chrome'
        ],
        captureConsole: true,
        colors: true,
        reporters: ['progress']
    });
};