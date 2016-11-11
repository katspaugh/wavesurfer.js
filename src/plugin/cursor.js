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
        var my = this;

        this.wavesurfer = wavesurfer;
        this.drawer = this.wavesurfer.drawer;
        this.wrapper = this.drawer.wrapper;

        this.wrapper.addEventListener('mousemove', function (e) {
            my.updateCursorPosition(my.drawer.handleEvent(e));
        });

        this.wrapper.addEventListener('mouseenter', function (e) {
            my.showCursor();
        });

        this.wrapper.addEventListener('mouseleave', function (e) {
            my.hideCursor();
        });

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
