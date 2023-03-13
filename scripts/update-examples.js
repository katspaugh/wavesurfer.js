/**
 * @file update-examples.js
 * @since 1.0.0
 */

const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const walk = require('walkdir');
const copydir = require('copy-dir');
const download = require('download-tarball');
const replaceInFiles = require('replace-in-files');

const dirName = 'wavesurfer.js';
const libDir = path.join('node_modules', dirName);
const pjson = JSON.parse(fs.readFileSync(path.resolve(libDir, 'package.json'), 'utf8'));
const version = pjson.version;
const url = 'https://github.com/wavesurfer-js/' + dirName + '/archive/' + version + '.tar.gz';
const targetDir = '/tmp';
const dirNameWithVersion = dirName + '-' + version;
const targetDirUnpacked = path.join(targetDir, dirNameWithVersion);
const CDN_URL = 'https://unpkg.com/wavesurfer.js/dist/';
const examplesIndex = path.join('examples', 'index.html');

const camelCaseToWords = function(str) {
    return str.match(/[A-Za-z][a-z]*/g).map(function(x){
        return x[0].toUpperCase() + x.substr(1).toLowerCase();
    }).join(' ');
};

console.log('--------------------------------------');
console.log('Updating site with', pjson.name, version);
console.log('--------------------------------------');
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

    // copy updated example directory
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
                console.log('');

                // find examples
                const examples = [];
                walk.sync('example', function(fpath, stat) {
                  if (fpath.endsWith(path.sep + 'index.html')) {
                    let parts = fpath.split(path.sep);
                    let exampleName = parts[parts.length - 2];
                    let title = camelCaseToWords(exampleName);
                    console.log('found example: ', title);
                    examples.push({fname: exampleName, title: title});
                  }
                });

                console.log('');

                // update and generate examples index
                ejs.renderFile('examples-index.ejs', {examples: examples}, (err, str) => {
                    // write to a new file
                    fs.writeFile(examplesIndex, str, (err) => {  
                        // throws an error, you could also catch it here
                        if (err) throw err;

                        // success case, the file was saved
                        console.log('Updated', examplesIndex);
                    });
                });
            }).catch(error => {
                console.error('Replacement error occurred:', error);
            });
        }
    });
}).catch(err => {
    console.log('File could not be downloaded properly!');
    console.log(err);
});
