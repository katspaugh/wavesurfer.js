/*
 * SoundTouch JS audio processing library
 * Copyright (c) Olli Parviainen
 * Copyright (c) Ryan Berdeen
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

(function(window) {
    /**
     * Giving this value for the sequence length sets automatic parameter value
     * according to tempo setting (recommended)
     */
    let USE_AUTO_SEQUENCE_LEN = 0;

    /**
     * Default length of a single processing sequence, in milliseconds. This determines to how
     * long sequences the original sound is chopped in the time-stretch algorithm.
     *
     * The larger this value is, the lesser sequences are used in processing. In principle
     * a bigger value sounds better when slowing down tempo, but worse when increasing tempo
     * and vice versa.
     *
     * Increasing this value reduces computational burden and vice versa.
     */
    //let DEFAULT_SEQUENCE_MS = 130
    let DEFAULT_SEQUENCE_MS = USE_AUTO_SEQUENCE_LEN;

    /**
     * Giving this value for the seek window length sets automatic parameter value
     * according to tempo setting (recommended)
     */
    let USE_AUTO_SEEKWINDOW_LEN = 0;

    /**
     * Seeking window default length in milliseconds for algorithm that finds the best possible
     * overlapping location. This determines from how wide window the algorithm may look for an
     * optimal joining location when mixing the sound sequences back together.
     *
     * The bigger this window setting is, the higher the possibility to find a better mixing
     * position will become, but at the same time large values may cause a "drifting" artifact
     * because consequent sequences will be taken at more uneven intervals.
     *
     * If there's a disturbing artifact that sounds as if a constant frequency was drifting
     * around, try reducing this setting.
     *
     * Increasing this value increases computational burden and vice versa.
     */
    //let DEFAULT_SEEKWINDOW_MS = 25;
    let DEFAULT_SEEKWINDOW_MS = USE_AUTO_SEEKWINDOW_LEN;

    /**
     * Overlap length in milliseconds. When the chopped sound sequences are mixed back together,
     * to form a continuous sound stream, this parameter defines over how long period the two
     * consecutive sequences are let to overlap each other.
     *
     * This shouldn't be that critical parameter. If you reduce the DEFAULT_SEQUENCE_MS setting
     * by a large amount, you might wish to try a smaller value on this.
     *
     * Increasing this value increases computational burden and vice versa.
     */
    let DEFAULT_OVERLAP_MS = 8;

    // Table for the hierarchical mixing position seeking algorithm
    let _SCAN_OFFSETS = [
        [
            124,
            186,
            248,
            310,
            372,
            434,
            496,
            558,
            620,
            682,
            744,
            806,
            868,
            930,
            992,
            1054,
            1116,
            1178,
            1240,
            1302,
            1364,
            1426,
            1488,
            0
        ],
        [
            -100,
            -75,
            -50,
            -25,
            25,
            50,
            75,
            100,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ],
        [
            -20,
            -15,
            -10,
            -5,
            5,
            10,
            15,
            20,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ],
        [
            -4,
            -3,
            -2,
            -1,
            1,
            2,
            3,
            4,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ]
    ];

    // Adjust tempo param according to tempo, so that variating processing sequence length is used
    // at varius tempo settings, between the given low...top limits
    let AUTOSEQ_TEMPO_LOW = 0.5; // auto setting low tempo range (-50%)
    let AUTOSEQ_TEMPO_TOP = 2.0; // auto setting top tempo range (+100%)

    // sequence-ms setting values at above low & top tempo
    let AUTOSEQ_AT_MIN = 125.0;
    let AUTOSEQ_AT_MAX = 50.0;
    let AUTOSEQ_K =
        (AUTOSEQ_AT_MAX - AUTOSEQ_AT_MIN) /
        (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
    let AUTOSEQ_C = AUTOSEQ_AT_MIN - AUTOSEQ_K * AUTOSEQ_TEMPO_LOW;

    // seek-window-ms setting values at above low & top tempo
    let AUTOSEEK_AT_MIN = 25.0;
    let AUTOSEEK_AT_MAX = 15.0;
    let AUTOSEEK_K =
        (AUTOSEEK_AT_MAX - AUTOSEEK_AT_MIN) /
        (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);
    let AUTOSEEK_C = AUTOSEEK_AT_MIN - AUTOSEEK_K * AUTOSEQ_TEMPO_LOW;

    function extend(a, b) {
        for (let i in b) {
            let g = b.__lookupGetter__(i),
                s = b.__lookupSetter__(i);
            if (g || s) {
                if (g) {
                    a.__defineGetter__(i, g);
                }
                if (s) {
                    a.__defineSetter__(i, s);
                }
            } else {
                a[i] = b[i];
            }
        }
        return a;
    }

    function testFloatEqual(a, b) {
        return (a > b ? a - b : b - a) > 1e-10;
    }

    function AbstractFifoSamplePipe(createBuffers) {
        if (createBuffers) {
            this.inputBuffer = new FifoSampleBuffer();
            this.outputBuffer = new FifoSampleBuffer();
        } else {
            this.inputBuffer = this.outputBuffer = null;
        }
    }
    AbstractFifoSamplePipe.prototype = {
        get inputBuffer() {
            return this._inputBuffer;
        },
        set inputBuffer(inputBuffer) {
            this._inputBuffer = inputBuffer;
        },
        get outputBuffer() {
            return this._outputBuffer;
        },
        set outputBuffer(outputBuffer) {
            this._outputBuffer = outputBuffer;
        },
        clear: function() {
            this._inputBuffer.clear();
            this._outputBuffer.clear();
        }
    };

    function RateTransposer(createBuffers) {
        AbstractFifoSamplePipe.call(this, createBuffers);
        this._reset();
        this.rate = 1;
    }
    extend(RateTransposer.prototype, AbstractFifoSamplePipe.prototype);
    extend(RateTransposer.prototype, {
        set rate(rate) {
            this._rate = rate;
            // TODO aa filter
        },
        _reset: function() {
            this.slopeCount = 0;
            this.prevSampleL = 0;
            this.prevSampleR = 0;
        },
        process: function() {
            // TODO aa filter
            let numFrames = this._inputBuffer.frameCount;
            this._outputBuffer.ensureAdditionalCapacity(
                numFrames / this._rate + 1
            );
            let numFramesOutput = this._transpose(numFrames);
            this._inputBuffer.receive();
            this._outputBuffer.put(numFramesOutput);
        },
        _transpose: function(numFrames) {
            if (numFrames === 0) {
                return 0; // No work.
            }

            let src = this._inputBuffer.vector;
            let srcOffset = this._inputBuffer.startIndex;

            let dest = this._outputBuffer.vector;
            let destOffset = this._outputBuffer.endIndex;

            let used = 0;
            let i = 0;

            while (this.slopeCount < 1.0) {
                dest[destOffset + 2 * i] =
                    (1.0 - this.slopeCount) * this.prevSampleL +
                    this.slopeCount * src[srcOffset];
                dest[destOffset + 2 * i + 1] =
                    (1.0 - this.slopeCount) * this.prevSampleR +
                    this.slopeCount * src[srcOffset + 1];
                i++;
                this.slopeCount += this._rate;
            }

            this.slopeCount -= 1.0;

            if (numFrames != 1) {
                // eslint-disable-next-line no-constant-condition
                out: while (true) {
                    while (this.slopeCount > 1.0) {
                        this.slopeCount -= 1.0;
                        used++;
                        if (used >= numFrames - 1) {
                            break out;
                        }
                    }

                    let srcIndex = srcOffset + 2 * used;
                    dest[destOffset + 2 * i] =
                        (1.0 - this.slopeCount) * src[srcIndex] +
                        this.slopeCount * src[srcIndex + 2];
                    dest[destOffset + 2 * i + 1] =
                        (1.0 - this.slopeCount) * src[srcIndex + 1] +
                        this.slopeCount * src[srcIndex + 3];

                    i++;
                    this.slopeCount += this._rate;
                }
            }

            this.prevSampleL = src[srcOffset + 2 * numFrames - 2];
            this.prevSampleR = src[srcOffset + 2 * numFrames - 1];

            return i;
        }
    });

    function FifoSampleBuffer() {
        this._vector = new Float32Array();
        this._position = 0;
        this._frameCount = 0;
    }
    FifoSampleBuffer.prototype = {
        get vector() {
            return this._vector;
        },
        get position() {
            return this._position;
        },
        get startIndex() {
            return this._position * 2;
        },
        get frameCount() {
            return this._frameCount;
        },
        get endIndex() {
            return (this._position + this._frameCount) * 2;
        },
        clear: function(frameCount) {
            this.receive(frameCount);
            this.rewind();
        },
        put: function(numFrames) {
            this._frameCount += numFrames;
        },
        putSamples: function(samples, position, numFrames) {
            position = position || 0;
            let sourceOffset = position * 2;
            if (!(numFrames >= 0)) {
                numFrames = (samples.length - sourceOffset) / 2;
            }
            let numSamples = numFrames * 2;

            this.ensureCapacity(numFrames + this._frameCount);

            let destOffset = this.endIndex;
            this._vector.set(
                samples.subarray(sourceOffset, sourceOffset + numSamples),
                destOffset
            );

            this._frameCount += numFrames;
        },
        putBuffer: function(buffer, position, numFrames) {
            position = position || 0;
            if (!(numFrames >= 0)) {
                numFrames = buffer.frameCount - position;
            }
            this.putSamples(
                buffer.vector,
                buffer.position + position,
                numFrames
            );
        },
        receive: function(numFrames) {
            if (!(numFrames >= 0) || numFrames > this._frameCount) {
                numFrames = this._frameCount;
            }
            this._frameCount -= numFrames;
            this._position += numFrames;
        },
        receiveSamples: function(output, numFrames) {
            let numSamples = numFrames * 2;
            let sourceOffset = this.startIndex;
            output.set(
                this._vector.subarray(sourceOffset, sourceOffset + numSamples)
            );
            this.receive(numFrames);
        },
        extract: function(output, position, numFrames) {
            let sourceOffset = this.startIndex + position * 2;
            let numSamples = numFrames * 2;
            output.set(
                this._vector.subarray(sourceOffset, sourceOffset + numSamples)
            );
        },
        ensureCapacity: function(numFrames) {
            let minLength = numFrames * 2;
            if (this._vector.length < minLength) {
                let newVector = new Float32Array(minLength);
                newVector.set(
                    this._vector.subarray(this.startIndex, this.endIndex)
                );
                this._vector = newVector;
                this._position = 0;
            } else {
                this.rewind();
            }
        },
        ensureAdditionalCapacity: function(numFrames) {
            this.ensureCapacity(this.frameCount + numFrames);
        },
        rewind: function() {
            if (this._position > 0) {
                this._vector.set(
                    this._vector.subarray(this.startIndex, this.endIndex)
                );
                this._position = 0;
            }
        }
    };

    function SimpleFilter(sourceSound, pipe) {
        this._pipe = pipe;
        this.sourceSound = sourceSound;
        this.historyBufferSize = 22050;
        this._sourcePosition = 0;
        this.outputBufferPosition = 0;
        this._position = 0;
    }
    SimpleFilter.prototype = {
        get pipe() {
            return this._pipe;
        },
        get position() {
            return this._position;
        },
        set position(position) {
            if (position > this._position) {
                throw new RangeError(
                    'New position may not be greater than current position'
                );
            }
            let newOutputBufferPosition =
                this.outputBufferPosition - (this._position - position);
            if (newOutputBufferPosition < 0) {
                throw new RangeError(
                    'New position falls outside of history buffer'
                );
            }
            this.outputBufferPosition = newOutputBufferPosition;
            this._position = position;
        },
        get sourcePosition() {
            return this._sourcePosition;
        },
        set sourcePosition(sourcePosition) {
            this.clear();
            this._sourcePosition = sourcePosition;
        },
        get inputBuffer() {
            return this._pipe.inputBuffer;
        },
        get outputBuffer() {
            return this._pipe.outputBuffer;
        },
        fillInputBuffer: function(numFrames) {
            let samples = new Float32Array(numFrames * 2);
            let numFramesExtracted = this.sourceSound.extract(
                samples,
                numFrames,
                this._sourcePosition
            );
            this._sourcePosition += numFramesExtracted;
            this.inputBuffer.putSamples(samples, 0, numFramesExtracted);
        },
        fillOutputBuffer: function(numFrames) {
            while (this.outputBuffer.frameCount < numFrames) {
                // TODO hardcoded buffer size
                let numInputFrames = 8192 * 2 - this.inputBuffer.frameCount;

                this.fillInputBuffer(numInputFrames);

                if (this.inputBuffer.frameCount < 8192 * 2) {
                    break;
                    // TODO flush pipe
                }
                this._pipe.process();
            }
        },
        extract: function(target, numFrames) {
            this.fillOutputBuffer(this.outputBufferPosition + numFrames);

            let numFramesExtracted = Math.min(
                numFrames,
                this.outputBuffer.frameCount - this.outputBufferPosition
            );
            this.outputBuffer.extract(
                target,
                this.outputBufferPosition,
                numFramesExtracted
            );

            let currentFrames = this.outputBufferPosition + numFramesExtracted;
            this.outputBufferPosition = Math.min(
                this.historyBufferSize,
                currentFrames
            );
            this.outputBuffer.receive(
                Math.max(currentFrames - this.historyBufferSize, 0)
            );

            this._position += numFramesExtracted;
            return numFramesExtracted;
        },
        handleSampleData: function(e) {
            this.extract(e.data, 4096);
        },
        clear: function() {
            // TODO yuck
            this._pipe.clear();
            this.outputBufferPosition = 0;
        }
    };

    function Stretch(createBuffers, sampleRate) {
        AbstractFifoSamplePipe.call(this, createBuffers);
        this.bQuickSeek = true;
        this.bMidBufferDirty = false;

        this.pMidBuffer = null;
        this.overlapLength = 0;

        this.bAutoSeqSetting = true;
        this.bAutoSeekSetting = true;

        this._tempo = 1;
        this.setParameters(
            sampleRate,
            DEFAULT_SEQUENCE_MS,
            DEFAULT_SEEKWINDOW_MS,
            DEFAULT_OVERLAP_MS
        );
    }
    extend(Stretch.prototype, AbstractFifoSamplePipe.prototype);
    extend(Stretch.prototype, {
        clear: function() {
            AbstractFifoSamplePipe.prototype.clear.call(this);
            this._clearMidBuffer();
        },
        _clearMidBuffer: function() {
            if (this.bMidBufferDirty) {
                this.bMidBufferDirty = false;
                this.pMidBuffer = null;
            }
        },

        /**
         * Sets routine control parameters. These control are certain time constants
         * defining how the sound is stretched to the desired duration.
         *
         * 'sampleRate' = sample rate of the sound
         * 'sequenceMS' = one processing sequence length in milliseconds (default = 82 ms)
         * 'seekwindowMS' = seeking window length for scanning the best overlapping
         *      position (default = 28 ms)
         * 'overlapMS' = overlapping length (default = 12 ms)
         */
        setParameters: function(
            aSampleRate,
            aSequenceMS,
            aSeekWindowMS,
            aOverlapMS
        ) {
            // accept only positive parameter values - if zero or negative, use old values instead
            if (aSampleRate > 0) {
                this.sampleRate = aSampleRate;
            }
            if (aOverlapMS > 0) {
                this.overlapMs = aOverlapMS;
            }

            if (aSequenceMS > 0) {
                this.sequenceMs = aSequenceMS;
                this.bAutoSeqSetting = false;
            } else {
                // zero or below, use automatic setting
                this.bAutoSeqSetting = true;
            }

            if (aSeekWindowMS > 0) {
                this.seekWindowMs = aSeekWindowMS;
                this.bAutoSeekSetting = false;
            } else {
                // zero or below, use automatic setting
                this.bAutoSeekSetting = true;
            }

            this.calcSeqParameters();

            this.calculateOverlapLength(this.overlapMs);

            // set tempo to recalculate 'sampleReq'
            this.tempo = this._tempo;
        },

        /**
         * Sets new target tempo. Normal tempo = 'SCALE', smaller values represent slower
         * tempo, larger faster tempo.
         */
        set tempo(newTempo) {
            let intskip;

            this._tempo = newTempo;

            // Calculate new sequence duration
            this.calcSeqParameters();

            // Calculate ideal skip length (according to tempo value)
            this.nominalSkip =
                this._tempo * (this.seekWindowLength - this.overlapLength);
            this.skipFract = 0;
            intskip = Math.floor(this.nominalSkip + 0.5);

            // Calculate how many samples are needed in the 'inputBuffer' to
            // process another batch of samples
            this.sampleReq =
                Math.max(intskip + this.overlapLength, this.seekWindowLength) +
                this.seekLength;
        },
        get inputChunkSize() {
            return this.sampleReq;
        },
        get outputChunkSize() {
            return (
                this.overlapLength +
                Math.max(0, this.seekWindowLength - 2 * this.overlapLength)
            );
        },

        /**
         * Calculates overlapInMsec period length in samples.
         */
        calculateOverlapLength: function(overlapInMsec) {
            let newOvl;

            // TODO assert(overlapInMsec >= 0);
            newOvl = (this.sampleRate * overlapInMsec) / 1000;
            if (newOvl < 16) {
                newOvl = 16;
            }

            // must be divisible by 8
            newOvl -= newOvl % 8;

            this.overlapLength = newOvl;

            this.pRefMidBuffer = new Float32Array(this.overlapLength * 2);
            this.pMidBuffer = new Float32Array(this.overlapLength * 2);
        },
        checkLimits: function(x, mi, ma) {
            return x < mi ? mi : x > ma ? ma : x;
        },

        /**
         * Calculates processing sequence length according to tempo setting
         */
        calcSeqParameters: function() {
            let seq;
            let seek;

            if (this.bAutoSeqSetting) {
                seq = AUTOSEQ_C + AUTOSEQ_K * this._tempo;
                seq = this.checkLimits(seq, AUTOSEQ_AT_MAX, AUTOSEQ_AT_MIN);
                this.sequenceMs = Math.floor(seq + 0.5);
            }

            if (this.bAutoSeekSetting) {
                seek = AUTOSEEK_C + AUTOSEEK_K * this._tempo;
                seek = this.checkLimits(seek, AUTOSEEK_AT_MAX, AUTOSEEK_AT_MIN);
                this.seekWindowMs = Math.floor(seek + 0.5);
            }

            // Update seek window lengths
            this.seekWindowLength = Math.floor(
                (this.sampleRate * this.sequenceMs) / 1000
            );
            this.seekLength = Math.floor(
                (this.sampleRate * this.seekWindowMs) / 1000
            );
        },

        /**
         * Enables/disables the quick position seeking algorithm.
         */
        set quickSeek(enable) {
            this.bQuickSeek = enable;
        },

        /**
         * Seeks for the optimal overlap-mixing position.
         */
        seekBestOverlapPosition: function() {
            if (this.bQuickSeek) {
                return this.seekBestOverlapPositionStereoQuick();
            } else {
                return this.seekBestOverlapPositionStereo();
            }
        },

        /**
         * Seeks for the optimal overlap-mixing position. The 'stereo' version of the
         * routine
         *
         * The best position is determined as the position where the two overlapped
         * sample sequences are 'most alike', in terms of the highest cross-correlation
         * value over the overlapping period
         */
        seekBestOverlapPositionStereo: function() {
            let bestOffs, bestCorr, corr, i;

            // Slopes the amplitudes of the 'midBuffer' samples.
            this.precalcCorrReferenceStereo();

            bestCorr = Number.MIN_VALUE;
            bestOffs = 0;

            // Scans for the best correlation value by testing each possible position
            // over the permitted range.
            for (i = 0; i < this.seekLength; i++) {
                // Calculates correlation value for the mixing position corresponding
                // to 'i'
                corr = this.calcCrossCorrStereo(2 * i, this.pRefMidBuffer);

                // Checks for the highest correlation value.
                if (corr > bestCorr) {
                    bestCorr = corr;
                    bestOffs = i;
                }
            }
            return bestOffs;
        },

        /**
         * Seeks for the optimal overlap-mixing position. The 'stereo' version of the
         * routine
         *
         * The best position is determined as the position where the two overlapped
         * sample sequences are 'most alike', in terms of the highest cross-correlation
         * value over the overlapping period
         */
        seekBestOverlapPositionStereoQuick: function() {
            let j, bestOffs, bestCorr, corr, scanCount, corrOffset, tempOffset;

            // Slopes the amplitude of the 'midBuffer' samples
            this.precalcCorrReferenceStereo();

            bestCorr = Number.MIN_VALUE;
            bestOffs = 0;
            corrOffset = 0;
            tempOffset = 0;

            // Scans for the best correlation value using four-pass hierarchical search.
            //
            // The look-up table 'scans' has hierarchical position adjusting steps.
            // In first pass the routine searhes for the highest correlation with
            // relatively coarse steps, then rescans the neighbourhood of the highest
            // correlation with better resolution and so on.
            for (scanCount = 0; scanCount < 4; scanCount++) {
                j = 0;
                while (_SCAN_OFFSETS[scanCount][j]) {
                    tempOffset = corrOffset + _SCAN_OFFSETS[scanCount][j];
                    if (tempOffset >= this.seekLength) {
                        break;
                    }

                    // Calculates correlation value for the mixing position corresponding
                    // to 'tempOffset'
                    corr = this.calcCrossCorrStereo(
                        2 * tempOffset,
                        this.pRefMidBuffer
                    );

                    // Checks for the highest correlation value
                    if (corr > bestCorr) {
                        bestCorr = corr;
                        bestOffs = tempOffset;
                    }
                    j++;
                }
                corrOffset = bestOffs;
            }
            return bestOffs;
        },

        /**
         * Slopes the amplitude of the 'midBuffer' samples so that cross correlation
         * is faster to calculate
         */
        precalcCorrReferenceStereo: function() {
            let i, cnt2, temp;

            for (i = 0; i < this.overlapLength; i++) {
                temp = i * (this.overlapLength - i);
                cnt2 = i * 2;
                this.pRefMidBuffer[cnt2] = this.pMidBuffer[cnt2] * temp;
                this.pRefMidBuffer[cnt2 + 1] = this.pMidBuffer[cnt2 + 1] * temp;
            }
        },

        calcCrossCorrStereo: function(mixingPos, compare) {
            let mixing = this._inputBuffer.vector;
            mixingPos += this._inputBuffer.startIndex;

            let corr, i, mixingOffset;
            corr = 0;
            for (i = 2; i < 2 * this.overlapLength; i += 2) {
                mixingOffset = i + mixingPos;
                corr +=
                    mixing[mixingOffset] * compare[i] +
                    mixing[mixingOffset + 1] * compare[i + 1];
            }
            return corr;
        },

        // TODO inline
        /**
         * Overlaps samples in 'midBuffer' with the samples in 'pInputBuffer' at position
         * of 'ovlPos'.
         */
        overlap: function(ovlPos) {
            this.overlapStereo(2 * ovlPos);
        },

        /**
         * Overlaps samples in 'midBuffer' with the samples in 'pInput'
         */
        overlapStereo: function(pInputPos) {
            let pInput = this._inputBuffer.vector;
            pInputPos += this._inputBuffer.startIndex;

            let pOutput = this._outputBuffer.vector,
                pOutputPos = this._outputBuffer.endIndex,
                i,
                cnt2,
                fTemp,
                fScale,
                fi,
                pInputOffset,
                pOutputOffset;

            fScale = 1 / this.overlapLength;
            for (i = 0; i < this.overlapLength; i++) {
                fTemp = (this.overlapLength - i) * fScale;
                fi = i * fScale;
                cnt2 = 2 * i;
                pInputOffset = cnt2 + pInputPos;
                pOutputOffset = cnt2 + pOutputPos;
                pOutput[pOutputOffset + 0] =
                    pInput[pInputOffset + 0] * fi +
                    this.pMidBuffer[cnt2 + 0] * fTemp;
                pOutput[pOutputOffset + 1] =
                    pInput[pInputOffset + 1] * fi +
                    this.pMidBuffer[cnt2 + 1] * fTemp;
            }
        },
        process: function() {
            let ovlSkip, offset, temp, i;
            if (this.pMidBuffer === null) {
                // if midBuffer is empty, move the first samples of the input stream
                // into it
                if (this._inputBuffer.frameCount < this.overlapLength) {
                    // wait until we've got overlapLength samples
                    return;
                }
                this.pMidBuffer = new Float32Array(this.overlapLength * 2);
                this._inputBuffer.receiveSamples(
                    this.pMidBuffer,
                    this.overlapLength
                );
            }

            let output;
            // Process samples as long as there are enough samples in 'inputBuffer'
            // to form a processing frame.
            while (this._inputBuffer.frameCount >= this.sampleReq) {
                // If tempo differs from the normal ('SCALE'), scan for the best overlapping
                // position
                offset = this.seekBestOverlapPosition();

                // Mix the samples in the 'inputBuffer' at position of 'offset' with the
                // samples in 'midBuffer' using sliding overlapping
                // ... first partially overlap with the end of the previous sequence
                // (that's in 'midBuffer')
                this._outputBuffer.ensureAdditionalCapacity(this.overlapLength);
                // FIXME unit?
                //overlap(uint(offset));
                this.overlap(Math.floor(offset));
                this._outputBuffer.put(this.overlapLength);

                // ... then copy sequence samples from 'inputBuffer' to output
                temp = this.seekWindowLength - 2 * this.overlapLength; // & 0xfffffffe;
                if (temp > 0) {
                    this._outputBuffer.putBuffer(
                        this._inputBuffer,
                        offset + this.overlapLength,
                        temp
                    );
                }

                // Copies the end of the current sequence from 'inputBuffer' to
                // 'midBuffer' for being mixed with the beginning of the next
                // processing sequence and so on
                //assert(offset + seekWindowLength <= (int)inputBuffer.numSamples());
                let start =
                    this.inputBuffer.startIndex +
                    2 * (offset + this.seekWindowLength - this.overlapLength);
                this.pMidBuffer.set(
                    this._inputBuffer.vector.subarray(
                        start,
                        start + 2 * this.overlapLength
                    )
                );

                // Remove the processed samples from the input buffer. Update
                // the difference between integer & nominal skip step to 'skipFract'
                // in order to prevent the error from accumulating over time.
                this.skipFract += this.nominalSkip; // real skip size
                ovlSkip = Math.floor(this.skipFract); // rounded to integer skip
                this.skipFract -= ovlSkip; // maintain the fraction part, i.e. real vs. integer skip
                this._inputBuffer.receive(ovlSkip);
            }
        }
    });

    // https://bugs.webkit.org/show_bug.cgi?id=57295
    extend(Stretch.prototype, {
        get tempo() {
            return this._tempo;
        }
    });

    function SoundTouch(sampleRate) {
        this.rateTransposer = new RateTransposer(false);
        this.tdStretch = new Stretch(false, sampleRate);

        this._inputBuffer = new FifoSampleBuffer();
        this._intermediateBuffer = new FifoSampleBuffer();
        this._outputBuffer = new FifoSampleBuffer();

        this._rate = 0;
        this._tempo = 0;

        this.virtualPitch = 1.0;
        this.virtualRate = 1.0;
        this.virtualTempo = 1.0;

        this._calculateEffectiveRateAndTempo();
    }
    SoundTouch.prototype = {
        clear: function() {
            this.rateTransposer.clear();
            this.tdStretch.clear();
        },
        get rate() {
            return this._rate;
        },
        set rate(rate) {
            this.virtualRate = rate;
            this._calculateEffectiveRateAndTempo();
        },
        set rateChange(rateChange) {
            this.rate = 1.0 + 0.01 * rateChange;
        },
        get tempo() {
            return this._tempo;
        },
        set tempo(tempo) {
            this.virtualTempo = tempo;
            this._calculateEffectiveRateAndTempo();
        },
        set tempoChange(tempoChange) {
            this.tempo = 1.0 + 0.01 * tempoChange;
        },
        set pitch(pitch) {
            this.virtualPitch = pitch;
            this._calculateEffectiveRateAndTempo();
        },
        set pitchOctaves(pitchOctaves) {
            this.pitch = Math.exp(0.69314718056 * pitchOctaves);
            this._calculateEffectiveRateAndTempo();
        },
        set pitchSemitones(pitchSemitones) {
            this.pitchOctaves = pitchSemitones / 12.0;
        },
        get inputBuffer() {
            return this._inputBuffer;
        },
        get outputBuffer() {
            return this._outputBuffer;
        },
        _calculateEffectiveRateAndTempo: function() {
            let previousTempo = this._tempo;
            let previousRate = this._rate;

            this._tempo = this.virtualTempo / this.virtualPitch;
            this._rate = this.virtualRate * this.virtualPitch;

            if (testFloatEqual(this._tempo, previousTempo)) {
                this.tdStretch.tempo = this._tempo;
            }
            if (testFloatEqual(this._rate, previousRate)) {
                this.rateTransposer.rate = this._rate;
            }

            if (this._rate > 1.0) {
                if (this._outputBuffer != this.rateTransposer.outputBuffer) {
                    this.tdStretch.inputBuffer = this._inputBuffer;
                    this.tdStretch.outputBuffer = this._intermediateBuffer;

                    this.rateTransposer.inputBuffer = this._intermediateBuffer;
                    this.rateTransposer.outputBuffer = this._outputBuffer;
                }
            } else {
                if (this._outputBuffer != this.tdStretch.outputBuffer) {
                    this.rateTransposer.inputBuffer = this._inputBuffer;
                    this.rateTransposer.outputBuffer = this._intermediateBuffer;

                    this.tdStretch.inputBuffer = this._intermediateBuffer;
                    this.tdStretch.outputBuffer = this._outputBuffer;
                }
            }
        },
        process: function() {
            if (this._rate > 1.0) {
                this.tdStretch.process();
                this.rateTransposer.process();
            } else {
                this.rateTransposer.process();
                this.tdStretch.process();
            }
        }
    };

    function WebAudioBufferSource(buffer) {
        this.buffer = buffer;
    }
    WebAudioBufferSource.prototype = {
        extract: function(target, numFrames, position) {
            let l = this.buffer.getChannelData(0),
                r = this.buffer.getChannelData(1);
            for (let i = 0; i < numFrames; i++) {
                target[i * 2] = l[i + position];
                target[i * 2 + 1] = r[i + position];
            }
            return Math.min(numFrames, l.length - position);
        }
    };

    function getWebAudioNode(context, filter) {
        let BUFFER_SIZE = 4096;
        let node = context.createScriptProcessor(BUFFER_SIZE, 2, 2),
            samples = new Float32Array(BUFFER_SIZE * 2);
        node.onaudioprocess = function(e) {
            let l = e.outputBuffer.getChannelData(0),
                r = e.outputBuffer.getChannelData(1);
            let framesExtracted = filter.extract(samples, BUFFER_SIZE);
            if (framesExtracted === 0) {
                node.disconnect(); // Pause.
            }
            for (let i = 0; i < framesExtracted; i++) {
                l[i] = samples[i * 2];
                r[i] = samples[i * 2 + 1];
            }
        };
        return node;
    }

    window.soundtouch = {
        RateTransposer: RateTransposer,
        Stretch: Stretch,
        SimpleFilter: SimpleFilter,
        SoundTouch: SoundTouch,
        WebAudioBufferSource: WebAudioBufferSource,
        getWebAudioNode: getWebAudioNode
    };
})(this);
