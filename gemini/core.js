gemini.suite('core', core => {
    core
        .setUrl('/gemini/testbed.html')
        .setCaptureElements('.testbed__waveform');

    // WebAudio test suites
    gemini.suite('core: webaudio: basic rendering', webaudio => {
        webaudio
            .before(actions => actions.executeJS(function(win) {
                win._instance = win.WaveSurfer.create({
                    backend: 'WebAudio',
                    container: '.testbed__waveform'
                });
                win._instance.load('/spec/support/demo.wav');
            }))
            .capture('rendering')
            .capture('zooming', actions => actions.executeJS(function(win) {
                win._instance.zoom(200);
            }))
            .capture('skipping', actions => actions.executeJS(function(win) {
                win._instance.skip(5);
            }));
    });

    gemini.suite('core: webaudio: peaks: rendering', webaudio => {
        webaudio
            .before(actions => actions.executeJS(function(win) {
                win._instance = win.WaveSurfer.create({
                    backend: 'WebAudio',
                    container: '.testbed__waveform',
                    responsive: true
                });
                win._instance.load('/spec/support/demo.wav', win.demoPeaks);
            }))
            .capture('rendering')
            .capture('zooming', actions => actions.executeJS(function(win) {
                win._instance.zoom(200);
            }))
            .capture('skipping', actions => actions.executeJS(function(win) {
                win._instance.skip(5);
            }))
            .capture('resize', actions => actions.setWindowSize(300, 1000));
    });

    gemini.suite('core: webaudio: peakcache: rendering', webaudio => {
        webaudio
            .before(actions => actions.executeJS(function(win) {
                win._instance = win.WaveSurfer.create({
                    backend: 'WebAudio',
                    container: '.testbed__waveform',
                    responsive: true,
                    partialRender: true
                });
                win._instance.load('/spec/support/demo.wav');
            }))
            .capture('rendering')
            .capture('zooming', actions => actions.executeJS(function(win) {
                win._instance.zoom(200);
            }))
            .capture('skipping', actions => actions.executeJS(function(win) {
                win._instance.skip(5);
            }))
            .capture('resize', actions => actions.setWindowSize(300, 1000));
    });

    gemini.suite('core: webaudio: peakcache: peaks: rendering', webaudio => {
        webaudio
            .before(actions => actions.executeJS(function(win) {
                win._instance = win.WaveSurfer.create({
                    backend: 'WebAudio',
                    container: '.testbed__waveform',
                    responsive: true,
                    partialRender: true
                });
                win._instance.load('/spec/support/demo.wav', win.demoPeaks);
            }))
            .capture('rendering')
            .capture('zooming', actions => actions.executeJS(function(win) {
                win._instance.zoom(200);
            }))
            .capture('skipping', actions => actions.executeJS(function(win) {
                win._instance.skip(5);
            }))
            .capture('resize', actions => actions.setWindowSize(300, 1000));
    });

    gemini.suite('core: webaudio: custom rendering', webaudio => {
      webaudio
          .before(actions => actions.executeJS(function(win) {
              win._instance = win.WaveSurfer.create({
                  backend: 'WebAudio',
                  container: '.testbed__waveform',
                  responsive: true,
                  waveColor: 'red',
                  progressColor: 'blue',
                  cursorColor: 'yellow',
                  cursorWidth: 3,
                  minPxPerSec:  150
              });
              win._instance.load('/spec/support/demo.wav');
          }))
          .capture('rendering')
          .capture('skipping', actions => actions.executeJS(function(win) {
            win._instance.skip(5);
          }));
    });

    gemini.suite('core: webaudio: responsive', webaudio => {
      webaudio
          .before(actions => actions.executeJS(function(win) {
              win._instance = win.WaveSurfer.create({
                  backend: 'WebAudio',
                  container: '.testbed__waveform',
                  responsive: true
              });
              win._instance.load('/spec/support/demo.wav');
          }))
          .capture('resize', actions => actions.setWindowSize(300, 1000));
    });




    // MediaElement test suites
    gemini.suite('core: mediaelement: basic rendering', webaudio => {
        webaudio
            .before(actions => actions.executeJS(function(win) {
                win._instance = win.WaveSurfer.create({
                    backend: 'MediaElement',
                    container: '.testbed__waveform'
                });
                win._instance.load('/spec/support/demo.wav');
            }))
            .capture('rendering')
            .capture('zooming', actions => actions.executeJS(function(win) {
                win._instance.zoom(200);
            }))
            .capture('skipping', actions => actions.executeJS(function(win) {
                win._instance.skip(5);
            }));
    });

    gemini.suite('core: mediaelement: peaks: rendering', webaudio => {
        webaudio
            .before(actions => actions.executeJS(function(win) {
                win._instance = win.WaveSurfer.create({
                    backend: 'MediaElement',
                    container: '.testbed__waveform',
                    responsive: true
                });
                win._instance.load('/spec/support/demo.wav', win.demoPeaks);
            }))
            .capture('rendering')
            .capture('zooming', actions => actions.executeJS(function(win) {
                win._instance.zoom(200);
            }))
            .capture('skipping', actions => actions.executeJS(function(win) {
                win._instance.skip(5);
            }))
            .capture('resize', actions => actions.setWindowSize(300, 1000));
    });

    gemini.suite('core: mediaelement: peakcache: rendering', webaudio => {
        webaudio
            .before(actions => actions.executeJS(function(win) {
                win._instance = win.WaveSurfer.create({
                    backend: 'MediaElement',
                    container: '.testbed__waveform',
                    responsive: true,
                    partialRender: true
                });
                win._instance.load('/spec/support/demo.wav');
            }))
            .capture('rendering')
            .capture('zooming', actions => actions.executeJS(function(win) {
                win._instance.zoom(200);
            }))
            .capture('skipping', actions => actions.executeJS(function(win) {
                win._instance.skip(5);
            }))
            .capture('resize', actions => actions.setWindowSize(300, 1000));
    });

    gemini.suite('core: mediaelement: peakcache: peaks: rendering', webaudio => {
        webaudio
            .before(actions => actions.executeJS(function(win) {
                win._instance = win.WaveSurfer.create({
                    backend: 'MediaElement',
                    container: '.testbed__waveform',
                    responsive: true,
                    partialRender: true
                });
                win._instance.load('/spec/support/demo.wav', win.demoPeaks);
            }))
            .capture('rendering')
            .capture('zooming', actions => actions.executeJS(function(win) {
                win._instance.zoom(200);
            }))
            .capture('skipping', actions => actions.executeJS(function(win) {
                win._instance.skip(5);
            }))
            .capture('resize', actions => actions.setWindowSize(300, 1000));
    });

    gemini.suite('core: mediaelement: custom rendering', webaudio => {
      webaudio
          .before(actions => actions.executeJS(function(win) {
              win._instance = win.WaveSurfer.create({
                  backend: 'MediaElement',
                  container: '.testbed__waveform',
                  responsive: true,
                  waveColor: 'red',
                  progressColor: 'blue',
                  cursorColor: 'yellow',
                  cursorWidth: 3,
                  minPxPerSec:  150
              });
              win._instance.load('/spec/support/demo.wav');
          }))
          .capture('rendering')
          .capture('skipping', actions => actions.executeJS(function(win) {
            win._instance.skip(5);
          }));
    });

    gemini.suite('core: mediaelement: responsive', webaudio => {
      webaudio
          .before(actions => actions.executeJS(function(win) {
              win._instance = win.WaveSurfer.create({
                  backend: 'MediaElement',
                  container: '.testbed__waveform',
                  responsive: true
              });
              win._instance.load('/spec/support/demo.wav');
          }))
          .capture('resize', actions => actions.setWindowSize(300, 1000));
    });
});