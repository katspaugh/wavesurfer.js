'use strict';

WaveSurfer.Selection = {
	style: WaveSurfer.Drawer.style,

	init: function(wavesurfer) {
		this.wavesurfer = wavesurfer;
		this.wrapper = this.wavesurfer.drawer.wrapper;
		this.selection = null;

		var my = this;

		my.start = null;
		my.end = null;

		var start, end;
		var duration = my.wavesurfer.getDuration();

		var computeProgress = function(e) {
			return my.wavesurfer.drawer.handleEvent(e);
		};

		var mouseDownHandler = function(e) {
			start = computeProgress(e);

			my.clearSelection();

			window.addEventListener('mousemove', mouseMoveHandler);
			window.addEventListener('mouseup', mouseUpHandler);
		};

		var mouseMoveHandler = function(e) {
			end = computeProgress(e);

			my.setSelection(start, end);

			my.wavesurfer.setSeekLock();
		};

		var mouseUpHandler = function() {
			window.removeEventListener('mousemove', mouseMoveHandler);
		};

		var isInsideSelection = function(time) {
			if (!my.hasSelection) {
				return false;
			}

			var startTime = my.start * duration;
			var endTime = my.end * duration;

			return (time >= startTime && time <= endTime);
		};

		my.wrapper.addEventListener('mousedown', mouseDownHandler);

		window.addEventListener('keydown', function(e) {
		    if (e.keyCode == 27) {
				my.clearSelection();
			}
		});

		var playSectionLock = false;

		my.wavesurfer.on('play', function() {
			if (playSectionLock) {
				playSectionLock = false;
				return;
			}

			if (!my.hasSelection)
				return;

			playSectionLock = true;

			var startTime = my.start * duration;
			var endTime = my.end * duration;

			setTimeout(function() {
				my.wavesurfer.play(startTime, endTime);
			});
		});

		this.render();

		this.wavesurfer.on('zoom', this.updateRender.bind(this));
	},

	setSelection: function(start, end) {
		this.start = Math.min(start, end);
		this.end = Math.max(start, end);

		if (this.start < 0) {
			this.start = 0;
		}

		if (this.end > 1) {
			this.end = 1;
		}

		this.hasSelection = true;

		this.updateRender();
	},

	clearSelection: function() {
		this.start = null;
		this.end = null;
		this.hasSelection = false;

		if (this.wavesurfer.isPlaying()) {
			this.wavesurfer.play(this.wavesurfer.getCurrentTime());
		}

		this.updateRender();
	},

	getSelection: function() {
		if (!this.hasSelection) {
			return null;
		}

		return {
			start: this.start,
			end: this.end
		};
	},

	render: function() {
		var my = this;
		var selection = document.createElement('selection');

		selection.className = 'wavesurfer-selection';

		this.style(selection, {
			position: 'absolute',
			height: '100%',
			top: '0px',
		});

		var selectionFill = document.createElement('div');

		this.style(selectionFill, {
			position: 'absolute',
			height: '100%',
			width: '100%',
			backgroundColor: 'rgba(0,0,0,.1)',
			borderLeft: '1px solid rgba(0,0,0,.1)',
			borderRight: '1px solid rgba(0,0,0,.1)',
			pointerEvents: 'none',
			boxSizing: 'border-box',
			zIndex: '2',
		});

		selection.appendChild(selectionFill);

		var handleLeft = selection.appendChild(document.createElement('handle'));
		var handleRight = selection.appendChild(document.createElement('handle'));

		handleLeft.className = 'wavesurfer-handle wavesurfer-handle-start';
		handleLeft.setAttribute('data-handle', 'start');

		handleRight.className = 'wavesurfer-handle wavesurfer-handle-end';
		handleRight.setAttribute('data-handle', 'end');

		var css = {
			cursor: 'col-resize',
			position: 'absolute',
			left: '0px',
			top: '0px',
			width: '1%',
			maxWidth: '4px',
			height: '100%',
			zIndex: '2',
		};

		this.style(handleLeft, css);
		this.style(handleRight, css);

		this.style(handleRight, {
			left: '100%'
		});

		var handleType;
		var currentSelection;

		var computeProgress = function(e) {
			return my.wavesurfer.drawer.handleEvent(e);
		};

		var handleMouseDownHandler = function(e) {
			e.stopPropagation();

			handleType = e.target.getAttribute('data-handle');

			currentSelection = {
				start: my.start,
				end: my.end,
			};

			window.addEventListener('mousemove', handleMouseMoveHandler);
			window.addEventListener('mouseup', handleMouseUpHandler);
		};

		var handleMouseMoveHandler = function(e) {
			var progress = computeProgress(e);
			var start, end;

			if (handleType == 'start') {
				start = progress;
				end = currentSelection.end;
			}

			if (handleType == 'end') {
				start = currentSelection.start;
				end = progress;
			}

			my.setSelection(start, end);

			my.wavesurfer.setSeekLock();
		};

		var handleMouseUpHandler = function() {
			handleType = null;

			window.removeEventListener('mousemove', handleMouseMoveHandler);
			window.removeEventListener('mouseup', handleMouseUpHandler);
		};

		handleLeft.addEventListener('mousedown', handleMouseDownHandler);
		handleRight.addEventListener('mousedown', handleMouseDownHandler);

		this.selection = selection;

		this.updateRender();
	},

	updateRender: function(pxPerSec) {
		if (!this.hasSelection) {
			if (this.selection.parentNode) {
				this.wrapper.removeChild(this.selection);
			}

			return;

		} else {
			if (!this.selection.parentNode) {
				this.wrapper.appendChild(this.selection);
			}
		}

		var canvasWidth;

		if (pxPerSec) {
			canvasWidth = Math.round(this.wavesurfer.getDuration() * pxPerSec);

		} else {
			canvasWidth = this.wrapper.scrollWidth;
		}

		this.style(this.selection, {
			left: ~~(this.start * canvasWidth) + 'px',
			right: canvasWidth - ~~((this.end) * canvasWidth) + 'px',
			cursor: 'default'
		});
	}
};

WaveSurfer.util.extend(WaveSurfer.Selection, WaveSurfer.Observer);


WaveSurfer.enableSelection = function() {
	if (!this.selection) {
		this.selection = Object.create(WaveSurfer.Selection);
		this.selection.init(this);
	}
};

WaveSurfer.clearSelection = function() {
	this.selection && this.selection.clearSelection();
};

WaveSurfer.getSelection = function() {
	var duration = WaveSurfer.getDuration();

	if (this.selection) {
		var selection = this.selection.getSelection();

		return {
			startTime: selection.start * duration,
			endTime: selection.end * duration
		};
	}
};

WaveSurfer.setSelection = function(startTime, endTime) {
	var duration = WaveSurfer.getDuration();

	var start = startTime / duration;
	var end = endTime / duration;

	this.selection && this.selection.setSelection(start, end);
};
