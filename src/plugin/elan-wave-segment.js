/**
 * @typedef {Object} ElanWaveSegmentPluginParams
 * @property {Object} ELAN The ELAN instance used to parse the elan data.
 * @property {?boolean} deferInit Set to true to manually call
 * @property {?Number} waveSegmentWidth The width of each wave segment (defaults to 200).
 * @property {?Number} waveSegmentPeaksPerSegment The number of peaks that should be drawn (defaults to 400).
 * @property {?Number} waveSegmentHeight The height of each wave segment (defaults to 30).
 * @property {?Number} waveSegmentRenderer The renderer (drawer) to be used for the wave segments.
 * @property {?Number} waveSegmentNormalizeTo What to normalize each wave segment to `[whole, segment, none]`.
 * @property {?Number} waveSegmentBorderWidth The width of the border of the container element.
 * @property {?Number} waveSegmentBarHeight The height of the peaks/bars (defaults to 1).
 */

/**
 * The Elan Wave Segment Plugin for Wavesurfer is based upon the Elan Plugin
 * It uses the timings of the rendered annotations from the ELAN plugin
 * to render a separate wave for each separate line in the annotation table.
 *
 * @implements {PluginClass}
 * @extends {Observer}
 * @example
 * // es6
 * import ELANWaveSegmentPlugin from 'wavesurfer.elan-wave-segment.js';
 *
 * // commonjs
 * var ELANWaveSegmentPlugin = require('wavesurfer.elan-wave-segment.js');
 *
 * // if you are using <script> tags
 * var ELANWaveSegmentPlugin = window.WaveSurfer.elanWaveSegment;
 *
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     ELANWaveSegmentPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */
export default class ELANWaveSegmentPlugin {
    /**
     * Elan Wave Segment plugin definition factory
     *
     * This function must be used to create a plugin definition which can be
     * used by wavesurfer to correctly instantiate the plugin.
     *
     * @param  {ElanWaveSegmentPluginParams} params parameters use to initialise the plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    static create(params) {
        return {
            name: 'elanWaveSegment',
            deferInit: params && params.deferInit ? params.deferInit : false,
            params: params,
            instance: ELANWaveSegmentPlugin
        };
    }

    constructor(params, ws) {
        this.data = null;
        this.params = params;
        this.wavesurfer = ws;
        // array of wavesurfer instances for each line
        this.waveSegments = [];
        // the maximum wave peak
        this.maxPeak = 0;

        this.defaultParams = {
            waveSegmentWidth: 200,
            waveSegmentPeaksPerSegment: 200,
            waveSegmentHeight: 30,
            waveSegmentRenderer: 'MultiCanvas',
            waveSegmentNormalizeTo: 'whole',
            waveSegmentBarHeight: 1,
            waveSegmentBorderWidth: 1,
            pixelRatio:
                window.devicePixelRatio ||
                screen.deviceXDPI / screen.logicalXDPI
        };
    }

    init() {
        // extract relevant parameters (or defaults)
        this.ELAN = WaveSurfer.elan;
        this.waveSegments = [];
        this.maxPeak = 0;

        // determine what we will be normalizing to
        switch (this.params.waveSegmentNormalizeTo) {
            case 'segment':
                this.params.normalize = true;
                break;

            case 'whole':
                this.calculateMaxPeak();
                this.params.noramlize = false;
                break;

            default:
                this.params.normalize = false;
        }
        this.addSegmentColumn();
    }

    /**
     * Calculate the maximum peak in our whole audio clip
     */
    calculateMaxPeak() {
        var totalPeaks =
            this.ELAN.renderedAlignable.length * this.params.waveSegmentWidth;

        var peaks = this.wavesurfer.backend.getPeaks(totalPeaks, 0, totalPeaks);
        var max = WaveSurfer.util.max(peaks);
        var min = WaveSurfer.util.min(peaks);
        this.maxPeak = -min > max ? -min : max;
    }

