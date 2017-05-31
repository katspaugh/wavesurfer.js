/**
 * This is a drawer which extends the canvas drawer but adds a separate point plot graph
 * so two separate forms are drawn, one the wave and the other the plot.
 * The plot information needs to be sent as an array of objects containing the time and value
 * e.g. plotArray: [{time: 1.01, value: 0.12},{time: 1.03}, value: 0.14}]
 * or via the url of a file which contains the plot data
 * e.g
 * 1.01   0.12
 * 1.03   0.14
 *
 *
 * Params which can be sent in as initialization values are the following
 * - plotArray:               array of objects with time and plot (required unless plotFileUrl is set)
 * - plotFileUrl:             url of the file that contains the plot information (required unless plotArray is set)
 * - plotNormalizeTo:         [whole/segment/none/values] - what value to normalize the plot to (defaults to "whole")
 * - plotMin:                 the minimum value to normalize points to.  Any value below this will be ignored (defaults to 0)
 * - plotMax:                 the maximum value to normalize points to.  Any value above this will be ignored (defaults to 1)
 * - plotTimeStart:           the time included in the plot file which corresponds with the start of the displayed wave (defaults to 0)
 * - plotTimeEnd:             the time included in the plot file which corresponds with the end of the displayed wave (defaults maximum plot time)
 * - plotColor:               the color of the plot (defaults to #f63)
 * - plotProgressColor :      the color of the progress plot (defaults to '#F00')
 * - plotFileDelimiter:       the delimiter which separates the time from the value in the plot file (defaults to tab characater = "\t")
 * - plotPointHeight:         the canvas height of each plot point (defaults to 2)
 * - plotPointWidth:          the canvas width of each plot point (defaults to 2)
 * - plotSeparator:           boolean indicating a separator should be included between the wave and point plot
 * - plotRangeDisplay:        boolean indicating if the min and max range should be displayeda (defaults to false)
 * - plotRangePrecision:      integer determining the precision of the displayed plot range
 * - plotRangeUnits:          units appended to the range
 * - plotRangeFontSize:       the font for displaying the range - defaults to 20
 * - plotRangeFontType:       the font type for displaying range - defaults to Ariel
 * - plotRangeIgnoreOutliers: boolean indicating if values outside of range should be ignored or plotted at min/max
 */


'use strict';

WaveSurfer.Drawer.SplitWavePointPlot = Object.create(WaveSurfer.Drawer.Canvas);

