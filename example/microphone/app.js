'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load
document.addEventListener('DOMContentLoaded', function () {
 var options = {
     container     : '#waveform',
     waveColor     : 'black',
     loopSelection : false,
     cursorWidth   : 0
 };

 // Init wavesurfer
 wavesurfer.init(options);

 // Init Microphone plugin
 var microphone = Object.create(WaveSurfer.Microphone);
 microphone.init({
     wavesurfer: wavesurfer
 });

 // start/stop mic on click
 micBtn.onclick = function() {
	 if (microphone.active) {
		 microphone.stop();
	 } else {
		 microphone.start();
	 }
 };

});