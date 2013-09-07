'use strict';

WaveSurfer.ELAN = {
    Types: {
        ALIGNABLE: 'alignable',
        REFERENCE: 'reference'
    },

    TimeUnits: {
        MILLISECONDS: 'milliseconds',
        SECONDS: 'seconds'
    },

    init: function (params) {
        this.data = null;
        this.params = params;
        this.container = 'string' == typeof params.container ?
            document.querySelector(params.container) : params.container;

        if (!this.container) {
            throw Error('No container for ELAN');
        }

        this.bindClick();

        if (params.url) {
            this.load(params.url);
        }
    },

    getAnnotation: function (time) {
        for (var i = 0; i < this.data.length; i++) {
            var annotation = this.data.alignedAnnotations[i];
            if (annotation.start <= time && annotation.end >= time) {
                return annotation;
            }
        }
    },

    getAnnotationRow: function (annotation) {
        return document.getElementById(
            'wavesurfer-aligned-' + annotation.id
        );
    },

    load: function (url) {
        var my = this;
        this.loadXML(url, function (xml) {
            my.data = my.parseXML(xml);
            my.render();
            my.fireEvent('ready', my.data, my.container);
        });
    },

    loadXML: function (url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.send();
        xhr.addEventListener('load', function (e) {
            var xml = e.target.responseXML;
            if (!xml) {
                var parser = new DOMParser();
                xml = parser.parseFromString(e.target.responseText, 'text/xml');
            }
            callback && callback(xml);
        });
    },

    parseXML: function (xml) {
        var _forEach = Array.prototype.forEach;
        var _map = Array.prototype.map;

        var transcript = {
            media: {},
            timeOrder: {},
            annotations: {},
            alignedAnnotations: null, // Array
            tiers: null // Array
        };

        var header = xml.querySelector('HEADER');
        transcript.media.timeUnits = header.getAttribute('TIME_UNITS');
        transcript.media.url = header.querySelector('MEDIA_DESCRIPTOR')
            .getAttribute('MEDIA_URL');

        var timeSlots = xml.querySelectorAll('TIME_ORDER TIME_SLOT');
        _forEach.call(timeSlots, function (slot) {
            transcript.timeOrder[
                slot.getAttribute('TIME_SLOT_ID')
            ] = slot.getAttribute('TIME_VALUE');
        });

        transcript.tiers = _map.call(xml.querySelectorAll('TIER'), function (tier) {
            return {
                id: tier.getAttribute('TIER_ID'),
                linguisticType: tier.getAttribute('LINGUISTIC_TYPE_REF'),
                defaultLocale: tier.getAttribute('DEFAULT_LOCALE'),
                annotations: _map.call(
                    tier.querySelectorAll('REF_ANNOTATION, ALIGNABLE_ANNOTATION'),
                    function (annot) {
                        var annotation = {
                            type: this.Types.REFERENCE,
                            id: annot.getAttribute('ANNOTATION_ID'),
                            ref: annot.getAttribute('ANNOTATION_REF'),
                            value: annot.querySelector('ANNOTATION_VALUE')
                                .textContent.trim()
                        };
                        return transcript.annotations[annotation.id] = annotation;
                    }, this
                )
            };
        }, this);


        var factor = transcript.media.timeUnits == this.TimeUnits.MILLISECONDS ?
            0.001 : 1;
        var alignable = xml.querySelectorAll('ALIGNABLE_ANNOTATION');
        transcript.alignedAnnotations = _map.call(alignable, function (annot) {
            var annotation = {
                type: this.Types.ALIGNABLE,
                id: annot.getAttribute('ANNOTATION_ID'),
                start: transcript.timeOrder[annot.getAttribute('TIME_SLOT_REF1')] * factor,
                end: transcript.timeOrder[annot.getAttribute('TIME_SLOT_REF2')] * factor
            };
            return transcript.annotations[annotation.id] = annotation;
        }, this);
        transcript.alignedAnnotations.sort(function (a, b) {
            var d = a.start - b.start;
            if (d == 0) {
                d = a.end - b.end;
            }
            return d;
        });

        transcript.length = transcript.alignedAnnotations.length;

        return transcript;
    },

    render: function () {
        // apply tiers filter
        var tiers = this.data.tiers;
        if (this.params.tiers) {
            tiers = tiers.filter(function (tier) {
                return tier.id in this.params.tiers;
            }, this);
        }

        // denormalize references to aligned annotations
        var backRefs = {};
        var indeces = {};
        tiers.forEach(function (tier, index) {
            tier.annotations.forEach(function (annot) {
                if (annot.type == this.Types.REFERENCE) {
                    var reference = this.data.annotations[annot.ref];
                    if (reference && reference.type == this.Types.ALIGNABLE) {
                        if (!(reference.id in backRefs)) {
                            backRefs[reference.id] = {};
                        }
                        backRefs[reference.id][index] = annot;
                        indeces[index] = true;
                    }
                }
            }, this);
        }, this);
        indeces = Object.keys(indeces).sort();

        // table
        var table = document.createElement('table');
        table.className = 'wavesurfer-annotations';

        // head
        var thead = document.createElement('thead');
        var headRow = document.createElement('tr');
        thead.appendChild(headRow);
        table.appendChild(thead);
        var th = document.createElement('th');
        th.textContent = '#';
        th.className = 'wavesurfer-number';
        headRow.appendChild(th);
        indeces.forEach(function (index) {
            var tier = tiers[index];
            var th = document.createElement('th');
            th.className = 'wavesurfer-tier-' + tier.id;
            th.textContent = tier.id;
            th.style.width = this.params.tiers[tier.id];
            headRow.appendChild(th);
        }, this);

        // body
        var tbody = document.createElement('tbody');
        table.appendChild(tbody);
        var count = 1;
        this.data.alignedAnnotations.forEach(function (aligned) {
            var backRef = backRefs[aligned.id];
            if (!backRef) { return; }

            var row = document.createElement('tr');
            row.id = 'wavesurfer-aligned-' + aligned.id;
            tbody.appendChild(row);

            var td = document.createElement('td');
            td.className = 'wavesurfer-number';
            td.textContent = count++ + '. ';
            row.appendChild(td);

            indeces.forEach(function (index) {
                var tier = tiers[index];
                var td = document.createElement('td');
                var annotation = backRef[index];
                if (annotation) {
                    td.id = 'wavesurfer-annotation-' + annotation.id;
                    td.dataset.ref = annotation.ref;
                    td.textContent = annotation.value;
                }
                td.className = 'wavesurfer-tier-' + tier.id;
                row.appendChild(td);
            }, this);
        }, this);

        this.container.innerHTML = '';
        this.container.appendChild(table);
    },

    bindClick: function () {
        var my = this;
        this.container.addEventListener('click', function (e) {
            var ref = e.target.dataset.ref;
            if (ref) {
                var annotation = my.data.annotations[ref];
                if (annotation) {
                    my.fireEvent('reference', annotation, my.data);

                    if (annotation.type == my.Types.ALIGNABLE) {
                        my.fireEvent('select', annotation);
                    }
                }
            }
        });
    }
};

WaveSurfer.util.extend(WaveSurfer.ELAN, WaveSurfer.Observer);
