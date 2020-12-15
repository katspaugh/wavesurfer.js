# [wavesurfer.js](https://wavesurfer-js.org)

[![npm version](https://img.shields.io/npm/v/wavesurfer.js.svg?style=flat)](https://www.npmjs.com/package/wavesurfer.js)
![npm](https://img.shields.io/npm/dm/wavesurfer.js.svg) [![Join the chat at https://gitter.im/katspaugh/wavesurfer.js](https://badges.gitter.im/katspaugh/wavesurfer.js.svg)](https://gitter.im/katspaugh/wavesurfer.js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Interactive navigable audio visualization using Web Audio and Canvas.

[![Screenshot](https://raw.githubusercontent.com/katspaugh/wavesurfer.js/gh-pages/example/screenshot.png "Screenshot")](https://wavesurfer-js.org)

See a [tutorial](https://wavesurfer-js.org/docs) and [examples](https://wavesurfer-js.org/examples) on [wavesurfer-js.org](https://wavesurfer-js.org).

## Browser support
wavesurfer.js works only in [modern browsers supporting Web Audio](http://caniuse.com/audio-api).

It will fallback to Audio Element without graphics in other browsers (IE 11 and lower). You can also try [wavesurfer.swf](https://github.com/laurentvd/wavesurfer.swf) which is a Flash-based fallback.

## FAQ
### Can the audio start playing before the waveform is drawn?
Yes, if you use the `backend: 'MediaElement'` option. See here: https://wavesurfer-js.org/example/audio-element/. The audio will start playing as you press play. A thin line will be displayed until the whole audio file is downloaded and decoded to draw the waveform.

### Can drawing be done as file loads?
No. Web Audio needs the whole file to decode it in the browser. You can however load pre-decoded waveform data to draw the waveform immediately. See here: https://wavesurfer-js.org/example/audio-element/ (the "Pre-recoded Peaks" section).

## API in examples

Choose a container:
```html
<div id="waveform"></div>
```
Create an instance, passing the container selector and [options](https://wavesurfer-js.org/docs/options.html):

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

## Upgrade

See the [upgrade](https://github.com/katspaugh/wavesurfer.js/blob/master/UPGRADE.md) document if you're upgrading from a previous version of wavesurfer.js.

## Using with a module bundler

Install Wavesurfer:
```bash
npm install wavesurfer.js --save
# or
yarn add wavesurfer.js
```

Use it with a module system like this:
```javascript
// import
import WaveSurfer from 'wavesurfer.js';

// commonjs/requirejs
var WaveSurfer = require('wavesurfer.js');

// amd
define(['WaveSurfer'], function(WaveSurfer) {
  // ... code
});

```

## Related projects

For a list of  projects using wavesurfer.js, check out
[the projects page](https://wavesurfer-js.org/projects/).

## Development

[![Build Status](https://github.com/katspaugh/wavesurfer.js/workflows/wavesurfer.js/badge.svg?branch=master)](https://github.com/katspaugh/wavesurfer.js/actions?workflow=wavesurfer.js)
[![Coverage Status](https://coveralls.io/repos/github/katspaugh/wavesurfer.js/badge.svg)](https://coveralls.io/github/katspaugh/wavesurfer.js)
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
The homepage and documentation files are maintained in the [`gh-pages` branch](https://github.com/katspaugh/wavesurfer.js/tree/gh-pages). Contributions to the documentation are especially welcome.

## Credits

Initial idea by [Alex Khokhulin](https://github.com/xoxulin). Many
thanks to
[the awesome contributors](https://github.com/katspaugh/wavesurfer.js/contributors)!

## License

[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

This work is licensed under a
[BSD 3-Clause License](https://opensource.org/licenses/BSD-3-Clause).