    /**
     * Uses the table created by Elan and adds a column header for the wave
     * and then loops through each annotation row and creates a wave in each
     */
    addSegmentColumn() {
        // grab all the rows in the ELAN table
        var tableRows = this.ELAN.container.getElementsByTagName('tr');

        // create the header column for the wave forms
        var th = document.createElement('th');
        th.textContent = 'Wave';
        th.className = 'wavesurfer-wave';
        th.setAttribute(
            'style',
            'width: ' + this.params.waveSegmentWidth + 'px'
        );

        // insert wave form column as the second column
        tableRows[0].insertBefore(th, tableRows[0].firstChild.nextSibling);

        // loop through each row and add the table cell for the wave form
        for (var i = 0; i < this.ELAN.renderedAlignable.length; i++) {
            var annotationRow = this.ELAN.getAnnotationNode(
                this.ELAN.renderedAlignable[i]
            );

            //create the td for the wave
            var td = document.createElement('td');
            td.className = 'wavesurfer-wave';

            // create the wave segment
            this.appendWaveSegmentToElement(td, i);

            annotationRow.insertBefore(
                td,
                annotationRow.firstChild.nextSibling
            );
        }
    }

    /**
     * Gets the peaks for the specified start and end times of the segment
     * @param {number} startTime The start time to begin generating peaks
     * @param {number} endTime The end time to stop generating peaks
     * @returns {Array} array of interleaved positive and negative peaks
     */
    getPeaksForTimeSegment(startTime, endTime) {
        var totalDuration = this.wavesurfer.backend.getDuration();
        var segmentDuration = endTime - startTime;

        // calculate the total number of peak by splitting our segment
        var totalPeaks =
            (totalDuration * this.params.waveSegmentPeaksPerSegment) /
            segmentDuration;

        var peakDuration = totalDuration / totalPeaks;

        var startPeak = ~~(startTime / peakDuration);
        var endPeak = ~~(endTime / peakDuration);

        var peaks = this.wavesurfer.backend.getPeaks(
            totalPeaks,
            startPeak,
            endPeak
        );
        var shiftedPeaks = [];
        // shift the peak indexes back to 0
        for (var i in peaks) {
            if (this.params.waveSegmentNormalizeTo == 'whole') {
                shiftedPeaks.push(peaks[i] / this.maxPeak);
            } else {
                shiftedPeaks.push(peaks[i]);
            }
        }
        return shiftedPeaks;
    }

    /**
     * Append the wave segment defined by the elanIndex to the element.
     *
     * @param {HTMLElement} el Target element
     * @param {number} elanIndex ELAN index
     */
    appendWaveSegmentToElement(el, elanIndex) {
        var line = this.ELAN.renderedAlignable[elanIndex];
        var container = document.createElement('div');
        var width = this.params.waveSegmentWidth;

        container.style.width =
            (width + this.params.waveSegmentBorderWidth * 2).toString() + 'px';
        container.style.height =
            this.params.waveSegmentHeight.toString() + 'px';
        container.className = 'elan-wavesegment-container';

        el.appendChild(container);

        var peaks = this.getPeaksForTimeSegment(line.start, line.end);
        var drawerParams = this.params;
        drawerParams.fillParent = true;
        drawerParams.height = this.params.waveSegmentHeight;
        drawerParams.barHeight = this.params.waveSegmentBarHeight;
        drawerParams.plotTimeStart = line.start;
        drawerParams.plotTimeEnd = line.end;
        drawerParams.fillParent = true;
        drawerParams.scrollParent = false;

        // create the wave segment drawer and initialize in the container
        this.waveSegments[elanIndex] = Object.create(
            WaveSurfer.Drawer[this.params.waveSegmentRenderer]
        );
        this.waveSegments[elanIndex].init(container, drawerParams);
        this.waveSegments[elanIndex].drawPeaks(
            peaks,
            this.params.waveSegmentWidth * this.params.pixelRatio,
            0,
            this.params.waveSegmentPeaksPerSegment
        );

        this.waveSegments[elanIndex].updateProgress(0);
    }

    /**
     * Update the progress of the wave segments when time of the audio
     * player is updated.
     *
     * @param {number} time The current time of the audio
     */
    onProgress(time) {
        for (var i = 0; i < this.waveSegments.length; i++) {
            var start = this.ELAN.renderedAlignable[i].start;
            var end = this.ELAN.renderedAlignable[i].end;
            var progress;

            // player has not reached this segment yet - set not started
            if (start > time) {
                progress = 0;
            } else if (end < time) {
                // player has already passed this segment - set complete
                progress = this.params.waveSegmentWidth;
            } else {
                // find what percentage has been complete and set
                var completion = (time - start) / (end - start);
                progress = completion * this.params.waveSegmentWidth;
            }

            this.waveSegments[i].updateProgress(progress);
        }
    }
}
