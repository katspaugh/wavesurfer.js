WaveSurfer.animate = (function (globals) {
    'use strict'

    var requestFrame = globals.requestAnimationFrame;

    /* Formulae by Robert Penner, http://robertpenner.com/easing/ */
    var easings = {
        easeInQuad: function (t, b, c, d) {
            return c*(t/=d)*t+b
        },
        easeOutBack: function (t, b, c, d, s) {
            if (s == undefined) s = 1.70158
            return c*((t=t/d-1)*t*((s+1)*t+s)+1)+b
        }
    }

    function setStyle(el, prop, value, units) {
        try {
            if (prop in el.style) {
                el.style[prop] = value + (units || 'px')
            } else if (prop in el) {
                el[prop] = value // e.g. el.scrollTop
            }
        } catch (e) {}
    }

    function animate(el, params) {
        var ease = easings[params.easing],
            styleKeys = Object.keys(params.styles),
            startDate = (new Date).getTime()

        var drawFrame = function (progress) {
            styleKeys.forEach(function (prop) {
                var style = params.styles[prop]
                var value = ~~ease(
                    progress,
                    style.start,
                    style.end - style.start,
                    params.duration
                )
                setStyle(el, prop, value, style.units)
            })
        }

        var finalize = function () {
            styleKeys.forEach(function (prop) {
                var style = params.styles[prop]
                setStyle(el, prop, style.end, style.units)
            })
        }

        var loop = function (date) {
            var progress = date - startDate

            drawFrame(progress)

            if (progress < params.duration) {
                requestFrame(loop)
            } else {
                finalize()
                params.callback && params.callback()
            }
        }

        /* Launch animation. */
        loop(startDate)
    }

    return animate
}(window))