window.addEventListener('load', function () {
    if (!(window.AudioContext || window.webkitAudioContext)) {
        document.querySelector('#demo').innerHTML =
            '<img src="/example/screenshot.png" />';
    }

    var ul = document.querySelector('.nav-pills');
    var pills = ul.querySelectorAll('li');

    if (location.search) {
        var active = ul.querySelector(
            'a[href="' + location.search + '"]'
        ).parentNode;
    } else {
        active = pills[0];
    }
    active.classList.add('active');
    active.querySelector('a').removeAttribute('href');
});
