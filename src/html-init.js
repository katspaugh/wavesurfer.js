'use strict';

/* Init from HTML */
(function () {
    var init = function () {
        var containers = document.querySelectorAll('wavesurfer');

        Array.prototype.forEach.call(containers, function (el) {
            var params = WaveSurfer.util.extend({
                container: el,
                backend: 'MediaElement',
                mediaControls: true
            }, el.dataset);

            el.style.display = 'block';

            var wavesurfer = WaveSurfer.create(params);

            if (el.dataset.peaks) {
                var peaks = JSON.parse(el.dataset.peaks);
            }

            wavesurfer.load(el.dataset.url, peaks);
        });
    };

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
}());
