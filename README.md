# wavesurfer.js v6

[![npm version](https://img.shields.io/npm/v/wavesurfer.js.svg?style=flat)](https://www.npmjs.com/package/wavesurfer.js)
![npm](https://img.shields.io/npm/dm/wavesurfer.js.svg) [![Join the chat at https://gitter.im/wavesurfer-js/wavesurfer.js](https://badges.gitter.im/wavesurfer-js/wavesurfer.js.svg)](https://gitter.im/wavesurfer-js/wavesurfer.js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![GitPOAP Badge](https://public-api.gitpoap.io/v1/repo/wavesurfer-js/wavesurfer.js/badge)](https://www.gitpoap.io/gh/wavesurfer-js/wavesurfer.js)

Interactive navigable audio visualization using Web Audio and Canvas.

[![Screenshot](https://raw.githubusercontent.com/wavesurfer-js/wavesurfer.js/gh-pages/example/screenshot.png "Screenshot")](https://wavesurfer-js.org)

See [docs](https://wavesurfer-js.org/docs) and [examples](https://wavesurfer-js.org/examples) on [wavesurfer-js.org](https://wavesurfer-js.org).

For a video tutorial, watch this [series by Live Blogger on YouTube](https://www.youtube.com/watch?v=yCmnDWCF8m0). 📺

## Questions
Have a question about integrating wavesurfer.js on your website? Feel free to ask in our forum: https://github.com/wavesurfer-js/wavesurfer.js/discussions/categories/q-a

## Quick start
Install the package:

```
npm install wavesurfer.js --save

# or

yarn add wavesurfer.js
```

And import it like so:
```
import WaveSurfer from 'wavesurfer.js'
```

If you're not using a package manager, simply insert the script from a CDN:
```
<script src="https://unpkg.com/wavesurfer.js@6.6"></script>
```

Create a container in your HTML:
```html
<div id="waveform"></div>
```

Create an instance of wavesufer.js, passing the container selector and a few [options](https://wavesurfer-js.org/docs/options.html):

```javascript
var wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: 'violet',
    progressColor: 'purple'
});
```

Subscribe to some [events](https://wavesurfer-js.org/docs/events.html):

```javascript
wavesurfer.on('ready', function () {
    wavesurfer.play();
});
```

Load an audio file from a URL:

```javascript
wavesurfer.load('example/media/demo.wav');
```

## Documentation

See the documentation on all available [methods](https://wavesurfer-js.org/docs/methods.html), [options](https://wavesurfer-js.org/docs/options.html) and [events](https://wavesurfer-js.org/docs/events.html) on the [homepage](https://wavesurfer-js.org/docs/).

## Projects using wavesurfer.js

For the list of projects using wavesurfer.js, check out
[the projects page](https://wavesurfer-js.org/projects/).

## Contributing

Have an idea and want to contribute to wavesurfer.js?
Please first start a discussion in the [Ideas section of our forum](https://github.com/wavesurfer-js/wavesurfer.js/discussions/categories/ideas) to coordinate with the maintainers.

### Development

[![Build Status](https://github.com/wavesurfer-js/wavesurfer.js/workflows/wavesurfer.js/badge.svg?branch=master)](https://github.com/wavesurfer-js/wavesurfer.js/actions?workflow=wavesurfer.js)
[![Coverage Status](https://coveralls.io/repos/github/wavesurfer-js/wavesurfer.js/badge.svg)](https://coveralls.io/github/wavesurfer-js/wavesurfer.js)
![Size](https://img.shields.io/bundlephobia/minzip/wavesurfer.js.svg?style=flat)

Install development dependencies:

```
npm install
```
Development tasks automatically rebuild certain parts of the library when files are changed (`start` – wavesurfer, `start:plugins` – plugins). Start a dev task and go to `localhost:8080/example/` to test the current build.

Start development server for core library:

```
npm run start
```

Start development server for plugins:

```
npm run start:plugins
```

Build all the files. (generated files are placed in the `dist` directory.)

```
npm run build
```

Running tests only:

```
npm run test
```

Build documentation with esdoc (generated files are placed in the `doc` directory.)
```
npm run doc
```

If you want to use [the VS Code - Debugger for Chrome](https://github.com/Microsoft/vscode-chrome-debug), there is already a [launch.json](.vscode/launch.json) with a properly configured ``sourceMapPathOverrides`` for you.

## Editing documentation
The homepage and documentation files are maintained in the [`gh-pages` branch](https://github.com/wavesurfer-js/wavesurfer.js/tree/gh-pages). Contributions to the documentation are especially welcome.

## Releasing a new version
To release a new version and publish it to NPM, follow the steps below.

 Switch to the master branch and make sure it's up-to-date
 ```
 git checkout master
 git fetch --all; git reset --hard origin/master
```

Run the release script:
```
yarn release
```
This will update the version, generate a changelog, and push everything to a new branch called `release/X.X.X`.

A browser window will open to create a PR from this new branch to the master branch. Once the PR is approved and merged, an automated workflow will kick in and publish a release both on GitHub and NPM.

## Credits

The main maintainer: <img src="https://avatars.githubusercontent.com/u/305679" width="16" height="16" /> [Thijs Triemstra](https://github.com/thijstriemstra)

Many thanks to [all the awesome contributors](https://github.com/wavesurfer-js/wavesurfer.js/contributors)!

## License

[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

This work is licensed under a
[BSD 3-Clause License](https://opensource.org/licenses/BSD-3-Clause).
