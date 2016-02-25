/*global module:false*/
module.exports = function (grunt) {
    var path = require('path');

    // Project configuration.
    grunt.initConfig({
        // Metadata.
        pkg: grunt.file.readJSON('package.json'),
        banner: '/*! <%= pkg.title || pkg.name %> <%= pkg.version %> (<%= new Date().toGMTString() %>)\n' +
            '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
            '* @license <%= pkg.license %> */',
        // Task configuration.
        clean : {
            build: [ 'dist' ]
        },
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
                    'src/drawer.*.js',
                    'src/html-init.js'
                ],
                dest: 'dist/wavesurfer.dev.js'
            }
        },
        connect: {
            options: {
	        base: '.',
	        port: 9000,
	        // Change this to '0.0.0.0' to access the server from outside.
	        hostname: 'localhost',
	        keepalive: true
	    }
        },
        /* The build has three steps:
         - concatenation (wavesurfer.dev.js)
         - UMD wrapping (wavesurfer.min.js)
         - uglification (wavesurfer.min.js again) */
        umd: {
            main: {
                options: {
                    src: '<%= concat.dist.dest %>',
                    dest: 'dist/wavesurfer.min.js',
                    amdModuleId: 'wavesurfer',
                    objectToExport: 'WaveSurfer',
                    globalAlias: 'WaveSurfer'
                }
            },
            plugins: {
                src: 'plugin/*.js',
                dest: 'dist',
                deps: {
                    'default': [ 'WaveSurfer' ],
                    amd: [ 'wavesurfer' ],
      	            cjs: [ 'wavesurfer.js' ],
                    global: [ 'WaveSurfer' ]
                }
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
                src: '<%= umd.main.options.dest %>',
                dest: '<%= umd.main.options.dest %>'
            },
            plugins: {
                files: [{
                    expand: true,
      	            cwd: 'dist',
      	            src: 'plugin/*.js',
      	            dest: 'dist/',
      	            rename: function (dest, src) {
                        if (src.indexOf('.min.js') == -1) {
                            return dest + src.replace('.js', '.min.js');
                        }
                        return dest + src;
                    }
      	        }]
            }
        },
        jshint: {
            options: {
                curly: true,
                eqeqeq: false,
                eqnull: true,
                quotmark: 'single',
                browser: true,
                // Missing "use strict" statement.
                strict: false,
                globals: {
                    WaveSurfer: true,
                    Promise: true
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
                    '-W097': true
                },
                src: [ '<%= concat.dist.src %>', 'plugin/*.js', 'spec/*.spec.js' ]
            }
        },
        jscs: {
            src: [ '<%= concat.dist.src %>', 'plugin/*.js', 'spec/*.spec.js' ],
            options: {
                config: '.jscsrc',
                esnext: false, // If you use ES6 http://jscs.info/overview.html#esnext
                verbose: true, // If you need output with rule names http://jscs.info/overview.html#verbose
                fix: false, // Autofix code style violations when possible.
                requireCurlyBraces: [ 'if' ]
            }
        },
        jasmine: {
            core: {
                src: '<%= concat.dist.src %>',
                options: {
                    specs: [ 'spec/*.spec.js' ],
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

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-jasmine');
    grunt.loadNpmTasks('grunt-coveralls');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-umd');
    grunt.loadNpmTasks('grunt-jscs');
    grunt.loadNpmTasks('grunt-contrib-clean');

    // Default task.
    grunt.registerTask('default', [
        'clean', 'jshint', 'jscs', 'test', 'coverage', 'concat', 'umd', 'uglify'
    ]);

    // Dev
    grunt.registerTask('dev', [ 'clean', 'concat', 'uglify', 'jscs', 'connect' ]);
    grunt.registerTask('test', [ 'jasmine:core' ]);
    grunt.registerTask('coverage', [ 'jasmine:coverage' ]);
};
