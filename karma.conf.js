/* eslint-env node */

process.env.BABEL_ENV = 'test';

require('babel-register');
var webpackConfig = require('./build-config/webpack.prod.main.js');

module.exports = function(config) {
    var configuration = {
        basePath: '',
        frameworks: ['jasmine', 'jasmine-matchers'],
        hostname: 'localhost',
        port: 9876,
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
            'spec/plugin-api.spec.js',
            'spec/util.spec.js',
            'spec/wavesurfer.spec.js',
            'spec/peakcache.spec.js'
        ],
        preprocessors: {
            'spec/plugin-api.spec.js': ['webpack'],
            'spec/util.spec.js': ['webpack'],
            'spec/wavesurfer.spec.js': ['webpack'],
            'spec/peakcache.spec.js': ['webpack']
        },
        webpackMiddleware: {
            stats: 'errors-only'
        },
        plugins: [
            'karma-webpack',
            'karma-jasmine',
            'karma-jasmine-matchers',
            'karma-chrome-launcher',
            'karma-coverage'
        ],
        browsers: ['Chrome'],
        captureConsole: true,
        colors: true,
        reporters: ['progress', 'coverage'],
        webpack: webpackConfig,
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
