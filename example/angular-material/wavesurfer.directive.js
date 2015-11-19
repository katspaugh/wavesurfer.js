/**
 * Created by intelWorx on 19/11/2015.
 */
(function () {
  'use strict';

  var app = angular.module('mdWavesurfer', ['ngMaterial']);

  app.factory('mdWavesurferUtils', function ($q, $document) {
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
  });
  ;
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

  app.controller('mdWavesurferAudioController', ['$attrs','$element',
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
          audio.playerProperties[nKey] = attributes[nKey];
        }
      }

      var setAutoPlay = function(){
        var controller = $element.find('md-wavesurfer-player').controller('mdWavesurferPlayer');
        if(controller && controller.surfer.isPlaying()){
          controller.autoPlay = true;
        }
      };
      audio.setTrack = function (idx) {
        if (audio.tracks.length > idx) {
          setAutoPlay();
          audio.currentTrack = audio.tracks[idx];
          audio.selectedIndex = idx;
        }
      };

      audio.extraButtons = [{
        icon: 'zmdi zmdi-skip-previous',
        title: 'Previous',
        action: function ($event) {
          if (audio.selectedIndex > 0) {
            audio.setTrack(audio.selectedIndex - 1);
          }
        }
      }, {
        icon: 'zmdi zmdi-skip-next',
        title: 'Next',
        action: function ($event) {
          if (audio.selectedIndex < audio.tracks.length - 1) {
            audio.setTrack(audio.selectedIndex + 1);
          }
        }
      }];


    }
  ]);

  app.directive('mdWavesurferAttributes', ['$compile',
    function ($compile) {
      return {
        restrict: 'A',
        transclude: true,
        link: function ($scope, $element, attrs) {
          var attributes = $scope.$eval(attrs.mdWavesurferAttributes) || {},
            properties =
              Object.keys(attributes),
            key, val;

          if (properties.length > 0) {
            for (var i = 0; i < properties.length; i++) {
              key = properties[i].replace(/[A-Z]/g, function (m) {
                return "-" + m.toLowerCase()
              });
              val = attributes[properties[i]];
              $element.attr(key, val);
            }
            $compile($element)($scope);
          }
        }
      };
    }
  ]);
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
              scope.duration = -1;
              console.log('Failed to get audio length, reason: ' + e);
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
          options = angular.extend(defaults, attributes, options);
          control.surfer.init(options);

          control.surfer.on('ready', function () {
            control.isReady = true;
            if(control.autoPlay){
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

      $scope.$watch('control.src', function () {
        initWaveSurfer();
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
  app.directive('mdWavesurferPlayer', function () {
    return {
      restrict: 'E',
      templateUrl: 'md-player.partial.html',
      scope: {
        src: '@',
        title: '@',
        extraButtons: '=',
        toolbarClass: '@',
        autoPlay: '='
      },
      controller: 'mdWavesurferPlayerController',
      controllerAs: 'control',
      bindToController: true
    };
  });
  ;
})();

