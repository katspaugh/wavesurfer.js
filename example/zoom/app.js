/* jshint devel:true */

/**
 * Create a WaveSurfer instance.
 */
var wavesurfer = Object.create(WaveSurfer);

/**
 * Init & load.
 */
document.addEventListener('DOMContentLoaded', function () {
    // Init wavesurfer
    wavesurfer.init({
        container: '#waveform',
        height: 300,
        pixelRatio: 1,
        scrollParent: true,
        fillParent: true,
        normalize: true,
        minimap: true,
        minPxPerSec: 100,
        backend: 'AudioElement'
    });


    wavesurfer.load('demo.wav');


    /* Regions */
    wavesurfer.enableDragSelection({
        color: randomColor(0.1)
    });

    wavesurfer.on('ready', function () {
        if (localStorage.regions) {
            loadRegions(JSON.parse(localStorage.regions));
        } else {

            wavesurfer.util.ajax({
                responseType: 'json',
                url: 'annotations.json'
            }).on('success', function (data) {
                loadRegions(data);
                saveRegions();
            });
        }
    });
    wavesurfer.on('region-click', function (region, e) {
        e.stopPropagation();
        // Play on click, loop on shift click
        e.shiftKey ? region.playLoop() : region.play();
    });
    wavesurfer.on('region-click', editAnnotation);
    wavesurfer.on('region-updated', saveRegions);
    wavesurfer.on('region-removed', saveRegions);
    wavesurfer.on('region-in', showNote);

    wavesurfer.on('region-play', function (region) {
        region.once('out', function () {
            wavesurfer.play(region.start);
            wavesurfer.pause();
        });
    });


    /* Minimap plugin */
    wavesurfer.initMinimap({
        height: 30,
        waveColor: '#ddd',
        progressColor: '#999',
        cursorColor: '#999'
    });


    /* Timeline plugin */
    wavesurfer.on('ready', function () {
        var timeline = Object.create(WaveSurfer.Timeline);
        timeline.init({
            wavesurfer: wavesurfer,
            container: "#wave-timeline"
        });
    });


    /* Toggle play/pause buttons. */
    var playButton = document.querySelector('#play');
    var pauseButton = document.querySelector('#pause');
    wavesurfer.on('play', function () {
        playButton.style.display = 'none';
        pauseButton.style.display = '';
    });
    wavesurfer.on('pause', function () {
        playButton.style.display = '';
        pauseButton.style.display = 'none';
    });
});


/**
 * Save annotations to localStorage.
 */
function saveRegions() {
    localStorage.regions = JSON.stringify(
        Object.keys(wavesurfer.regions.list).map(function (id) {
            var region = wavesurfer.regions.list[id];
            return {
                start: region.start,
                end: region.end,
                data: region.data
            };
        })
    );
}


/**
 * Load regions from localStorage.
 */
function loadRegions(regions) {
    regions.forEach(function (region) {
        region.color = randomColor(0.1);
        wavesurfer.addRegion(region);
    });
}


/**
 * Random RGBA color.
 */
function randomColor(alpha) {
    return 'rgba(' + [
        ~~(Math.random() * 255),
        ~~(Math.random() * 255),
        ~~(Math.random() * 255),
        alpha || 1
    ] + ')';

}


/**
 * Edit annotation for a region.
 */
function editAnnotation (region) {
    var form = document.forms.edit;
    form.style.opacity = 1;
    form.elements.start.value = Math.round(region.start * 10) / 10,
    form.elements.end.value = Math.round(region.end * 10) / 10;
    form.elements.note.value = region.data.note || '';
    form.onsubmit = function (e) {
        e.preventDefault();
        region.update({
            start: form.elements.start.value,
            end: form.elements.end.value,
            data: {
                note: form.elements.note.value
            }
        });
        form.style.opacity = 0;
    };
    form.onreset = function () {
        form.style.opacity = 0;
        form.dataset.region = null;
    };
    form.dataset.region = region.id;
}


/**
 * Display annotation.
 */
function showNote (region) {
    if (!showNote.el) {
        showNote.el = document.querySelector('#subtitle');
    }
    showNote.el.textContent = region.data.note || '–';
}


/**
* Zoom Slider
*/

$("#slider").each(function () {

        amount = $(this).prev('.amount'),
        values = [0];

    $(this).slider({

        min: 0,
        max: 100,
        values: values,
        step: 10,

        slide: function (event, ui) {
            amount.val(ui.values + "%");
        }
    });

    amount.val($(this).slider("values") + "%");
});

/**
* Slider function for changing Canvas zoom
*/

$('#slider').on('slidechange', function () {

  var selection = $( "#slider" ).slider( "values" );

  // Display current pixels per second value
  $('#pixels').html('minPxPerSec Value: '+ selection);

  // Set the new zoom value to the param
  wavesurfer.params.minPxPerSec = selection;

  // Redraw the waveform with the updated zoom value
  wavesurfer.drawBuffer();

  // Redraw the Regions with the updated zoom value
  getAllRegionIDs();

  // Zoom in where cursor location is
  wavesurfer.seekAndCenter(
    wavesurfer.getCurrentTime() / wavesurfer.getDuration()
  );

});

/**
* Need to interate through the array of Regions by ID and update them
*/
function updateAllRegions(element) {
  wavesurfer.regions.list[element].updateRender();
};

/**
* Create an array of Region IDs
* and pass them to updateAllRegions function in the Zoom Slider
*/
function getAllRegionIDs(){
  // First check if there are any regions
  if (wavesurfer.regions !== undefined) {

    Object.keys(wavesurfer.regions["list"]).map(function(key) {

      return wavesurfer.regions["list"][key].id;

      // Iterate over the Array and plug this function in for each ID
   }).forEach(updateAllRegions);
 }
};

/**
 * Bind controls.
 */
GLOBAL_ACTIONS['delete-region'] = function () {
    var form = document.forms.edit;
    var regionId = form.dataset.region;
    if (regionId) {
        wavesurfer.regions.list[regionId].remove();
        form.reset();
    }
};

GLOBAL_ACTIONS['export'] = function () {
    window.open('data:application/json;charset=utf-8,' +
        encodeURIComponent(localStorage.regions));
};
