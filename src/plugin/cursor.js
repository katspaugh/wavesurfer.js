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
                this._onDrawerCreated = () => {
                    this.drawer = this.wavesurfer.drawer;
                    this.wrapper = this.drawer.wrapper;

                    this._handleMousemove = (e) => this.updateCursorPosition(this.drawer.handleEvent(e));
                    this.wrapper.addEventListener('mousemove', this._handleMousemove);

                    this._handleMouseenter = () => this.showCursor();
                    this.wrapper.addEventListener('mouseenter', this._handleMouseenter);

                    this._handleMouseLeave = () => this.hideCursor();
                    this.wrapper.addEventListener('mouseleave', this._handleMouseLeave);

                    this.cursor = this.wrapper.appendChild(
                        this.drawer.style(document.createElement('wave'), {
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

                if (this.wavesurfer.drawer) {
                    this._onDrawerCreated();
                }
                this.wavesurfer.on('drawer-created', this._onDrawerCreated);
            },

            destroy() {
                this.wavesurfer.un('drawer-created', this._onDrawerCreated);
                this.cursor.parentNode.removeChild(this.cursor);
                this.wrapper.removeEventListener('mousemove', this._handleMousemove);
                this.wrapper.removeEventListener('mouseenter', this._handleMouseenter);
                this.wrapper.removeEventListener('mouseleave', this._handleMouseLeave);
            },

            updateCursorPosition: function(progress) {
                var pos = Math.round(this.drawer.width * progress) / this.drawer.params.pixelRatio - 1;
                this.drawer.style(this.cursor, { left: pos + 'px' });
            },

            showCursor: function() {
                this.drawer.style(this.cursor, { display: 'block' });
            },

            hideCursor: function() {
                this.drawer.style(this.cursor, { display: 'none' });
            }
        }
    };
}
