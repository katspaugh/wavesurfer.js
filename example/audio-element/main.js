'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {
    // Init
    wavesurfer.init({
        container: document.querySelector('#waveform'),
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        backend: 'AudioElement'
    });

    // Load audio from URL
    wavesurfer.load('../media/demo.wav');

    document.querySelector(
        '[data-action="play"]'
    ).addEventListener('click', wavesurfer.playPause.bind(wavesurfer));

    document.querySelector(
        '[data-action="peaks"]'
    ).addEventListener('click', function () {
        wavesurfer.load('../media/demo.wav', [
0.0218,-0.0029,0.0183,-0.0057,0.0165,-0.0011,0.0198,-0.0147,0.2137,-0.3699,0.2888,-0.2433,0.2313,-0.2432,0.15,-0.1726,0.2542,-0.1717,0.2538,-0.2194,0.2358,-0.1683,0.1195,-0.3916,0.1591,-0.1484,0.2599,-0.2508,0.2742,-0.3594,0.1447,-0.0649,0.2328,-0.0398,0.1878,-0.2811,0.1988,-0.1025,0.1645,-0.2812,0.1218,-0.15,0.2005,-0.3558,0.2828,-0.187,0.2051,-0.2018,0.1664,-0.1557,0.1181,-0.1764,0.1621,-0.1421,0.2966,-0.2194,0.189,-0.2113,0.246,-0.3188,0.2445,-0.1794,0.1621,-0.2706,0.1618,-0.153,0.189,-0.1948,0.2354,-0.1336,0.1561,-0.2026,0.1638,-0.1133,0.2799,-0.1886,0.0923,-0.0666,0.1659,-0.116,0.1675,-0.1335,0.1268,-0.1282,0.0984,-0.0932,0.0997,-0.0699,0.1248,-0.1008,0.1495,-0.0778,0.1431,-0.1104,0.1236,-0.1171,0.1755,-0.1328,0.1183,-0.1568,0.1349,-0.1172,0.1018,-0.1263,0.1109,-0.1573,0.1833,-0.1323,0.1813,-0.1325,0.1422,-0.1211,0.0961,-0.0933,0.1191,-0.0938,0.0791,-0.1182,0.0631,-0.0937,0.0315,-0.0322,0.0157,-0.0002,0.0166,-0.0078,0.0108,-0.0078
        ]);
        document.body.scrollTop = 0;
    });
});
