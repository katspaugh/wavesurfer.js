# [wavesurfer.js](https://wavesurfer-js.org)

[![npm version](https://img.shields.io/npm/v/wavesurfer.js.svg?style=flat)](https://www.npmjs.com/package/wavesurfer.js)
![npm](https://img.shields.io/npm/dm/wavesurfer.js.svg) [![Join the chat at https://gitter.im/wavesurfer-js/wavesurfer.js](https://badges.gitter.im/wavesurfer-js/wavesurfer.js.svg)](https://gitter.im/wavesurfer-js/wavesurfer.js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![GitPOAP Badge](https://public-api.gitpoap.io/v1/repo/wavesurfer-js/wavesurfer.js/badge)](https://www.gitpoap.io/gh/wavesurfer-js/wavesurfer.js)

Interactive navigable audio visualization using Web Audio and Canvas.

[![Screenshot](https://raw.githubusercontent.com/wavesurfer-js/wavesurfer.js/gh-pages/example/screenshot.png "Screenshot")](https://wavesurfer-js.org)

See a [tutorial](https://wavesurfer-js.org/docs) and [examples](https://wavesurfer-js.org/examples) on [wavesurfer-js.org](https://wavesurfer-js.org).

## Questions
Have a question about integrating wavesurfer.js on your website? Feel free to ask in our forum: https://github.com/wavesurfer-js/wavesurfer.js/discussions/categories/q-a

## Quick start

```
npm install wavesurfer.js --save

# or

yarn add wavesurfer.js

# or

<script src="https://unpkg.com/wavesurfer.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
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

## Updating the NPM package
When preparing a new release, update the version in the `package.json` and have it merged to master. The new version of the package will be published to NPM automatically via GitHub Actions.

## Credits

The main maintainer: <img src="https://avatars.githubusercontent.com/u/305679" width="16" height="16" /> [Thijs Triemstra](https://github.com/thijstriemstra)

Many thanks to [all the awesome contributors](https://github.com/wavesurfer-js/wavesurfer.js/contributors)!

## License

[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

This work is licensed under a
[BSD 3-Clause License](https://opensource.org/licenses/BSD-3-Clause).
