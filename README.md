# [wavesurfer.js](https://wavesurfer-js.org)

# Read below how to update to version 2!

[![npm version](https://img.shields.io/npm/v/wavesurfer.js.svg?style=flat)](https://www.npmjs.com/package/wavesurfer.js)
![npm](https://img.shields.io/npm/dm/wavesurfer.js.svg) [![Join the chat at https://gitter.im/katspaugh/wavesurfer.js](https://badges.gitter.im/katspaugh/wavesurfer.js.svg)](https://gitter.im/katspaugh/wavesurfer.js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Interactive navigable audio visualization using Web Audio and Canvas.

[![Screenshot](https://raw.githubusercontent.com/katspaugh/wavesurfer.js/gh-pages/example/screenshot.png "Screenshot")](https://wavesurfer-js.org)

See a [tutorial](https://wavesurfer-js.org/docs) and [examples](https://wavesurfer-js.org/examples) on [wavesurfer-js.org](https://wavesurfer-js.org).

## Browser support
wavesurfer.js works only in [modern browsers supporting Web Audio](http://caniuse.com/audio-api).

It will fallback to Audio Element in other browsers (without graphics). You can also try [wavesurfer.swf](https://github.com/laurentvd/wavesurfer.swf) which is a Flash-based fallback.

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

**Note on version 2**: The wavesurfer.js core library and the plugins were refactored to be modular so it can be used with a module bundler. (You can still use wavesurfer without, e.g. with `<script>` tags) The code was also updated to ES6/ES7 syntax and is transpiled with babel and webpack. Read below how to update your code.

## Upgrading to version 2

The API has mostly stayed the same but there are some changes to consider:

1. **MultiCanvas renderer is now the default:** It provides all functionality of the Canvas renderer. – Most likely you can simply remove the renderer option – The Canvas renderer has been removed. (The `renderer` option still exists but wavesurfer expects it to be a renderer object, not merely a string.)

2. **Constructor functions instead of object constructors**

```javascript
// Old:
var wavesurfer = Object.create(WaveSurfer);
Wavesurfer.init(options);

// New:
var wavesurfer = WaveSurfer.create(options);
// ... or
var wavesurfer = new WaveSurfer(options);
wavesurfer.init();
```

3. **New plugin API:** Previously all plugins had their own initialisation API. The new API replaces all these different ways to do the same thing with one plugin API built into the core library. Plugins are now added as a property of the wavesurfer configuration object during creation. You don't need to initialise the plugins yourself anymore. Below is an example of initialising wavesurfer with plugins (Note the different ways to import the library at the top):

```javascript
// EITHER - accessing modules with <script> tags
var WaveSurfer = window.WaveSurfer;
var TimelinePlugin = window.WaveSurfer.timeline;
var MinimapPlugin = window.WaveSurfer.minimap;

// OR - importing as es6 module
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js';
import MinimapPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.minimap.min.js';

// OR - importing as require.js/commonjs modules
var WaveSurfer = require('wavesurfer.js');
var TimelinePlugin = require('wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js');
var MinimapPlugin = require('wavesurfer.js/dist/plugin/wavesurfer.minimap.min.js');

// ... initialising waveform with plugins
var wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: 'violet',
    plugins: [
        TimelinePlugin.create({
            container: '#wave-timeline'
        }),
        MinimapPlugin.create()
    ]
});
```

**Note:** Read more about the plugin API in the documentation.

## Using with a module bundler

Wavesurfer can be used with a module system like this:
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

[![npm version](https://img.shields.io/npm/v/wavesurfer.js.svg?style=flat)](https://www.npmjs.com/package/wavesurfer.js)
[![npm](https://img.shields.io/npm/dm/wavesurfer.js.svg)]()
[![Build Status](https://travis-ci.org/katspaugh/wavesurfer.js.svg?branch=master)](https://travis-ci.org/katspaugh/wavesurfer.js)

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