WaveSurfer.util.extend(WaveSurfer.Drawer.SplitWavePointPlot, {

    defaultPlotParams: {
        plotNormalizeTo: 'whole',
        plotTimeStart: 0,
        plotMin: 0,
        plotMax: 1,
        plotColor     : '#f63',
        plotProgressColor : '#F00',
        plotPointHeight: 2,
        plotPointWidth: 2,
        plotSeparator: true,
        plotSeparatorColor: 'black',
        plotRangeDisplay: false,
        plotRangeUnits: '',
        plotRangePrecision: 4,
        plotRangeIgnoreOutliers: false,
        plotRangeFontSize: 12,
        plotRangeFontType: 'Ariel',
        waveDrawMedianLine: true,
        plotFileDelimiter:  '\t'
    },

    //object variables that get manipulated by various object functions
    plotTimeStart: 0,  //the start time of our wave according to plot data
    plotTimeEnd: -1,   //the end of our wave according to plot data
    plotArrayLoaded: false,
    plotArray: [],     //array of plot data objects containing time and plot value
    plotPoints: [],        //calculated average plot points corresponding to value of our wave
    plotMin: 0,
    plotMax: 1,

    /**
     * Initializes the plot array. If params.plotFileUrl is provided an ajax call will be
     * executed and drawing of the wave is delayed until plot info is retrieved
     * @param params
     */
    initDrawer: function (params) {
        var my = this;

        //set defaults if not passed in
        for(var paramName in this.defaultPlotParams) {
            if(this.params[paramName] === undefined) {
                this.params[paramName] = this.defaultPlotParams[paramName];
            }
        }

        //set the plotTimeStart
        this.plotTimeStart = this.params.plotTimeStart;

        //check to see if plotTimeEnd
        if(this.params.plotTimeEnd !== undefined) {
            this.plotTimeEnd = this.params.plotTimeEnd;
        }

        //set the plot array
        if (Array.isArray(params.plotArray)) {
            this.plotArray = params.plotArray;
            this.plotArrayLoaded = true;
        }
        //Need to load the plot array from ajax with our callback
        else {
            var onPlotArrayLoaded = function (plotArray) {
                my.plotArray = plotArray;
                my.plotArrayLoaded = true;
                my.fireEvent('plot_array_loaded');
            };
            this.loadPlotArrayFromFile(params.plotFileUrl, onPlotArrayLoaded, this.params.plotFileDelimiter);
        }
    },

    /**
     * Draw the peaks - this overrides the drawer.js function and does the following additional steps
     * - ensures that the plotArray has already been loaded, if not it loads via ajax
     * - moves the wave form to where channel 1 would normally be
     * @param peaks
     * @param length
     * @param start
     * @param end
     */
    drawPeaks: function (peaks, length, start, end) {
        //make sure that the plot array is already loaded
        if (this.plotArrayLoaded == true) {

            this.setWidth(length);

            //fake that we are splitting channels
            this.splitChannels = true;
            this.params.height = this.params.height/2;
            if (peaks[0] instanceof Array) {
               peaks = peaks[0];
            }

            this.params.barWidth ?
                this.drawBars(peaks, 1, start, end) :
                this.drawWave(peaks, 1, start, end);

            //set the height back to the original
            this.params.height = this.params.height*2;

            this.calculatePlots();
            this.drawPlots();

        }
        //otherwise wait for the plot array to be loaded and then draw again
        else {
            var my = this;
            my.on('plot-array-loaded', function () {
                my.drawPeaks(peaks, length, start, end);
            });
        }
    },




    /**
     * Loop through the calculated plot values and actually draw them
     */
    drawPlots: function() {
        var height = this.params.height * this.params.pixelRatio / 2;

        var $ = 0.5 / this.params.pixelRatio;

        this.waveCc.fillStyle = this.params.plotColor;
        if(this.progressCc) {
            this.progressCc.fillStyle = this.params.plotProgressColor;
        }
        for(var i in this.plotPoints) {
            var x = parseInt(i);
            var y = height - this.params.plotPointHeight - (this.plotPoints[i] * (height - this.params.plotPointHeight));
            var pointHeight = this.params.plotPointHeight;

            this.waveCc.fillRect(x, y, this.params.plotPointWidth, pointHeight);

            if(this.progressCc) {
                this.progressCc.fillRect(x, y, this.params.plotPointWidth, pointHeight);
            }
        }

        //draw line to separate the two waves
        if(this.params.plotSeparator) {
            this.waveCc.fillStyle = this.params.plotSeparatorColor;
            this.waveCc.fillRect(0, height, this.width, $);
        }

        if(this.params.plotRangeDisplay) {
            this.displayPlotRange();
        }
    },


    /**
     * Display the range for the plot graph
     */
    displayPlotRange: function()
    {
        var fontSize = this.params.plotRangeFontSize * this.params.pixelRatio;
        var maxRange = this.plotMax.toPrecision(this.params.plotRangePrecision) + ' ' + this.params.plotRangeUnits;
        var minRange = this.plotMin.toPrecision(this.params.plotRangePrecision) + ' ' + this.params.plotRangeUnits;
        this.waveCc.font = fontSize.toString() + 'px ' + this.params.plotRangeFontType;
        this.waveCc.fillText(maxRange, 3, fontSize);
        this.waveCc.fillText(minRange, 3, this.height/2);

    },
    /**
     * This function loops through the plotArray and converts it to the plot points
     * to be drawn on the canvas keyed by their position
     */
    calculatePlots: function() {
        //reset plots array
        this.plotPoints = {};

        //make sure we have our plotTimeEnd
        this.calculatePlotTimeEnd();

        var pointsForAverage = [];
        var previousWaveIndex = -1;
        var maxPlot = 0;
        var minPlot = 99999999999999;
        var maxSegmentPlot = 0;
        var minSegmentPlot = 99999999999999;
        var duration = this.plotTimeEnd - this.plotTimeStart;

        //loop through our plotArray and map values to wave indexes and take the average values for each wave index
        for(var i = 0; i < this.plotArray.length; i++) {
            var dataPoint = this.plotArray[i];
            if(dataPoint.value > maxPlot) {maxPlot = dataPoint.value;}
            if(dataPoint.value < minPlot) {minPlot = dataPoint.value;}

            //make sure we are in the specified range
            if(dataPoint.time >= this.plotTimeStart && dataPoint.time <= this.plotTimeEnd) {
                //get the wave index corresponding to the data point
                var waveIndex = Math.round(this.width * (dataPoint.time - this.plotTimeStart) / duration);

                pointsForAverage.push(dataPoint.value);

                //if we have moved on to a new position in our wave record average and reset previousWaveIndex
                if(waveIndex !== previousWaveIndex) {
                    if(pointsForAverage.length > 0) {
                        //get the average plot for this point
                        var avgPlot = this.avg(pointsForAverage);

                        //check for min max
                        if(avgPlot > maxSegmentPlot) {maxSegmentPlot = avgPlot;}
                        if(avgPlot < minSegmentPlot) {minSegmentPlot = avgPlot;}

                        //add plot to the position
                        this.plotPoints[previousWaveIndex] = avgPlot;
                        pointsForAverage = [];
                    }
                }
                previousWaveIndex = waveIndex;
            }
        }

        //normalize the plots points
        if(this.params.plotNormalizeTo == 'whole') {
            this.plotMin = minPlot;
            this.plotMax = maxPlot;
        }
        else if(this.params.plotNormalizeTo == 'values') {
            this.plotMin = this.params.plotMin;
            this.plotMax = this.params.plotMax;
        }
        else {
            this.plotMin = minSegmentPlot;
            this.plotMax = maxSegmentPlot;
        }
        this.normalizeValues();
    },

    /**
     * Function to take all of the plots in this.plots and normalize them from 0 to one
     * depending on this.plotMin and this.plotMax values
     */
    normalizeValues: function() {
        var normalizedValues = {};

        //check to make sure we should be normalizing
        if(this.params.plotNormalizeTo === 'none') {return;}

        for(var i in this.plotPoints) {
            //get the normalized value between 0 and 1
            var normalizedValue = (this.plotPoints[i] - this.plotMin) / (this.plotMax - this.plotMin);

            //check if the value is above our specified range max
            if(normalizedValue > 1) {
                if(!this.params.plotRangeIgnoreOutliers) {
                    normalizedValues[i] = 1;
                }
            }
            //check if hte value is below our specified rant
            else if(normalizedValue < 0) {
                if(!this.params.plotRangeIgnoreOutliers) {
                    normalizedValues[i] = 0;
                }
            }
            //in our range add the normalized value
            else {
                normalizedValues[i] = normalizedValue;
            }
        }
        this.plotPoints = normalizedValues;
    },
    /**
     *
     */

    /**
     * Function to load the plot array from a external file
     *
     * The text file should contain a series of lines.
     * Each line should contain [audio time] [delimiter character] [plot value]
     * e.g. "1.2355 [tab] 124.2321"
     *
     * @param plotFileUrl  url of the file containing time and value information
     * @param onSuccess    function to run on success
     * @param delimiter    the delimiter that separates the time and values on each line
     */
    loadPlotArrayFromFile: function(plotFileUrl, onSuccess, delimiter) {
        //default delimiter to tab character
        if (delimiter === undefined) {delimiter = '\t';}

        var plotArray = [];

        var options = {
            url: plotFileUrl,
            responseType: 'text'
        };
        var fileAjax = WaveSurfer.util.ajax(options);

        fileAjax.on('load', function (data) {
            if (data.currentTarget.status == 200) {
                //split the file by line endings
                var plotLines = data.currentTarget.responseText.split('\n');
                //loop through each line and find the time and plot values (delimited by tab)
                for (var i = 0; i < plotLines.length; i++) {
                    var plotParts = plotLines[i].split(delimiter);
                    if(plotParts.length == 2) {
                        plotArray.push({time: parseFloat(plotParts[0]), value: parseFloat(plotParts[1])});
                    }
                }
                //run success function
                onSuccess(plotArray);
            }
        });
    },

    /***
     * Calculate the end time of the plot
     */
    calculatePlotTimeEnd: function() {
        if(this.params.plotTimeEnd !== undefined) {
            this.plotTimeEnd = this.params.plotTimeEnd;
        }
        else {
            this.plotTimeEnd = this.plotArray[this.plotArray.length -1].time;
        }
    },

    /**
     * Quick convenience function to average numbers in an array
     * @param  array of values
     * @returns {number}
     */
    avg: function(values) {
        var sum = values.reduce(function(a, b) {return a+b;});
        return sum/values.length;
    }
});

WaveSurfer.util.extend(WaveSurfer.Drawer.SplitWavePointPlot, WaveSurfer.Observer);
