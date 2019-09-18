# Upgrade

## Upgrading to version 3 from version 2

- `util.ajax` was deprecated; use `util.fetchFile instead.
- The `xhr` wavesurfer option has changed to work with `util.fetchFile`.
- The `MultiCanvas` renderer was refactored and a new `CanvasEntry` class was added to represent
  a canvas instance in a `MultiCanvas`.

## Upgrading to version 2 from version 1

The wavesurfer.js core library and the plugins were refactored to be modular so it can be used with a module bundler.
You can still use wavesurfer without, e.g. with `<script>` tags. The code was also updated to ES6/ES7 syntax and
is transpiled with Babel and Webpack. Read below how to update your code.

The API has mostly stayed the same but there are some changes to consider:

1. **MultiCanvas renderer is now the default:** It provides all functionality of the Canvas renderer. – Most likely you
can simply remove the renderer option – The Canvas renderer has been removed. (The `renderer` option still exists but
wavesurfer expects it to be a renderer object, not merely a string.)

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

3. **New plugin API:** Previously all plugins had their own initialisation API. The new API replaces all
these different ways to do the same thing with one plugin API built into the core library. Plugins are now
added as a property of the wavesurfer configuration object during creation. You don't need to initialise the
plugins yourself anymore. Below is an example of initialising wavesurfer with plugins (Note the different ways
to import the library at the top):

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
