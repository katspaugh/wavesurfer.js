wavesurfer.js changelog
=======================

1.4.0 (10.04.2017)
------------------
- A "breaking" change: a new license. We switched to BSD 3 (#1060).
– Reset the mute state on subsequent file loads (#1045)
– A fix for vertical scroll (#1054)
– A new plugin for linguists: `elan-wave-segment` (#1052)


1.3.7 (19.03.2017)
------------------
- A fix for the timeline plugin (#1049)

1.3.6 (19.03.2017)
------------------
- New renderer: `SplitWavePointPlot` (#1048)

1.3.5 (10.03.2017)
------------------
- Add a `getImage` method for MultiCanvas (#1012)
- Add Playlist plugin (#1018)
- Add Playlist plugin sample (#1019)
- Add a new parameter `barHeight` (#1020)
- Add a `playBackRate` method for MediaElement (#1022)

1.3.4 (25.02.2017)
------------------
- Add a new parameter `forceDecode` (#1009)

1.3.3 (23.02.2017)
------------------
- Add Media Session plugin (#996)
- Fix check for AudioContext.close (#998)

1.3.2 (12.02.2017)
------------------
- Add a `getVolume` method (#979)
- Add a `getMute` method (#980)
- Add a `getFilters` method (#982)
- New feature for spectrogram plugin to display frequency labels

1.3.1 (07.02.2017)
------------------
- Add a `getPlaybackRate` method (#936)
- Add a `debounce` utility (#964)
- Fixes for MultiCanvas & peaks cache, a fix the minimap plugin – thanks @entonbiba!

1.3.0 (19.01.2017)
------------------
- MultiCanvas is now the default renderer. Single Canvas will be soon removed.
- Fix backward seeking with Media Element (#918)
- Fix normalize + bar-style waveform (#916)
- New option `partialRender` for better performance with high zoom (#909)

1.2.8 (09.12.2016)
------------------
- PhantomJS support with the MediaElement backend (#875)

1.2.7 (03.12.2016)
------------------
- Timeline bugfixes: correctly unsubscribe on destroy and re-render on zoom (#825, #848)

1.2.6 (19.11.2016)
------------------
- Solve the disappearing canvas problem on zoom (#825)

1.2.5 (19.11.2016)
------------------
- WebAudio backend closes the AudioContext when it is destroyed, unless the AudioContext was passed in as a parameter (params.audioContext)
- The AudioContext is no longer cached in WebAudio.audioContext, use the getter-function WebAudio.getAudioContext. (#862)

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
