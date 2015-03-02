/*global module:false*/
module.exports = function(grunt) {

  var path = require('path');

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.title || pkg.name %> <%= pkg.version %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* @license <%= pkg.license %> */',
    // Task configuration.
    concat: {
      options: {
        stripBanners: true
      },
      dist: {
        src: [
          'src/wavesurfer.js',
          'src/util.js',
          'src/webaudio.js',
          'src/mediaelement.js',
          'src/drawer.js',
          'src/drawer.*.js'
        ],
        dest: 'dist/wavesurfer.min.js'
      }
    },
    commonjs: {
      modules: {
        banner: '<%= banner %>',
        cwd: 'dist',
        src: ['*.min.js'],
        dest: 'dist/wavesurfer.cjs.js'
      }
    },
    amd: {
      modules: {
        banner: '<%= banner %>',
        cwd: 'dist',
        src: ['*.min.js'],
        dest: 'dist/wavesurfer.amd.js'
      }
    },
    uglify: {
      options: {
        banner: '<%= banner %>'
      },
      dist: {
        options: {
          sourceMap: 'dist/wavesurfer.min.js.map',
          sourceMapRoot: '/'
        },
        src: '<%= concat.dist.src %>',
        dest: '<%= concat.dist.dest %>'
      },
      plugins: {
        files: grunt.file.expandMapping(['plugin/*.js'], 'dist/', {
          rename: function(destBase, destPath) {
            var newPath = destBase + destPath.replace('.js', '.min.js');
            return newPath;
          },
        })
      }
    }
  });

  // ==========================================================================
  // TASKS
  // ==========================================================================

  grunt.registerMultiTask('commonjs', 'Wrap .js files for commonjs.', function () {
    this.files.forEach(function(file) {
      return file.src.map(function(filepath) {
        var original = grunt.file.read(path.join(file.cwd, filepath));
        return grunt.file.write(file.dest, file.banner + '\n' +
          original + '\nmodule.exports = WaveSurfer;');
      });
    });
  });

  grunt.registerMultiTask('amd', 'Wrap .js files for AMD.', function () {
    this.files.forEach(function(file) {
      return file.src.map(function(filepath) {
        var definePath = (filepath.replace(/\.\w+$/, '')),
        original = grunt.file.read(path.join(file.cwd, filepath));
        return grunt.file.write(file.dest, file.banner + 
          '\ndefine(function () {\n' + original + '\nreturn WaveSurfer;\n});');
      });
    });
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // Default task.
  grunt.registerTask('default', ['concat', 'commonjs', 'amd', 'uglify']);

};
