/* eslint-env node */

process.env.BABEL_ENV = 'test';
process.traceDeprecation = true;

require('babel-register');
var webpackConfig = require('./build-config/webpack.prod.main.js');
var ci = process.env.TRAVIS || process.env.APPVEYOR;

// Chrome CLI options
// http://peter.sh/experiments/chromium-command-line-switches/
var chromeFlags = [
    '--no-sandbox',
    '--no-first-run',
    '--noerrdialogs',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=.chrome',
    '--disable-translate',
    '--disable-extensions',
    '--disable-infobars',
    '--ignore-certificate-errors',
    '--allow-insecure-localhost'
];

module.exports = function(config) {
    var configuration = {
        basePath: '',
        frameworks: ['jasmine', 'jasmine-matchers'],
        hostname: 'localhost',
        port: 9876,
        logLevel: config.LOG_INFO,
        singleRun: true,
        autoWatch: false,
        files: [
            // demo audio file
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
            'spec/peakcache.spec.js': ['webpack'],

            // source files, that you want to generate coverage for
            // do not include tests or libraries
            'src/**/*.js': ['coverage']
        },
        webpackMiddleware: {
            stats: 'errors-only'
        },
        plugins: [
            'karma-webpack',
            'karma-jasmine',
            'karma-jasmine-matchers',
            'karma-chrome-launcher',
            'karma-firefox-launcher',
            'karma-coverage',
            'karma-coveralls',
            'karma-verbose-reporter'
        ],
        browsers: ['Chrome_dev', 'FirefoxHeadless'],
        captureConsole: true,
        colors: true,
        reporters: ['verbose', 'progress', 'coverage'],
        coverageReporter: {
            type: 'html',
            dir: 'coverage'
        },
        webpack: webpackConfig,
        customLaunchers: {
            Chrome_dev: {
                base: 'Chrome',
                flags: chromeFlags
            },
            Chrome_ci: {
                base: 'ChromeHeadless',
                flags: chromeFlags
            },
            Firefox_dev: {
                base: 'FirefoxHeadless'
            }
        }
    };

    if (ci) {
        configuration.browsers = ['Chrome_ci', 'Firefox_dev'];

        if (process.env.TRAVIS) {
            // enable coveralls
            configuration.reporters.push('coveralls');
            // lcov or lcovonly are required for generating lcov.info files
            configuration.coverageReporter.type = 'lcov';
        }
    }

    config.set(configuration);
};
