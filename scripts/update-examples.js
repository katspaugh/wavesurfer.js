/**
 * @file update-examples.js
 * @since 1.0.0
 */

const fs = require('fs');
const path = require('path');
const copydir = require('copy-dir');
const download = require('download-tarball');
const replaceInFiles = require('replace-in-files');

const dirName = 'wavesurfer.js';
const libDir = path.join('node_modules', dirName);
const pjson = JSON.parse(fs.readFileSync(path.resolve(libDir, 'package.json'), 'utf8'));
const version = pjson.version;
const url = 'https://github.com/katspaugh/' + dirName + '/archive/' + version + '.tar.gz';
const targetDir = '/tmp';
const dirNameWithVersion = dirName + '-' + version;
const targetDirUnpacked = path.join(targetDir, dirNameWithVersion);
const CDN_URL = 'https://unpkg.com/wavesurfer.js/dist/';

console.log('-------------------------------------');
console.log('Updating docs for', pjson.name, version);
console.log('-------------------------------------');
console.log();

// download
let dl_options = {
    url: url,
    dir: targetDir
};
console.log('Downloading', url);
console.log();
download(dl_options).then(() => {
    console.log('File downloaded and extracted at', targetDirUnpacked);
    console.log();

    // copy dist
    copydir(path.join(targetDirUnpacked, 'example'), path.join('.', 'example'), (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log('Updated example directory.');
            console.log();

            // use CDN url
            console.log('Using CDN:', CDN_URL);
            console.log('');
            const options = {
              files: [
                'example/**/*.html'
              ],
              from: /..\/..\/dist\//gm,
              to: CDN_URL
            };
            replaceInFiles(options).then(data => {
                console.log('Updated CDN link in:', data.countOfMatchesByPaths);
            }).catch(error => {
                console.error('Replacement error occurred:', error);
            });
        }
    });
}).catch(err => {
    console.log('File could not be downloaded properly!');
    console.log(err);
});
