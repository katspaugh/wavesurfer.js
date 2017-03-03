import webpack from 'webpack';
import path from 'path';

const pckg = require('./package.json');
const time = new Date();
const bannerPlugin = new webpack.BannerPlugin(
`${pckg.name} ${pckg.version} (${time})
${pckg.homepage}
@license ${pckg.license}`
);

// from http://stackoverflow.com/a/34749873
/**
* Simple is object check.
* @param item
* @returns {boolean}
*/
export function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
* Deep merge two objects.
* @param target
* @param source
*/
export function mergeDeep(target, source) {
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return target;
}

const config = {
    context: __dirname,
    devtool: 'source-map',
    entry: {
        wavesurfer: path.resolve(__dirname, 'src', 'wavesurfer.js')
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        publicPath: 'localhost:8080/dist/',
        filename: '[name].js',
        library: 'WaveSurfer',
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    devServer: {
        contentBase: [
            path.join(__dirname)
        ],
        publicPath: 'localhost:8080/dist/',
        watchContentBase: true
    },
    performance: {
      hints: false
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                enforce: 'pre',
                exclude: /node_modules/,
                use: [{
                    loader: 'eslint-loader'
                }]
            }, {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'babel-loader',
                    options: {
                        plugins: ["transform-class-properties", "add-module-exports"],
                        presets: [
                            ['es2015', { modules: false }],
                            'stage-0'
                        ]
                    }
                }]
            }
        ]
    },

    plugins: [
        bannerPlugin
    ],
};


/**
* buildPluginEntry - Description
*
* @param {Array} plugins Name of plugins in src/plugin
*
* @returns {object} Entry object { name: nameUrl }
*/
function buildPluginEntry(plugins) {
    const result = {};
    plugins.forEach(plugin => result[plugin] = path.resolve(__dirname, 'src', 'plugin', plugin));
    return result;
}

export default function (options) {
    if (options) {
        if (options.test) {
            mergeDeep(config, {
                devtool: 'source-map',
                // @TODO: Remove this and allow normal linting for tests and fix
                // the linting issues. (test files should have the same rules
                // property as the rest of the code)
                module: {
                    rules: [
                        {
                            test: /\.js$/,
                            exclude: /node_modules/,
                            use: [{
                                loader: 'babel-loader',
                                options: {
                                    plugins: ["transform-class-properties", "add-module-exports"],
                                    presets: [
                                        ['es2015', { modules: false }],
                                        'stage-0'
                                    ]
                                }
                            }]
                        }
                    ]
                }
            })
        }
        // html init code
        if (options.htmlinit) {
            delete config.entry;
            mergeDeep(config, {
                entry: {
                    'html-init': path.join(__dirname, 'src', 'html-init.js')
                },
                output: {
                    filename: 'wavesurfer-[name].js',
                    library: ['WaveSurfer', '[name]']
                }
            });
        }
        // plugins
        if (options.plugins) {
            delete config.entry;
            mergeDeep(config, {
                entry: buildPluginEntry([
                    'timeline',
                    'minimap',
                    'regions',
                    'spectrogram',
                    'cursor',
                    'microphone',
                    'elan'
                ]),
                output: {
                    path: path.resolve(__dirname, 'dist', 'plugin'),
                    filename: 'wavesurfer.[name].js',
                    library: ['WaveSurfer', '[name]'],
                    publicPath: 'localhost:8080/dist/plugin/'
                },
                devServer: {
                    publicPath: 'localhost:8080/dist/plugin/'
                }
            });
        }
        // minified builds
        if (options.minify) {
            mergeDeep(config, {
                plugins: [
                    new webpack.optimize.UglifyJsPlugin({
                        sourceMap: true
                    }),
                    bannerPlugin
                ]
            });

            // rename outputs
            if (options.plugins) {
                mergeDeep(config, {
                    output: {
                        filename: 'wavesurfer.[name].min.js'
                    }
                });
            } else if (options.htmlinit) {
                mergeDeep(config, {
                    output: {
                        filename: 'wavesurfer-[name].min.js'
                    }
                });
            } else {
                mergeDeep(config, {
                    output: {
                        filename: '[name].min.js'
                    }
                })
            }
        }
    }

    return config
}
