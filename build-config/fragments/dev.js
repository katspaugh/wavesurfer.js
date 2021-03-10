/* eslint-env node */

const path = require('path');

module.exports = {
    mode: 'development',
    devtool: 'eval-source-map',
    devServer: {
        static: [
            {
                directory: path.resolve(__dirname, '..', '..'),
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
