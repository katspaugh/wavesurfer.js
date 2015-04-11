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
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: false,
        eqnull: true,
        quotmark: "single",
        browser: true,
        // Missing "use strict" statement.
        strict: false,
        globals: {
          WaveSurfer: true
        },
      },
      ignore_warning: {
        options: {
          '-W004': true,
          // Expected an assignment or function call and instead saw an expression
          '-W030': true,
          // {a} used out of scope
          '-W038': true,
          // Use '!==' to compare with ''
          '-W041': true,
          '-W056': true,
          // Missing '()' invoking a constructor.
          '-W058': true,
          '-W079': true,
          // Use the function form of 'use strict'
          '-W097': true,
        },
        src: ['<%= concat.dist.src %>', 'plugin/*.js', 'spec/*.spec.js']
      },
    },
    jasmine: {
      core: {
        src: '<%= concat.dist.src %>',
        options: {
          specs: ['spec/*.spec.js'],
          vendor: [
            'node_modules/jasmine-expect/dist/jasmine-matchers.js'
          ]
        }
      },
      coverage: {
        src: '<%= concat.dist.src %>',
        options: {
          specs: '<%= jasmine.core.options.specs %>',
          vendor: '<%= jasmine.core.options.vendor %>',
          template: require('grunt-template-jasmine-istanbul'),
          templateOptions: {
            coverage: 'coverage/coverage.json',
            report: [
            {
              type: 'lcov',
              options: {
                dir: 'coverage/lcov'
              }
            },
            {
              type: 'html',
              options: {
                dir: 'coverage/html'
              }
            }]
          }
        }
      }
    },
    coveralls: {
      options: {
        force: true
      },
      main_target: {
        src: 'coverage/lcov/lcov.info'
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
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-coveralls');

  // Default task.
  grunt.registerTask('default', ['jshint', 'test', 'coverage', 'concat', 'commonjs',
                                 'amd', 'uglify']);

  // Dev
  grunt.registerTask('dev', ['concat', 'uglify']);
  grunt.registerTask('test', ['jasmine:core']);
  grunt.registerTask('coverage', ['jasmine:coverage']);
};
