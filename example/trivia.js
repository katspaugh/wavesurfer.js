window.addEventListener('load', function () {
    if (!(window.AudioContext || window.webkitAudioContext)) {
        document.querySelector('#demo').innerHTML =
            '<img src="/example/screenshot.png" />';
    }

    if (location.search.match('svg')) {
        document.querySelector('a[href="?svg"]')
            .parentNode.className = 'active';
        document.querySelector('a[href="?canvas"]')
            .parentNode.className = '';
    }
});
