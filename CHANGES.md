wavesurfer.js changelog
=======================

3.3.3 (16.04.2020)
------------------

- Change default `desynchronized` drawing context attribute to `false` (#1908)

3.3.2 (07.04.2020)
------------------

- Use `requestAnimationFrame` for clearWave (#1884)
- Fix `Unable to get property 'toLowerCase' of undefined or null reference`
  in IE11 (#1771)
- Spectrogram plugin: correct the hamming windfunc formula (#1850)

3.3.1 (13.01.2020)
------------------

- Regions plugin:
  - Improve handles style support (#1839)
  - Add support for a context menu event on a region (#1844)
  - Fix for handle position when using `channelIdx` param (#1845)

3.3.0 (29.12.2019)
------------------

- `wavesurfer.exportPCM` now accepts an optional `end` argument and returns
  a Promise (#1728)
- Add `wavesurfer.setPlayEnd(position)` to set a point in seconds for
  playback to stop at (#1795)
- Add `drawingContextAttributes` option and enable canvas `desynchronized`
  hint (#1642)
- Add `barMinHeight` option (#1693)
- Expose progress to the `dblclick` event (#1790)
- Deprecate `util.extend` and replace usage with `Object.assign` (#1825)
- Regions plugin:
  - Add `start` argument to `play` and `playLoop` methods (#1794)
  - Add `maxRegions` option to limit max numbers of created regions (#1793)
  - Don't assign to module object (#1823)
  - Allow setting the `handleColor` inside `addRegion` (#1798)
  - Disable drag selection before enabling it (#1698)
  - Add `channelIdx` option to select specific channel to draw on (#1829)
  - Refactor for improved readability (#1826)
- Cursor plugin: fix time visibility (#1802)

3.2.0 (24.10.2019)
------------------

- New `MediaElementWebAudio` backend (#1767):
  - Allows you to use Web Audio API with big audio files, loading audio
    like with MediaElement backend (HTML5 audio tag), so you can use the
    same methods of MediaElement backend for loading and playback. This way,
    the audio resource is not loaded entirely from server, but in ranges,
    allowing you to use WebAudio features, like filters, on audio files with
    a long duration. You can also supply peaks data, so the entire audio file
    does not have to be decoded.
    For example:
    ```
    wavesurfer.load(url | HTMLMediaElement, peaks, preload, duration);
    wavesurfer.play();
    wavesurfer.setFilter(customFilter);
    ```
- Add `barRadius` option to create waveforms with rounded bars (#953)
- Throw error when the url parameter supplied to `wavesurfer.load()`
  is empty (#1773, #1775)
- Specify non-minified wavesurfer.js in `main` entry of `package.json` (#1759)
- Add `dblclick` event listener to wavesurfer wrapper (#1764)
- Fix `destroy()` in `MediaElement` backend (#1778)
- Cursor plugin: flip position of time text to left of the cursor where needed
  to improve readability (#1776)
- Regions plugin: change region end handler position (#1762, #1781)

3.1.0 (26.09.2019)
------------------

- Add `autoCenter` and `autoCenterRate` options (#1699)
- Make sure `isReady` is true before firing the `ready` event (#1749)
- Improve fetch error messages (#1748)
- Use `MediaElement` backend for browsers that don't support WebAudio (#1739)
- Regions plugin:
  - Use `isResizing` and `isDragging` to filter events in
    region-updated listener (#1716)
  - Fix `playLoop` and `loop` option for clips with duration <15s (#1626)
- Spectrogram plugin: fix variable name in click handler (#1742)
- Minimap plugin: fix left/width calculations for regions on retina/4k
  screens (#1743)
- New example: video-annotation (#1726)

3.0.0 (11.07.2019)
------------------

- Add `wavesurfer.getActivePlugins()`: return map of plugins
  that are currently initialised
- Replace usage of `util.ajax` with `util.fetchFile` (#1365)
- Update progress when seeking with HTML media controls (#1535)
- Make sure mute/volume is updated when using `MediaElement` backend (#1615)
- Refactor `MultiCanvas` and add `CanvasEntry` class (#1617)
- Fix `wavesurfer.isReady`: make it a public boolean, the
  broken `isReady` method is removed (#1597)
- Add support for `Blob` output type in `wavesurfer.exportImage` (#1610)
- Fix fallback to Audio Element in browsers that don't support Web Audio (#1614)
- `util.getId()` now accepts a `prefix` argument (#1619)
- Improve documentation for `xhr` option (#1656)
- Fix: the `progressWave` should not be rendered when specifying the same
  value for the `progressColor` and `waveColor` options (#1620)
- Cursor plugin:
  - Add `formatTimeCallback` option
  - Add `followCursorY` option (#1605)
  - Remove deprecated `enableCursor` method (#1646)
  - Hide the cursor elements before first mouseover if `hideOnBlur` is set (#1663)
- Spectrogram plugin:
  - Fix `ready` listener when loading multiple audio files (#1572)
  - Allow user to specify a colorMap (#1436)
- Regions plugin:
  - Fix `ready` listener when loading multiple audio files (#1602)
  - Add `snapToGridInterval` and `snapToGridOffset` options (#1632)
  - Allow drawing regions over existing regions, if the underlying ones are not
    draggable or resizable (#1633)
  - Calculate the duration at event time to allow predefined regions to be
    dragged and resized (#1673)
  - Remove deprecated `initRegions` method (#1646)
- Timeline plugin: fix `ready` listener when loading multiple
  audio files
- Minimap plugin: remove deprecated `initMinimap` method (#1646)

Check `UPGRADE.md` for backward incompatible changes since v2.x.

2.2.1 (18.03.2019)
------------------

- Add `backgroundColor` option (#1118)
- Spectrogram plugin: fix click handler (#1585)
- Cursor plugin: fix `displayTime` (#1589)

2.2.0 (07.03.2019)
------------------

- Add `rtl` option (#1296)
- Fix peaks rendering issue on zooming and scrolling multicanvas (#1570)
- Add `duration` option to specify an explicit audio length (#1441)
- Spectrogram plugin: fix event listener removal (#1571)
- Regions plugin: display regions before file load using `duration`
  option (#1441)
- Build: switch to terser-webpack-plugin for minifying

2.1.3 (21.01.2019)
------------------

- Fix removeOnAudioProcess for Safari (#1215, #1367, #1398)

2.1.2 (06.01.2019)
------------------

- Fix computing peaks when buffer is not set (#1530)
- Cursor plugin: fix displayed time (#1543)
- Cursor plugin: document new params (#1516)
- Add syntax highlighting in examples (#1522)

2.1.1 (18.11.2018)
------------------

- Fix order of arguments for PluginClass.constructor (#1472)
- Microphone plugin: Safari support (#1377)
- Minimap plugin: fix styling issues and add support for zooming (#1464)
- Timeline plugin: add duration parameter handling (#1491)
- Cursor plugin: add showTime option (#1143)
- Fix: progress bar did not reach 100% when audio file is small (#1502)

2.1.0 (29.09.2018)
------------------

- Add wavesurfer.js logo, created by @entonbiba (#1409)
- Library version number is now available as `WaveSurfer.VERSION` (#1430)
- Fix `setSinkId` that used deprecated API (#1428)
- Set `isReady` attribute to false when emptying wavesufer (#1396, #1403)
- Microphone plugin: make it work in MS Edge browser (#627)
- Timeline plugin: display more tick marks as the user zooms in closely (#1455)
- Cursor plugin: fix `destroy` (#1435)

2.0.6 (14.06.2018)
------------------

- Build library using webpack 4 (#1376)
- Add `audioScriptProcessor` option to use custom script processor node (#1389)
- Added `mute` and `volume` events (#1345)

2.0.5 (26.02.2018)
------------------

- Fix `util.ajax` on iterating `requestHeaders` (#1329)
- Add version information to distributed files (#1330)
- Regions plugin: prevent click when creating / updating region (#1295)
- Add `wavesurfer.isReady` method (#1333)

2.0.4 (14.02.2018)
------------------

- Added `xhr` option to configure util.ajax for authorization (#1310, #1038, #1100)
- Fix `setCurrentTime` method (#1292)
- Fix `getScrollX` method: Check bounds when `scrollParent: true` (#1312)
- Minimap plugin: fix initial load, canvas click did not work (#1265)
- Regions plugin: fix dragging a region utside of scrollbar (#430)

2.0.3 (22.01.2018)
------------------

- Added support for selecting different audio output devices using `setSinkId` (#1293)
- Replace deprecated playbackRate.value setter (#1302)
- Play method now properly returns a Promise (#1229)

2.0.2 (10.01.2018)
------------------

- Added `barGap` parameter to set the space between bars (#1058)
- Replace deprecated gain.value setter (#1277)
- MediaElement backend: Update progress on pause events (#1267)
- Restore missing MediaSession plugin (#1286)

2.0.1 (18.12.2017)
------------------

- Core library and the plugins were refactored to be modular so it can be used with a module bundler
- Code updated to ES6/ES7 syntax and is transpiled with babel and webpack
- New plugin API
- `MultiCanvas` renderer is now the default
- Added getters and setters for height and color options (#1145)
- Introduce an option to prevent removing media element on destroy (#1163)
- Added duration parameter for the load function (#1239)
- New soundtouch.js filter to preserve pitch when changing tempo (#149)
- Add `getPlaybackRate` method (#1022) 
- Switched to BSD license (#1060)
- Added `setCurrentTime` method
- Added `util.debounce` (#993) 

1.2.4 (11.11.2016)
------------------

- Fix a problem of Web Audio not playing in Safari on initial load (#749)

1.2.3 (09.11.2016)
------------------

- Add a 'waveform-ready' event, triggered when waveform is drawn with MediaElement backend (#736)
- Add a 'preload' parameter to load function to choose the preload HTML5 audio attribute value if MediaElement backend is choosen (#854)

1.2.2 (31.10.2016)
------------------

- Deterministic way to mute and unmute a track (#841)
- Replace jasmine with karma / jasmine test suite (#849)
- Regions plugin: fix a bug when clicking on scroll-bar in Firefox (#851)

1.2.1 (01.10.2016)
------------------

- Added changelog (#824)
- Correct AMD module name for plugins (#831)
- Fix to remove small gaps between regions (#834)
