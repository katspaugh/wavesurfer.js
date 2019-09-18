import WaveSurfer from '../src/wavesurfer.js';

const TestHelpers = {
    /** Example audio clip */
    EXAMPLE_FILE_PATH: '/base/spec/support/demo.wav',

    /** Filesize of example audio clip (in bytes) */
    EXAMPLE_FILE_SIZE: 480158,

    /** Length of example audio clip (in seconds) */
    EXAMPLE_FILE_DURATION: 21,

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
    }
};

export default TestHelpers;
