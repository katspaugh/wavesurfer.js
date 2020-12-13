/* eslint-env node */

const fs = require('fs');
const path = require('path');

process.env.BABEL_ENV = 'test';
process.traceDeprecation = true;

require('@babel/register');
const webpackConfig = require('./build-config/webpack.prod.main.js');
const ci = process.env.CI || process.env.APPVEYOR;

// Chrome CLI options
// http://peter.sh/experiments/chromium-command-line-switches/
const chromeFlags = [
    '--no-sandbox',
    '--no-first-run',
    '--noerrdialogs',
    '--no-default-browser-check',
    '--user-data-dir=' + path.resolve('.chrome'),
    '--disable-translate',
    '--disable-extensions',
    '--disable-infobars',
    '--ignore-certificate-errors',
    '--allow-insecure-localhost',
    '--autoplay-policy=no-user-gesture-required',
    // see https://developers.google.com/web/updates/2017/09/autoplay-policy-changes#webaudio
    '--disable-features=PreloadMediaEngagementData,AutoplayIgnoreWebAudio,MediaEngagementBypassAutoplayPolicies'
];
const firefoxFlags = {
    // disable autoplay blocking, see https://www.ghacks.net/2018/09/21/firefox-improved-autoplay-blocking/
    'media.autoplay.default': 0,
    'media.autoplay.ask-permission': false,
    'media.autoplay.enabled.user-gestures-needed': false,
    'media.autoplay.block-webaudio': false
};

module.exports = function(config) {
    var configuration = {
        basePath: '',
        frameworks: ['jasmine', 'jasmine-matchers', 'webpack'],
        hostname: 'localhost',
        port: 9876,
        logLevel: config.LOG_INFO,
        singleRun: true,
        autoWatch: false,
        files: [
            // demo files
            {
                pattern: 'spec/support/**',
                included: false,
                watched: false,
                served: true,
                nocache: true
            },

            // specs
            'spec/plugin-api.spec.js',
            'spec/util.spec.js',
            'spec/wavesurfer.spec.js',
            'spec/peakcache.spec.js',
            'spec/mediaelement.spec.js',
            'spec/mediaelement-webaudio.spec.js',
            'spec/drawer.spec.js'
        ],
        customHeaders: [
            {
                match: 'demo.wav',
                name: 'Content-Length',
                value: fs.statSync('./spec/support/demo.wav')['size']
            }
        ],
        preprocessors: {
            'spec/plugin-api.spec.js': ['webpack'],
            'spec/util.spec.js': ['webpack'],
            'spec/wavesurfer.spec.js': ['webpack'],
            'spec/peakcache.spec.js': ['webpack'],
            'spec/mediaelement.spec.js': ['webpack'],
            'spec/mediaelement-webaudio.spec.js': ['webpack'],
            'spec/drawer.spec.js': ['webpack'],

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
            'karma-verbose-reporter'
        ],
        browsers: ['Chrome_dev', 'Firefox_dev'],
        captureConsole: true,
        colors: true,
        reporters: ['verbose', 'progress', 'coverage'],
        coverageReporter: {
            dir: 'coverage',
            reporters: [
                { type: 'html', subdir: 'html' },
                { type: 'lcov', subdir: 'lcov' }
            ]
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
                base: 'Firefox',
                prefs: firefoxFlags
            },
            Firefox_ci: {
                base: 'FirefoxHeadless',
                prefs: firefoxFlags
            }
        }
    };

    if (ci) {
        configuration.browsers = ['Firefox_ci', 'Chrome_ci'];
    }
    config.set(configuration);
};
