# npm install -g uglify-js

VERSION=`node -pe 'require("./package.json").version'`
PREAMBLE="/* wavesurfer.js v $(VERSION) @license CC-BY 3.0 */"
BUILD_DIR=build
MIN=$(BUILD_DIR)/wavesurfer.min.js
AMD=$(BUILD_DIR)/wavesurfer.amd.js
CJS=$(BUILD_DIR)/wavesurfer.cjs.js
SOURCE_MAP=wavesurfer-js-map.json
SOURCE_MAP_ROOT=/
SOURCES=src/wavesurfer.js\
	src/util.js\
        src/webaudio.js\
        src/mediaelement.js\
        src/drawer.js\
        src/drawer.*.js

$(MIN): $(SOURCES)
	uglifyjs --lint -cm -o $@ $^ \
--source-map=$(BUILD_DIR)/$(SOURCE_MAP) --source-map-root=$(SOURCE_MAP_ROOT) \
--source-map-url=$(SOURCE_MAP) \
--preamble=$(PREAMBLE)

amd: $(SOURCES)
	echo $(PREAMBLE)" define(function () {" > $(AMD)
	uglifyjs $^ -cm >> $(AMD)
	echo "\n;return WaveSurfer; });" >> $(AMD)

cjs: $(SOURCES)
	cat $^ >> $(CJS)
	echo "\nmodule.exports = WaveSurfer;" >> $(CJS)

.PHONY: amd cjs
