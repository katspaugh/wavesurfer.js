import WaveSurfer from '../src/wavesurfer.js';

/** @test {WaveSurfer} */
describe('WaveSurfer/plugin API:', () => {
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
            extends: 'observer',
            instance: Observer => class MockPlugin extends Observer {
                constructor(wavesurfer) {
                    super();
                    this.wavesurfer = wavesurfer;
                    // using the instance factory unfortunately makes it
                    // difficult to use the spyOn function, so we use this
                    // instead
                    this.isInitialised = false;
                }
                init() {
                    this.isInitialised = true;
                }
                destroy() {}
            }
        };
    }

    // utility function to generate wavesurfer instances for testing
    function __createWaveform(options = {}) {
        waveformDiv = document.createElement('div');
        document.getElementsByTagName('body')[0].appendChild(waveformDiv);

        wavesurfer =  WaveSurfer.create(Object.assign({
            container: waveformDiv
        }, options));
        wavesurfer.load('/base/spec/support/demo.wav');
    }

    // plugin methods
    /** @test {WaveSurfer#addPlugin} */
    it('addPlugin adds static properties and correctly builds and instantiates plugin class', () => {
        dummyPlugin = mockPlugin('dummy');
        __createWaveform();
        wavesurfer.addPlugin(dummyPlugin);

        expect(wavesurfer.dummyStatic).toEqual(dummyPlugin.static.dummyStatic);
        expect(wavesurfer.dummy.wavesurfer).toEqual(wavesurfer);
        expect(Object.getPrototypeOf(wavesurfer.dummy).constructor.name === 'Observer');
    });

    /** @test {WaveSurfer#initPlugin} */
    it('initPlugin calls init function of the plugin and adds its name to the initialisedPluginList', () => {
        dummyPlugin = mockPlugin('dummy');
        __createWaveform();
        wavesurfer.addPlugin(dummyPlugin);
        spyOn(wavesurfer.dummy, 'init');
        wavesurfer.initPlugin('dummy');

        expect(wavesurfer.dummy.init).toHaveBeenCalled();
        expect(wavesurfer.initialisedPluginList.dummy).toBeTrue();
    });

    /** @test {WaveSurfer#destroyPlugin} */
    it('destroyPlugin calls plugin destroy function and removes the plugin name from the initialisedPluginList', () => {
        dummyPlugin = mockPlugin('dummy');
        __createWaveform();
        wavesurfer.addPlugin(dummyPlugin);
        wavesurfer.initPlugin('dummy');
        spyOn(wavesurfer.dummy, 'destroy');
        wavesurfer.destroyPlugin('dummy');

        expect(wavesurfer.dummy.destroy).toHaveBeenCalled();
        expect(wavesurfer.initialisedPluginList.dummy).toBeUndefined();
    });

    // auto-adding and initialising of plugins (registerPlugins)
    /** @test {WaveSurfer#registerPlugins} */
    it('registerPlugin adds a plugin but does not call plugin init function if the plugin property deferInit is truethy', () => {
        dummyPlugin = mockPlugin('dummy', true);
        __createWaveform({
            plugins: [
                dummyPlugin
            ]
        });
        expect(wavesurfer.dummyStatic).toEqual(dummyPlugin.static.dummyStatic);
        expect(wavesurfer.dummy.wavesurfer).toEqual(wavesurfer);
        expect(wavesurfer.dummy.isInitialised).toBeFalse();
    });

    /** @test {WaveSurfer#registerPlugins} */
    it('registerPlugin adds a plugin ands calls plugin init function if the plugin property deferInit is falsey', () => {
        dummyPlugin = mockPlugin('dummy');
        __createWaveform({
            plugins: [
                dummyPlugin
            ]
        });
        expect(wavesurfer.dummyStatic).toEqual(dummyPlugin.static.dummyStatic);
        expect(wavesurfer.dummy.wavesurfer).toEqual(wavesurfer);
        expect(wavesurfer.dummy.isInitialised).toBeTrue();
    });
});