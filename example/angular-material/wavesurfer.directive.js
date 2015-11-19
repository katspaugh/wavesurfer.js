/**
 * Created by intelWorx on 19/11/2015.
 */
(function () {
  'use strict';

  /**
   * Main module, your application should depend on this
   * @module {mdWavesurfer}
   */
  var app = angular.module('mdWavesurfer', ['ngMaterial']);

  /**
   * @ngdoc service
   * @name $mdWavesurferUtils
   *
   * @description
   *
   * Utility service for this directive, exposes method:
   *  - getLength(url), which returns a promise for the length of the audio specified by URL
   *
   * ```js
   * app.directive('myFancyDirective', function(mdWavesurferUtils) {
   *   return {
   *     restrict: 'e',
   *     link: function(scope, el, attrs) {
   *       mdWavesurferUtils(attrs.url)
   *       .then(function(l){
   *        scope.length = l;
   *       }, function(){
   *          someErrorhandler()
   *       })
   *       ;
   *     }
   *   };
   * });
   * ```
   */
  app.factory('mdWavesurferUtils', ['$q', '$document', '$timeout',
    function ($q, $document, $timeout) {
      return {
        getLength: function (object) {
          var deferred = $q.defer();
          var estimateLength = function (url) {
            var audio = $document[0].createElement('audio');
            audio.src = url;
            audio.addEventListener('loadeddata', function listener() {
              deferred.resolve(this.duration);
              audio.removeEventListener('loadeddata', listener);
              audio.src = 'data:audio/mpeg,0';//destroy loading.
            });

            audio.addEventListener('error', function (e) {
              deferred.resolve(e.target.error);
            });
          };

          if (typeof object === 'string') {
            //this is a URL
            estimateLength(object);
          } else {
            $timeout(function () {
              deferred.reject(new DOMError("NotSupportedError", "Specified argument is not supported"));
            });
          }

          return deferred.promise;
        }
      };
    }
  ]);

  /**
   * @ngdoc filter
   * @name mdWavesurferTimeFormat
   *
   * Simple filter to convert value in seconds to MM:SS format
   *
   * @param Number duration in seconds
   */
  app.filter('mdWavesurferTimeFormat', function () {
    return function (input) {
      if (!input) {
        return "00:00";
      }

      var minutes = Math.floor(input / 60);
      var seconds = Math.ceil(input) % 60;

      return (minutes < 10 ? '0' : '')
        + minutes
        + ":"
        + (seconds < 10 ? '0' : '') + seconds;
    };
  });


  app.controller('mdWavesurferAudioController', ['$attrs', '$element',
    function (attributes, $element) {
      var audio = this;

      audio.tracks = [];
      audio.selectedIndex = audio.selectedIndex || 0;
      audio.currentTrack = null;

      //adds to an audio track
      audio.addTrack = function (trackScope) {
        if (audio.tracks.indexOf(trackScope) < 0) {
          audio.tracks.push(trackScope);
        }

        if (!audio.currentTrack) {
          audio.currentTrack = audio.tracks[audio.selectedIndex];
        }
      };

      //remove audio track
      audio.removeTrack = function (trackScope) {
        var idx = audio.tracks.indexOf(trackScope);
        if (idx >= 0) {
          audio.tracks.splice(idx, 1);
        }
      };

      audio.playerProperties = {}
      var nKey;
      for (var attr in attributes) {
        if (attr.match(/^player/)) {
          nKey = attr.replace(/^player([A-Z])/, function (m, $1) {
            return $1.toLowerCase();
          });
          audio.playerProperties[nKey] = attributes[attr];
        }
      }

      var getPlayer = function(){
        return $element.find('md-wavesurfer-player').controller('mdWavesurferPlayer');
      };
      var setAutoPlay = function (forcePlay) {
        var controller = getPlayer();
        if (controller && (forcePlay || controller.surfer.isPlaying())) {
          controller.autoPlay = true;
        }
      };
      audio.setTrack = function (idx, forcePlay) {
        if (audio.tracks.length > idx) {
          if (audio.selectedIndex === idx) {
            var ctrl = getPlayer();
            ctrl.surfer.playPause();
          } else {
            setAutoPlay(forcePlay);
            audio.currentTrack = audio.tracks[idx];
            audio.selectedIndex = idx;
          }
        }
      };

      audio.extraButtons = [{
        icon: 'zmdi zmdi-skip-previous',
        title: 'Previous',
        action: function ($event) {
          if (audio.selectedIndex > 0) {
            audio.setTrack(audio.selectedIndex - 1);
          }
        },
        class: ''
      }, {
        icon: 'zmdi zmdi-skip-next',
        title: 'Next',
        action: function ($event) {
          if (audio.selectedIndex < audio.tracks.length - 1) {
            audio.setTrack(audio.selectedIndex + 1);
          }
        },
        class: ''
      }];


    }
  ]);

  /**
   * @ngdoc directive
   * @name md-wavesurfer-audio
   *
   * Directive for playing a set of audio files. This directive is analogous to `<audio>` HTML tag.
   * The audio files, should be specified using the  `md-wavesurfer-source`
   *
   * WaveSurfer properties can be passed in using the prefix : player-* for attributes, e.g. `player-wave-color` is
   * equivalent to WaveSurfer's waveColor option.
   *
   * Must be used as an element.
   *
   * @usage
   * ```html
   * <md-wavesurfer-audio player-wave-color="gray" player-progress-color="black" player-backend="MediaElement">
   *   <md-wavesurfer-source src="source1" title="Title-1"></md-wavesurfer-source>
   *   <md-wavesurfer-source src="source2" title="Title-2"></md-wavesurfer-source>
   *   <md-wavesurfer-source src="source3" title="Title-3"></md-wavesurfer-source>
   *   ...
   *   <md-wavesurfer-source src="sourceN" title="Рассказы о сновидениях"></md-wavesurfer-source>
   * </md-wavesurfer-audio>
   * ```
   *
   * @param string player-* specifies WaveSurfer properties.
   *
   */
  app.directive('mdWavesurferAudio', [
    function () {
      return {

        restrict: 'E',
        templateUrl: 'md-player-audio.partial.html',
        transclude: true,
        controller: 'mdWavesurferAudioController',
        controllerAs: 'audio'
      };
    }
  ]);

  /**
   * @ngdoc directive
   *
   * @name md-wavesurfer-source
   *
   * This directive is used within the `md-wavesurfer-audio` directive to specify an audio file source, it is
   * synonymous to `<source>` tag in HTML
   *
   * The directive cannot be used as standalone.
   *
   * @usage
   *
   * ```html
   *   <md-wavesurfer-source src="source3" title="Title-3" album-art="Album-Art-Url" duration=""></md-wavesurfer-source>
   * ```
   * @param String src the URL to the audio file, this is required.
   * @param String title track title
   * @param String album-art the album art URL
   * @param Number duration the length of the audio file in seconds, will be auto-detected if not specified.
   *
   */
  app.directive('mdWavesurferSource', ['mdWavesurferUtils',
    function (mdWavesurferUtils) {
      return {
        restrict: 'E',
        require: '^mdWavesurferAudio',
        scope: {
          src: '@',
          albumArt: '@',
          title: '@',
          duration: '='
        },
        link: function (scope, element, attrs, audio) {
          audio.addTrack(scope);

          if (!scope.duration) {
            mdWavesurferUtils.getLength(scope.src).then(function (dur) {
              scope.duration = dur;
            }, function (e) {
              scope.duration = 0;
              console.log('Failed to get audio length, reason: ', e.message);
            });
          }

          element.on('$destroy', function () {
            audio.removeTrack(audio);
          });
        }
      };
    }
  ]);

  app.controller('mdWavesurferPlayerController', ['$element', '$scope', '$attrs', '$interval', '$mdTheming',
    function ($element, $scope, attributes, $interval, $mdTheme) {
      var control = this, timeInterval;

      control.themeClass = "md-" + $mdTheme.defaultTheme() + "-theme";
      control.isReady = false;
      control.surfer = null;

      control.toggleMute = function () {
        if (control.surfer) {
          control.surfer.toggleMute();
          control.isMute = !control.isMute;
        }
      };

      var initWaveSurfer = function () {
        control.isReady = false;
        control.currentTime = 0;
        if (!control.surfer) {
          control.surfer = Object.create(window.WaveSurfer);
          var options = {
            container: $element[0].querySelector('.waveSurferWave')
          }, defaults = {
            scrollParent: true,
            waveColor: 'violet',
            progressColor: 'purple'
          };

          options = angular.extend(defaults, attributes, (control.properties || {}), options);
          control.surfer.init(options);

          control.surfer.on('ready', function () {
            control.isReady = true;
            if (control.autoPlay) {
              control.surfer.play();
            }
            $scope.$apply();
          });

          control.surfer.on('pause', function () {
            stopInterval();
          });

          control.surfer.on('finish', function () {
            stopInterval();
          });

          control.surfer.on('play', function () {
            startInterval();
          });

        }

        control.title = control.title || control.src.split('/').pop();
        control.surfer.load(control.src);
      };

      var startInterval = function () {
        timeInterval = $interval(function () {
          control.currentTime = control.isReady ? control.surfer.getCurrentTime() : 0;
        }, 1000);
      }, stopInterval = function () {
        $interval.cancel(timeInterval);
      };


      initWaveSurfer();

      $scope.$watch('control.src', function (src1, src2) {
        if (src1 != src2) {
          initWaveSurfer();
        }
      });

      $element.on('$destroy', function () {
        if (control.surfer) {
          control.surfer.destroy();
        }
        stopInterval();
      });

      $scope.$watch(function () {
        var div = $element[0].querySelector('.audioPlayerWrapper');
        return div ? div.offsetWidth : 0;
      }, function (width) {
        if (width < 1) {
          //hidden
          control.surfer.pause();
        }
      });
    }
  ]);

  /**
   * @ngdoc directive
   *
   * @name md-wavesurfer-player
   *
   * @usage
   * This directive can be used as a stand-alone directive to display Audio WaveSurfer with a few controls, by default
   * this will only display play/pause, fast-forward, rewind and mute toggle buttons, however, you can add extra
   * buttons using the `extra-buttons` parameters.
   *
   * ```html
   *  <md-wavesurfer-player url="trackUrl" title="Track Title"
   *         extra-buttons="extraButtons" properties="properties">
   *  </md-wavesurfer-player>
   * ```
   *
   * @param {string} url the URL of the audio file
   * @param {string} title title of the audio track
   * @param {object} properties an object specifying init options for WaveSurfer
   * @param {boolean} auto-play specifies if the player should start as soon as it's loaded.
   * @param {object[]} extra-buttons a list of extra buttons to add to the control panel
   *    each button should be an object with the following properties:
   *    {
   *      title: "button title"
   *      action: "call back to call when button is clicked, executed in parent scope",
   *      icon: "md-font-icon parameter for the button"
   *      class: "extra classes to add to the button."
   *    }
   *
   * Every other attribute passed to this directive is assumed to a WaveSurver init parameter.
   */
  app.directive('mdWavesurferPlayer', function () {
    return {
      restrict: 'E',
      templateUrl: 'md-player.partial.html',
      scope: {
        src: '@url',
        title: '@',
        extraButtons: '=',
        toolbarClass: '@',
        autoPlay: '=',
        properties: '='
      },
      controller: 'mdWavesurferPlayerController',
      controllerAs: 'control',
      bindToController: true
    };
  });
  ;
})();

