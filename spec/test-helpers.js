import WaveSurfer from '../src/wavesurfer.js';

const TestHelpers = {
    /** Example audio clip */
    EXAMPLE_FILE_PATH: '/base/spec/support/demo.wav',

    /** Length of example audio clip */
    EXAMPLE_FILE_DURATION: 21,

    createElement(id, type) {
        if (id == undefined) {
            id = 'waveform_' + WaveSurfer.util.getId();
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
     * Handle creating wavesurfer ui requirements
     *
     * @param  {Object} options
     */
    createWaveform(options) {
        let element = this.createElement();

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
