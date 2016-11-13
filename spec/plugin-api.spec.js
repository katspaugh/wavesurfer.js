import WaveSurfer from '../src/wavesurfer.js';

describe('Wavesurfer plugin API:', () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

    let waveformDiv;
    let dummyPlugin;
    let wavesurfer;

    // clean up after each test
    afterEach(done => {
        wavesurfer.destroy();
        waveformDiv.parentNode.removeChild(waveformDiv);
        done();
    });

    // utility function to generate a mock plugin object
    function mockPlugin(name, deferInit = false) {
        return {
            name,
            deferInit,
            static: {
                [`${name}Static`]: 'static property value'
            },
            instance: {
                init() {},
                destroy() {}
            }
        }
    }

    // utility function to generate wavesurfer instances for testing
    function __createWaveform(options = {}) {
        waveformDiv = document.createElement('div');
        document.getElementsByTagName('body')[0].appendChild(waveformDiv);

        wavesurfer =  WaveSurfer.create(Object.assign({
            container: waveformDiv
        }, options));
        wavesurfer.load('/base/spec/support/demo.wav');

        return wavesurfer;
    }

    it('adds and calls the plugins init function when adding it with configuration', () => {
        dummyPlugin = mockPlugin('dummy');
        spyOn(dummyPlugin.instance, 'init');
        // register the plugin (= add and initialise automatically)
        wavesurfer = __createWaveform({
            plugins: [
            dummyPlugin
            ]
        });

        expect(Object.getPrototypeOf(wavesurfer.dummy)).toEqual(dummyPlugin.instance);
        expect(wavesurfer.dummyStatic).toEqual(dummyPlugin.static.dummyStatic);
        expect(wavesurfer.dummy.init).toHaveBeenCalledWith(wavesurfer);
    });

    it('adds a plugin but does not call plugin init function it if the plugin property deferInit is truethy', () => {
        dummyPlugin = mockPlugin('dummy', true);
        spyOn(dummyPlugin.instance, 'init');
        // register the plugin (= add and initialise automatically)
        wavesurfer = __createWaveform({
            plugins: [
                dummyPlugin
            ]
        });

        expect(Object.getPrototypeOf(wavesurfer.dummy)).toEqual(dummyPlugin.instance);
        expect(wavesurfer.dummyStatic).toEqual(dummyPlugin.static.dummyStatic);
        expect(wavesurfer.dummy.init).not.toHaveBeenCalled();
    });

    it('adds the plugin when calling addPlugin, calls the plugin init function when calling initPlugin', () => {
        wavesurfer = __createWaveform();
        dummyPlugin = mockPlugin('dummy');

        // add the plugin dynamically
        wavesurfer.addPlugin(dummyPlugin);
        expect(Object.getPrototypeOf(wavesurfer.dummy)).toEqual(dummyPlugin.instance);
        expect(wavesurfer.dummyStatic).toEqual(dummyPlugin.static.dummyStatic);

        // initialise the plugin dynamically
        spyOn(wavesurfer.dummy, 'init');
        wavesurfer.initPlugin('dummy');
        expect(wavesurfer.dummy.init).toHaveBeenCalledWith(wavesurfer);
    });

    it('calls the plugin destroy function when calling destroyPlugin', () => {
        dummyPlugin = mockPlugin('dummy');
        spyOn(dummyPlugin.instance, 'destroy');
        // register the plugin (= add and initialise automatically)
        wavesurfer = __createWaveform({
            plugins: [
            dummyPlugin
            ]
        });
        wavesurfer.destroyPlugin('dummy');
        expect(wavesurfer.dummy.destroy).toHaveBeenCalled();
    });
});