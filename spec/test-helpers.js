import WaveSurfer from '../src/wavesurfer.js';

const TestHelpers = {
    /** Example audio clip */
    EXAMPLE_FILE_PATH: '/base/spec/support/demo.wav',

    /** Filesize of example audio clip (in bytes) */
    EXAMPLE_FILE_SIZE: 480158,

    /** Length of example audio clip (in seconds) */
    EXAMPLE_FILE_DURATION: 21,

    /** Example audio clip with waveform */
    EXAMPLE_2_FILE_PATH: '/base/spec/support/stereo.mp3',

    /** Length of example audio clip with waveform (in seconds) */
    EXAMPLE_2_FILE_DURATION: 51,

    /** Example waveform peaks */
    EXAMPLE_JSON_FILE_PATH: '/base/spec/support/stereo-peaks.json',

    createElement(id, type) {
        if (id == undefined) {
            id = WaveSurfer.util.getId('waveform_');
        }
        if (type == undefined) {
            type = 'div';
        }
        let element = document.createElement(type);
        element.id = id;
        document.getElementsByTagName('body')[0].appendChild(element);

        return element;
    },

    removeElement(element) {
        document.getElementsByTagName('body')[0].removeChild(element);
    },

    /**
     * Handle creating wavesurfer UI requirements
     *
     * @param  {Object} options
     */
    createWaveform(options) {
        let element;
        if (options === undefined) {
            element = this.createElement();
        } else {
            element = options.container;
        }

        options = options || {
            container: element,
            waveColor: '#90F09B',
            progressColor: 'purple',
            cursorColor: 'white'
        };
        return [WaveSurfer.create(options), element];
    },

    /**
     * Normalize audio peaks
     *
     * @param  {String} jsonFilePath
     * @param  {function} successHandler
     */
    getPeaks(jsonFilePath, successHandler) {
        fetch(jsonFilePath)
            .then(response => {
                return response.json();
            })
            .then(peaks => {

                const max = peaks.data.reduce((max, el) => (el > max ? el : max));

                return peaks.data.map(el => {
                    return el / max;
                });
            })
            .then(normalizedPeaks => {
                return successHandler(normalizedPeaks);
            });
    }
};

export default TestHelpers;
