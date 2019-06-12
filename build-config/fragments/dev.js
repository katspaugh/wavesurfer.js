/* eslint-env node */

const path = require('path');

module.exports = {
    mode: 'development',
    devtool: 'eval-source-map',
    output: {
        publicPath: 'localhost:8080/dist/'
    },
    devServer: {
        contentBase: [path.resolve(__dirname, '..', '..')],
        publicPath: 'localhost:8080/dist/',
        watchContentBase: true,
        watchOptions: {
            ignored: [
                /.chrome/,
                /node_modules/,
                /bower_components/,
                /coverage/,
                /docs/,
                /spec/
            ]
        }
    }
};
