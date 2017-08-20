gemini.suite('core', function(core) {
    core
      .setUrl('/gemini/testbed.html')
      .setCaptureElements('.waveform');

    gemini.suite('webaudio', function(webaudio) {
      webaudio
        .capture('rendering', function(actions) {
          actions.executeJS(function(window) {
            window.cleanInstance();
            window.createInstance({
              backend: 'WebAudio',
              audioFile: '/spec/support/demo.wav'
            });
          });
        })
        .capture('zooming', function(actions, find) {
          actions.executeJS(function(window) {
            window.INSTANCE.ws.zoom(200);
          });
        });
    });
});