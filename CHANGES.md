wavesurfer.js changelog
=======================

2.1.0 (2018/09/29)
------------------

- Add wavesurfer.js logo, created by @entonbiba (#1409)
- Library version number is now available as `WaveSurfer.VERSION` (#1430)
- Fix `setSinkId` that used deprecated API (#1428)
- Set `isReady` attribute to false when emptying wavesufer (#1396, #1403)
- Microphone plugin: make it work in MS Edge browser (#627)
- Timeline plugin: display more tick marks as user zooms in closely (#1455)
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
- Introduce option to prevent removing media element on destroy (#1163)
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

- Determistic way to mute and unmute a track (#841)
- Replace jasmine with karma / jasmine test suite (#849)
- Regions plugin: fix a bug when clicking on scroll-bar in Firefox (#851)

1.2.1 (01.10.2016)
------------------

- Added changelog (#824)
- Correct AMD module name for plugins (#831)
- Fix to remove small gaps between regions (#834)
