/* eslint-env node */

const path = require('path');
const rootDir = path.resolve(__dirname, '..', '..');

module.exports = {
    mode: 'development',
    devtool: 'eval-source-map',
    output: {
        publicPath: 'localhost:8080/'
    },
    devServer: {
        static: [
            {
                directory: rootDir,
                staticOptions: {},
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
