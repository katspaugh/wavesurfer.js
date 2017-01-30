import loadScript from 'load-script';

class Init {
    /**
     * Construct Init class
     *
     * @param {Object} WaveSurfer {The WaveSurfer library object}
     * @param {Object} params {initialisation options}
     */
    constructor(WaveSurfer, params = {}) {
        if (!WaveSurfer) {
            throw new Error('WaveSurfer is not available!');
        }

        // cache WaveSurfer
        this.WaveSurfer = WaveSurfer;

        // build parameters, cache them in _params so minified builds are smaller
        const _params = this.params = WaveSurfer.util.extend({}, {
            // wavesurfer parameter defaults so by default the audio player is
            // usable with native media element controls
            defaults: {
                backend: 'MediaElement',
                mediaControls: true
            },
            // containers to instantiate on, can be selector string or HTMLElement
            containers: 'wavesurfer',
            // @TODO insert plugin CDN URIs
            pluginCdnTemplate: '//localhost:8080/plugin/wavesurfer.[name].js',
            // loadPlugin function can be overriden to inject plugin definition
            // objects, this default function uses load-script to load a plugin
            // and pass it to a callback
            loadPlugin(name, cb) {
                const src = _params.pluginCdnTemplate.replace('[name]', name);
                loadScript(src, { async: false }, (err, plugin) => {
                    if (err) {
                        return console.error(`WaveSurfer plugin ${name} not found at ${src}`);
                    }
                    cb(window.WaveSurfer[name]);
                });
            }
        }, params);
        this.containers = typeof _params.containers == 'string'
            ? document.querySelectorAll(_params.containers)
            : _params.containers;
        this.pluginCache = {};
        this.instances = [];

        this.initAllEls();
    }

    /**
     * Initialise all container elements
     */
    initAllEls() {
        // iterate over all the container elements
        Array.prototype.forEach.call(this.containers, el => {
            // load the plugins as an array of plugin names
            const plugins = el.dataset.plugins
                ? el.dataset.plugins.split(',')
                : [];

            // no plugins to be loaded, just render
            if (!plugins.length) {
                return this.initEl(el);
            }
            // … or: iterate over all the plugins
            plugins.forEach((name, i) => {
                // plugin is not cached already, load it
                if (!this.pluginCache[name]) {
                    this.params.loadPlugin(name, lib => {
                        this.pluginCache[name] = lib;
                        // plugins were all loaded, render the element
                        if (i + 1 === plugins.length) {
                            this.initEl(el, plugins);
                        }
                    });
                } else if (i === plugins.length) {
                    // plugin was cached and this plugin was the last
                    this.initEl(el, plugins);
                }
            });
        });
    }

    /**
     * Initialise a single container element and add to this.instances
     *
     * @param  {HTMLElement} el - The Container to instantiate wavesurfer to
     * @param  {plugin[]} plugins - An Array of plugin names to initialise with
     * @return {WaveSurferInstance}
     */
    initEl(el, plugins = []) {
        const jsonRegex = /^[[|{]/;
        // initialise plugins with the correct options
        const initialisedPlugins = plugins.map(plugin => {
            const options = {};
            // the regex to find this plugin attributes
            const attrNameRegex = new RegExp('^' + plugin);
            let attrName;
            // iterate over all the data attributes and find ones for this
            // plugin
            for (attrName in el.dataset) {
                const regexResult = attrNameRegex.exec(attrName);
                if (regexResult) {
                    const attr = el.dataset[attrName];
                    // if the string begins with a [ or a { parse it as JSON
                    const prop = jsonRegex.test(attr) ? JSON.parse(attr) : attr;
                    // this removes the plugin prefix and changes the first letter
                    // of the resulting string to lower case to follow the naming
                    // convention of ws params
                    const unprefixedOptionName = attrName.slice(plugin.length, plugin.length + 1).toLowerCase()
                        + attrName.slice(plugin.length + 1);
                    options[unprefixedOptionName] = prop;
                }
            }
            return this.pluginCache[plugin](options);
        });
        // build parameter object for this container
        const params = this.WaveSurfer.util.extend(
            { container: el },
            this.params.defaults,
            el.dataset,
            { plugins: initialisedPlugins }
        );

        // @TODO make nicer
        el.style.display = 'block';

        // initialise wavesurfer, load audio (with peaks if provided)
        const instance = this.WaveSurfer.create(params);
        const peaks = params.peaks ? JSON.parse(params.peaks) : undefined;
        instance.load(params.url, peaks);

        // push this instance into the instances cache
        this.instances.push(instance);
        return instance;
    }
}

// if window object exists and window.WS_StopAutoInit is not true
if (typeof window === 'object' && !window.WS_StopAutoInit) {
    // call init when document is ready, apply any custom default settings
    // in window.WS_InitOptions
    if (document.readyState === 'complete') {
        window.WaveSurferInit = new Init(window.WaveSurfer, window.WS_InitOptions);
    } else {
        window.addEventListener('load', () => {
            window.WaveSurferInit = new Init(window.WaveSurfer, window.WS_InitOptions);
        });
    }
}

// export init for manual usage
export default Init;
