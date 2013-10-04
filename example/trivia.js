window.addEventListener('load', function () {
    if (!(window.AudioContext || window.webkitAudioContext)) {
        document.querySelector('#demo').innerHTML =
            '<img src="/example/screenshot.png" />';
    }

    var ul = document.querySelector('.nav-pills');
    var pills = ul.querySelectorAll('li');
    var active = pills[0];
    if (location.search) {
        var first = location.search.split('&')[0];
        var link = ul.querySelector('a[href="' + first + '"]');
        if (link) {
            active =  link.parentNode;
        }
    }
    active && active.classList.add('active');
});
