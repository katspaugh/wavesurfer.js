/**
 * cursor plugin
 *
 * @param  {Object} params parameters use to initialise the plugin
 * @return {Object} an object representing the plugin
 */
export default function(params) {
    return {
        name: 'cursor',
        deferInit: params && params.deferInit ? params.deferInit : false,
        static: {
            enableCursor() {
                console.warn('Deprecated enableCursor! Use wavesurfer.initPlugins("cursor") instead!');
                this.initPlugins('cursor');
            }
        },
        extends: ['observer'],
        instance: {
            init: function (wavesurfer) {
                this.wavesurfer = wavesurfer;
                this.style = wavesurfer.util.style;
                this._onDrawerCreated = () => {
                    this.drawer = wavesurfer.drawer;
                    this.wrapper = wavesurfer.drawer.wrapper;

                    this._onMousemove = e => this.updateCursorPosition(this.drawer.handleEvent(e));
                    this.wrapper.addEventListener('mousemove', this._onMousemove);

                    this._onMouseenter = () => this.showCursor();
                    this.wrapper.addEventListener('mouseenter', this._onMouseenter);

                    this._onMouseleave = () => this.hideCursor();
                    this.wrapper.addEventListener('mouseleave', this._onMouseleave);

                    this.cursor = this.wrapper.appendChild(
                        this.style(document.createElement('wave'), {
                            position: 'absolute',
                            zIndex: 3,
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '0',
                            display: 'block',
                            borderRightStyle: 'solid',
                            borderRightWidth: 1 + 'px',
                            borderRightColor: 'black',
                            opacity: '.25',
                            pointerEvents: 'none'
                        })
                    );
                };

                // drawer already existed, just call initialisation code
                if (wavesurfer.drawer) {
                    this._onDrawerCreated();
                }

                // the drawer was initialised, call the initialisation code
                wavesurfer.on('drawer-created', this._onDrawerCreated);
            },

            destroy() {
                this.wavesurfer.un('drawer-created', this._onDrawerCreated);

                // if cursor was appended, remove it
                if (this.cursor) {
                    this.cursor.parentNode.removeChild(this.cursor);
                }

                // if the drawer existed (the cached version referenced in the init code),
                // remove the event listeners attached to it
                if (this.drawer) {
                    this.wrapper.removeEventListener('mousemove', this._onMousemove);
                    this.wrapper.removeEventListener('mouseenter', this._onMouseenter);
                    this.wrapper.removeEventListener('mouseleave', this._onMouseleave);
                }
            },

            updateCursorPosition: function(progress) {
                const pos = Math.round(this.drawer.width * progress) / this.drawer.params.pixelRatio - 1;
                this.style(this.cursor, {
                    left: `${pos}px`
                });
            },

            showCursor: function() {
                this.style(this.cursor, {
                    display: 'block'
                });
            },

            hideCursor: function() {
                this.style(this.cursor, {
                    display: 'none'
                });
            }
        }
    };
}
