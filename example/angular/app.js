/* global angular */

let app = angular.module('ngWavesurfer', []);

app.directive('ngWavesurfer', function() {
    return {
        restrict: 'E',

        link: function($scope, $element, $attrs) {
            $element.css('display', 'block');

            let options = angular.extend({ container: $element[0] }, $attrs);
            let wavesurfer = WaveSurfer.create(options);

            if ($attrs.url) {
                wavesurfer.load($attrs.url, $attrs.data || null);
            }

            $scope.$emit('wavesurferInit', wavesurfer);
        }
    };
});

app.controller('PlaylistController', function($scope) {
    let activeUrl = null;

    $scope.paused = true;

    $scope.$on('wavesurferInit', function(e, wavesurfer) {
        $scope.wavesurfer = wavesurfer;

        $scope.wavesurfer.on('play', function() {
            $scope.paused = false;
        });

        $scope.wavesurfer.on('pause', function() {
            $scope.paused = true;
        });

        $scope.wavesurfer.on('finish', function() {
            $scope.paused = true;
            $scope.wavesurfer.seekTo(0);
            $scope.$apply();
        });
    });

    $scope.play = function(url) {
        if (!$scope.wavesurfer) {
            return;
        }

        activeUrl = url;

        $scope.wavesurfer.once('ready', function() {
            $scope.wavesurfer.play();
            $scope.$apply();
        });

        $scope.wavesurfer.load(activeUrl);
    };

    $scope.isPlaying = function(url) {
        return url == activeUrl;
    };
});
