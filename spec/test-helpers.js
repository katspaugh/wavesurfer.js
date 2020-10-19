import WaveSurfer from '../src/wavesurfer.js';
import fetchFile from '../src/util/fetch.js';

const TestHelpers = {
    /** Example audio clip */
    EXAMPLE_FILE_PATH: '/base/spec/support/demo.wav',

    /** Filesize of example audio clip (in bytes) */
    EXAMPLE_FILE_SIZE: 480158,

    /** Length of example audio clip (in seconds) */
    EXAMPLE_FILE_DURATION: 21,

    /** Example stero audio clip with waveform */
    EXAMPLE_STEREO_FILE_PATH: '/base/spec/support/stereo.mp3',

    /** Length of example audio clip with waveform (in seconds) */
    EXAMPLE_STEREO_FILE_DURATION: 51,

    /** Example waveform peaks */
    EXAMPLE_STEREO_FILE_JSON_PATH: '/base/spec/support/stereo-peaks.json',

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
        fetchFile({
            url: jsonFilePath,
            responseType: 'json'
        }).on(
            'success',
            peaks => {
                const max = peaks.data.reduce((max, el) => (el > max ? el : max));
                const normalizedPeaks = peaks.data.map(el => el / max);
                return successHandler(normalizedPeaks);
            }
        );
    }
};

export default TestHelpers;
