'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load
document.addEventListener('DOMContentLoaded', function () {
    var playButton = document.querySelector('#playBtn'),
        toggleMuteButton = document.querySelector('#toggleMuteBtn'),
        setMuteOnButton = document.querySelector('#setMuteOnBtn'),
        setMuteOffButton = document.querySelector('#setMuteOffBtn');

    // Init wavesurfer
var prog1='#f50',prog2='#f00'; 
    wavesurfer.init({
        container     : '#waveform',
        waveColor     : 'white',
        interact      : false,
        cursorWidth   : 0,
        progressColor : prog1,
        progressColor2: prog2
    });

    wavesurfer.load('../media/demo.wav');

    wavesurfer.on('ready', function() {
        playButton.onclick = function() {
            wavesurfer.playPause();
        };

        toggleMuteButton.onclick = function() {
            wavesurfer.toggleMute();
        }

        setMuteOnButton.onclick = function() {
            wavesurfer.setMute(true);
        }

        setMuteOffButton.onclick = function() {
            wavesurfer.setMute(false);
        }
    });
    
/*You need to modify the wave wave and shit using closest/find or whateva suit yourself its just example not recoomended method*/
        wavesurfer.container.addEventListener('mousemove', (e) => {
          var wl = $('wave wave').last();
          var wf = $('wave wave').first();
          var x = e.pageX - wl.offset().left;
          var wfw = wf.width();
          if(x > wfw){	
            wl
            .css('z-index',1)
            .width(x);
          }else{
            wl
            .css('z-index',3)
            .width(x);  

            wavesurfer.params.progressColor2 = prog1; 
            wavesurfer.params.progressColor = prog2; 
            wavesurfer.drawBuffer();
          }
        });

        wavesurfer.container.addEventListener('mouseleave', (e) => {
          wavesurfer.params.progressColor = prog1; 
          wavesurfer.params.progressColor2 = prog2; 
          $('wave wave').last().width(0);
          wavesurfer.drawBuffer();
        });
    
});
