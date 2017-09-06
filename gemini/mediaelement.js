/* eslint-disable */

// exactly the same as webadio.js, except this tests the media element backend

gemini.suite('mediaelement', situ => {
    situ
        .setUrl('/gemini/testbed.html')
        .setCaptureElements('.testbed__waveform');


    gemini.suite('basic', situ => situ
        .before(actions => actions.executeJS(function(win) {
            win._ws = win.WaveSurfer.create({
                backend: 'MediaElement',
                container: '.testbed__waveform',
                responsive: true
            });
            win._ws.load('/spec/support/demo.wav');
        }))
        .capture('rendering')
        .capture('zooming', actions => actions.executeJS(function(win) {
            win._ws.zoom(200);
        }))
        .capture('skipping', actions => actions.executeJS(function(win) {
            win._ws.skip(5);
        }))
        .capture('zoom-out', actions => actions.executeJS(function(win) {
            win._ws.zoom(false);
        }))
        .capture('resize', actions => actions.setWindowSize(300, 1000))
    );


    gemini.suite('peaks', situ => situ
        .before(actions => actions.executeJS(function(win) {
            win._ws = win.WaveSurfer.create({
                backend: 'MediaElement',
                container: '.testbed__waveform',
                responsive: true
            });
            win._ws.load('/spec/support/demo.wav', win.demoPeaks);
        }))
        .capture('rendering')
        .capture('zooming', actions => actions.executeJS(function(win) {
            win._ws.zoom(200);
        }))
        .capture('skipping', actions => actions.executeJS(function(win) {
            win._ws.skip(5);
        }))
        .capture('zoom-out', actions => actions.executeJS(function(win) {
            win._ws.zoom(false);
        }))
        .capture('resize', actions => actions.setWindowSize(300, 1000))
    );


    gemini.suite('peakcache', situ => situ
        .before(actions => actions.executeJS(function(win) {
            win._ws = win.WaveSurfer.create({
                backend: 'MediaElement',
                container: '.testbed__waveform',
                partialRender: true
            });
            win._ws.load('/spec/support/demo.wav');
        }))
        .capture('rendering')
        .capture('zooming', actions => actions.executeJS(function(win) {
            win._ws.zoom(200);
        }))
        .capture('skipping', actions => actions.executeJS(function(win) {
            win._ws.skip(5);
        }))
    );


    gemini.suite('peakcache+peaks', situ => situ
        .before(actions => actions.executeJS(function(win) {
            win._ws = win.WaveSurfer.create({
                backend: 'MediaElement',
                container: '.testbed__waveform',
                partialRender: true
            });
            win._ws.load('/spec/support/demo.wav', win.demoPeaks);
        }))
        .capture('rendering')
        .capture('zooming', actions => actions.executeJS(function(win) {
            win._ws.zoom(200);
        }))
        .capture('skipping', actions => actions.executeJS(function(win) {
            win._ws.skip(5);
        }))
    );


    gemini.suite('custom', situ => situ
        .before(actions => actions.executeJS(function(win) {
            win._ws = win.WaveSurfer.create({
                backend: 'MediaElement',
                container: '.testbed__waveform',
                responsive: 0,
                waveColor: 'red',
                progressColor: 'blue',
                cursorColor: 'yellow',
                cursorWidth: 3,
                minPxPerSec:  150
            });
            win._ws.load('/spec/support/demo.wav');
        }))
        .capture('rendering')
        .capture('skipping', actions => actions.executeJS(function(win) {
          win._ws.skip(5);
        }))
    );


    gemini.suite('responsive', situ => situ
          .before(actions => actions.executeJS(function(win) {
              win._ws = win.WaveSurfer.create({
                  backend: 'MediaElement',
                  container: '.testbed__waveform',
                  responsive: true
              });
              win._ws.load('/spec/support/demo.wav');
          }))
          .capture('resize', actions => actions.setWindowSize(300, 1000))
    );
});