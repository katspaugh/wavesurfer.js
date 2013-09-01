MIN=example/wavesurfer.min.js
SOURCES=src/wavesurfer.js\
        src/webaudio.js\
        src/drawer.js\
        src/drawer.*.js

$(MIN): $(SOURCES)
	uglifyjs2 -cm -o $@ $^
