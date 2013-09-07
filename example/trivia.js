window.addEventListener('load', function () {
    if (!(window.AudioContext || window.webkitAudioContext)) {
        document.querySelector('#demo').innerHTML =
            '<img src="/example/screenshot.png" />';
    }

    var ul = document.querySelector('.nav-pills');
    var pills = ul.querySelectorAll('li');

    if (location.search) {
        Array.prototype.forEach.call(pills, function (link) {
            link.className = '';
        });

        var links = [ 'canvas', 'svg', 'scroll' ];
        links.forEach(function (link) {
            if (location.search.match(link)) {
                ul.querySelector('a[href="?' + link + '"]')
                    .parentNode.className = 'active';
            }
        });
    } else {
        pills[0].className = 'active';
    }
});
