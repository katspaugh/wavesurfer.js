/**
 * Apply audio effects
 *
 * @param {Object} effects The map of available properties per effect
 *
 */
export default function audioEffect(effect) {
  
  if(effect.type=='fadeIn){
      let fadeInStart = 0;
      function doFadeIn(length){
        let fadeInLength = effect.length||5000;

        if (!fadeInStart){
            fadeInStart = fadeInLength;
        }
        var fadeInProgress = fadeInLength - fadeInStart;
        effect.wavesurfer.setVolume(fadeInProgress / 5000);
        if (fadeInProgress < 5000) {
            window.requestAnimationFrame(doFadeIn);
        }     
      }
      if(!effect.length){ 
        fadeInStart = 0;
      } else{
        doFadeIn(); 
      }
  }
  
}
