module.exports = function (config) {
    var configuration = {
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
            {
                pattern: 'spec/support/demo.wav',
                included: false,
                watched: false,
                served: true
            },

            // specs
            'spec/index.js'
        ],
        preprocessors: {
            'spec/index.js': ['webpack']
        },
        webpackMiddleware: {
            stats: 'errors-only'
        },
        plugins: [
            'karma-webpack',
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