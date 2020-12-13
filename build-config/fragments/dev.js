/* eslint-env node */

const path = require('path');

module.exports = {
    mode: 'development',
    devtool: 'eval-source-map',
    output: {
        publicPath: 'localhost:8080/dist/'
    },
    devServer: {
        static: [
            {
                directory: path.resolve(__dirname, '..', '..'),
                staticOptions: {},
                publicPath: '/dist/',
                serveIndex: true,
                watch: {
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
        ]
    }
};
