module.exports = function (config) {
    var configuration = {
        basePath: '',
        frameworks: [
            'jasmine',
            'jasmine-matchers'
        ],
        hostname: 'localhost',
        port: 9876,
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
        reporters: ['progress'],


        customLaunchers: {
            Chrome_travis_ci: {
                base: 'Chrome',
                flags: ['--no-sandbox']
            }
        }
    };

    if (process.env.TRAVIS) {
        configuration.browsers = ['Chrome_travis_ci'];
    }

    config.set(configuration);
};
