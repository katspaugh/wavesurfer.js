# [wavesurfer.js](https://wavesurfer-js.org)

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

### Is wavesurfer.js ES6-compatible?
ES6 refactoring is going on in the `next` branch. In the meanwhile, you can import wavesurfer.js as an ES6 module via WebPack as described [here](https://github.com/katspaugh/wavesurfer.js/issues/767#issuecomment-267768714).

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

## Related projects

For a list of  projects using wavesurfer.js, check out
[the projects page](https://wavesurfer-js.org/projects/).

## Development

[![npm version](https://img.shields.io/npm/v/wavesurfer.js.svg?style=flat)](https://www.npmjs.com/package/wavesurfer.js)
[![npm](https://img.shields.io/npm/dm/wavesurfer.js.svg)]()
[![Build Status](https://travis-ci.org/katspaugh/wavesurfer.js.svg?branch=master)](https://travis-ci.org/katspaugh/wavesurfer.js)

Install `grunt-cli` using npm:

```
npm install -g grunt-cli
```

Install development dependencies:

```
npm install
```

Build a minified version of the library and plugins. This command also checks
for code-style mistakes and runs the tests:

```
grunt
```

Generated files are placed in the `dist` directory.

Running tests only:

```
grunt test
```

Creating a coverage report:

```
grunt coverage
```

The HTML report can be found in `coverage/html/index.html`.

## Editing documentation
The homepage and documentation files are maintained in the [`gh-pages` branch](https://github.com/katspaugh/wavesurfer.js/tree/gh-pages). Contributions to the documentation are especially welcome.

## Credits

Initial idea by [Alex Khokhulin](https://github.com/xoxulin). Many
thanks to
[the awesome contributors](https://github.com/katspaugh/wavesurfer.js/contributors)!

## License

![cc-by](https://i.creativecommons.org/l/by/3.0/88x31.png)

This work is licensed under a
[Creative Commons Attribution 3.0 Unported License](https://creativecommons.org/licenses/by/3.0/deed.en_US).
