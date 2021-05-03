'use strict';

import CursorCustomPlugin from './custom-plugin/CursorCustomPlugin.js';

var wavesurfer;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    let pluginOptions = {
        minimap: {
            waveColor: '#777',
            progressColor: '#222',
            height: 30
        },
        timeline: {
            container: '#wave-timeline'
        },
        spectrogram: {
            container: '#wave-spectrogram'
        },
        cursorCustom: {},
        regions: {
            regions: [
                {
                    start: 1,
                    end: 3,
                    color: 'hsla(400, 100%, 30%, 0.5)'
                },
                {
                    start: 4,
                    end: 5.4
                },
                {
                    start: 6.22,
                    end: 7.1
                }
            ]
        },
        elan: {
            url: '../elan/transcripts/001z.xml',
            container: '#annotations',
            tiers: {
                Text: true,
                Comments: true
            }
        }
    };
    let options = {
        container: '#waveform',
        waveColor: 'violet',
        progressColor: 'purple',
        loaderColor: 'purple',
        cursorColor: 'navy',
        plugins: [WaveSurfer.minimap.create(pluginOptions.minimap)]
    };

    if (location.search.match('scroll')) {
        options.minPxPerSec = 100;
        options.scrollParent = true;
    }

    if (location.search.match('normalize')) {
        options.normalize = true;
    }

    // Init wavesurfer
    wavesurfer = WaveSurfer.create(options);

    [].forEach.call(
        document.querySelectorAll('[data-activate-plugin]'),
        function(el) {
            let activePlugins = wavesurfer.initialisedPluginList;
            Object.keys(activePlugins).forEach(function(name) {
                if (el.dataset.activatePlugin === name) {
                    el.checked = true;
                }
            });
        }
    );

    [].forEach.call(
        document.querySelectorAll('[data-activate-plugin]'),
        function(el) {
            el.addEventListener('change', function(e) {
                let pluginName = e.currentTarget.dataset.activatePlugin;
                let activate = e.target.checked;
                let options = pluginOptions[pluginName] || {};
                let plugin;
                if (pluginName === 'cursorCustom') {
                    plugin = CursorCustomPlugin.create(options);
                } else {
                    plugin = WaveSurfer[pluginName].create(options);
                }
                if (activate) {
                    wavesurfer.addPlugin(plugin).initPlugin(pluginName);
                } else {
                    wavesurfer.destroyPlugin(pluginName);
                }
            });
        }
    );

    /* Progress bar */
    (function() {
        let progressDiv = document.querySelector('#progress-bar');
        let progressBar = progressDiv.querySelector('.progress-bar');

        let showProgress = function(percent) {
            progressDiv.style.display = 'block';
            progressBar.style.width = percent + '%';
        };

        let hideProgress = function() {
            progressDiv.style.display = 'none';
        };

        wavesurfer.on('loading', showProgress);
        wavesurfer.on('ready', hideProgress);
        wavesurfer.on('destroy', hideProgress);
        wavesurfer.on('error', hideProgress);
    })();

    wavesurfer.load('../media/demo.wav');
});
