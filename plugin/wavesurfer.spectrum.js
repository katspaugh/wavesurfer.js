'use strict';

WaveSurfer.Spectrum = {
    init: function (params) {
        var wavesurfer = this.wavesurfer = params.wavesurfer;

        if (!this.wavesurfer) {
            throw Error('No WaveSurfer instance provided');
        }

        this.params = params;
        this.audioContext = wavesurfer.backend.audiocontext;
        this.backend = wavesurfer.backend;
        this.source = wavesurfer.backend.source; //the audio source
        this.analyser = wavesurfer.backend.analyser;
        this.infoUpdateId = null; //to sotore the setTimeout ID and clear the interval
        this.animationId = null;
        this.allCapsReachBottom = false;
        this.buffer = this.wavesurfer.backend.buffer;
        var drawer = this.drawer = this.wavesurfer.drawer;

        this.container = 'string' == typeof params.container ?
            document.querySelector(params.container) : params.container;

        if (!this.container) {
            throw Error('No container for WaveSurfer spectrogram');
        }

        this.fftSamples = this.params.fftSamples || wavesurfer.params.fftSamples || 512;
        this.colorStop1 = this.params.colorStop1 || 'black';
        this.colorStop2 = this.params.colorStop2 || 'black';
        this.colorStop3 = this.params.colorStop3 || 'red';
        this.capStyle   = this.params.capStyle   || 'pink';
        this.meterWidth = this.params.meterWidth || 10, //width of the meters in the spectrum
        this.gapSpace   = this.params.gapSpace   || 2, //gap between meters
        this.capHeight  = this.params.capHeight  || 2,
        this.height     = this.fftSamples / 2;
        this.width      = drawer.width;

        this.createWrapper();
        this.createCanvas();
        this.render();

        wavesurfer.on('destroy', this.destroy.bind(this));
    },

    destroy: function () {
        this.unAll();
        if (this.wrapper) {
            this.wrapper.parentNode.removeChild(this.wrapper);
            this.wrapper = null;
        }
    },

    createWrapper: function () {
        var prevSpectrogram = this.container.querySelector('spectrogram');
        if (prevSpectrogram) {
            this.container.removeChild(prevSpectrogram);
        }

        var wsParams = this.wavesurfer.params;

        this.wrapper = this.container.appendChild(
            document.createElement('spectrogram')
        );
        this.drawer.style(this.wrapper, {
            display: 'block',
            position: 'relative',
            userSelect: 'none',
            webkitUserSelect: 'none',
            height: this.height + 'px'
        });

        if (wsParams.fillParent || wsParams.scrollParent) {
            this.drawer.style(this.wrapper, {
                width: '100%',
                overflowX: 'hidden',
                overflowY: 'hidden'
            });
        }

        var my = this;
        this.wrapper.addEventListener('click', function (e) {
            e.preventDefault();
            var relX = 'offsetX' in e ? e.offsetX : e.layerX;
            my.fireEvent('click', (relX / my.scrollWidth) || 0);
        });
    },

    createCanvas: function () {
        var canvas = this.canvas = this.wrapper.appendChild(
          document.createElement('canvas')
        );

        this.spectrCc = canvas.getContext('2d');

        this.wavesurfer.drawer.style(canvas, {
            position: 'absolute',
            zIndex: 4
        });
    },

    render: function () {
        this.updateCanvasStyle();
        this.startSpectrum();
    },

    updateCanvasStyle: function () {
        var width = Math.round(this.width / this.pixelRatio) + 'px';
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = width;
    },

    startSpectrum: function() {
        var audioContext = this.audioContext;
        var audioBufferSouceNode = this.source;
        //connect the source to the analyser
        audioBufferSouceNode.connect(this.analyser);
        //connect the analyser to the destination(the speaker), or we won't hear the sound
        //wavesurfer.backend.analyser.connect(audioContext.destination);
        //then assign the buffer to the buffer source node
        audioBufferSouceNode.buffer = this.backend.buffer;
        //play the source
        if (!audioBufferSouceNode.start) {
            audioBufferSouceNode.start = audioBufferSouceNode.noteOn //in old browsers use noteOn method
            audioBufferSouceNode.stop = audioBufferSouceNode.noteOff //in old browsers use noteOn method
        };
        //stop the previous sound if any
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
        }
        audioBufferSouceNode.start(0);
        this.status = 1;
        this.source = audioBufferSouceNode;
        audioBufferSouceNode.onended = function() {
            this.destroy(this);
        };
        this.drawSpectrum();
    },

    drawSpectrum: function() {
        var analyser = this.analyser,
        cwidth = this.canvas.width,
        cheight = this.canvas.height - 1,
        meterWidth = this.meterWidth, //width of the meters in the spectrum
        gap = this.gapSpace, //gap between meters
        capHeight = this.capHeight,
        capStyle = this.capStyle,
        meterNum = 16400 / (10 + 2), //count of the meters
        capYPositionArray = []; ////store the vertical position of hte caps for the preivous frame

        var ctx = this.spectrCc,
        gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(1, this.colorStop1);
        gradient.addColorStop(0.5, this.colorStop2);
        gradient.addColorStop(0, this.colorStop3);
        var drawMeter = function() {
            var array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            if (this.status === 0) {
                //fix when some sounds end the value still not back to zero
                for (var i = array.length - 1; i >= 0; i--) {
                    array[i] = 0;
                };
                this.allCapsReachBottom = true;
                for (var i = capYPositionArray.length - 1; i >= 0; i--) {
                   this.allCapsReachBottom = this.allCapsReachBottom && (capYPositionArray[i] === 0);
                };
                if (this.allCapsReachBottom) {
                    cancelAnimationFrame(this.animationId); //since the sound is top and animation finished, stop the requestAnimation to prevent potential memory leak,THIS IS VERY IMPORTANT!
                    return;
                };
            };
            var step = Math.round(array.length / meterNum); //sample limited data from the total array
            ctx.clearRect(0, 0, cwidth, cheight);
            for (var i = 0; i < meterNum; i++) {
                var value = array[i * step];
                if (capYPositionArray.length < Math.round(meterNum)) {
                    capYPositionArray.push(value);
                };
                ctx.fillStyle = capStyle;
                //draw the cap, with transition effect
                if (value < capYPositionArray[i]) {
                    ctx.fillRect(i, cheight - (--capYPositionArray[i]), meterWidth, capHeight);
                } else {
                    ctx.fillRect(i, cheight - value, meterWidth, capHeight);
                    capYPositionArray[i] = value;
                };
                ctx.fillStyle = gradient; //set the filllStyle to gradient for a better look
                ctx.fillRect(i /*meterWidth+gap*/ , cheight - value + capHeight, meterWidth, cheight); //the meter
            }
            this.animationId = requestAnimationFrame(drawMeter);
        }
        this.animationId = requestAnimationFrame(drawMeter);
    }
};

WaveSurfer.util.extend(WaveSurfer.Spectrum, WaveSurfer.Observer);