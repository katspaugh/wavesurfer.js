# npm install -g uglify-js

MIN=build/wavesurfer.min.js
SOURCE_MAP=build/wavesurfer-js-map.json
SOURCE_MAP_ROOT=/
SOURCES=src/wavesurfer.js\
        src/webaudio.js\
        src/drawer.js\
        src/drawer.*.js

$(MIN): $(SOURCES)
	uglifyjs -cm -o $@ $^ \
--source-map=$(SOURCE_MAP) --source-map-root=$(SOURCE_MAP_ROOT) \
--source-map-url=$(SOURCE_MAP_ROOT)$(SOURCE_MAP)
