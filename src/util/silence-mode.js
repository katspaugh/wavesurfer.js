/**
 * Ignores device silence mode when using the `WebAudio` backend.
 *
 * Many mobile devices contain a hardware button to mute the ringtone for incoming
 * calls and messages. Unfortunately, on some platforms like iOS, this also mutes
 * wavesurfer's audio when using the `WebAudio` backend. This function creates a
 * temporary `<audio>` element that makes sure the WebAudio backend keeps playing
 * when muting the device ringer.
 *
 * @since 5.2.0
 */
export default function ignoreSilenceMode() {
    // Set webaudio context with 1 second silent audio 44100 bit rate buffer to allow playing audio even if silent switch is on the device
    const silentAC = new AudioContext();
    const silentBS = silentAC.createBufferSource();
    silentBS.buffer = silentAC.createBuffer(1, 1, 44100);
    silentBS.connect(silentAC.destination);
    silentBS.start();

    // Set the src to a short bit of url encoded as a silent mp3
    // NOTE The silence MP3 must be high quality, when web audio sounds are played
    // in parallel the web audio sound is mixed to match the bitrate of the html sound
    // 0.01 seconds of silence VBR220-260 Joint Stereo 859B
    const audioData = "data:audio/mpeg;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAABhTEFNRTMuMTAwA8MAAAAAAAAAABQgJAUHQQAB9AAAAnGMHkkIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADgnABGiAAQBCqgCRMAAgEAH///////////////7+n/9FTuQsQH//////2NG0jWUGlio5gLQTOtIoeR2WX////X4s9Atb/JRVCbBUpeRUq//////////////////9RUi0f2jn/+xDECgPCjAEQAABN4AAANIAAAAQVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";

    // disable iOS Airplay (setting the attribute in js doesn't work)
    let tmp = document.createElement("div");
    tmp.innerHTML = '<audio x-webkit-airplay="deny"></audio>';

    let audioSilentMode = tmp.children.item(0);
    audioSilentMode.src = audioData;
    audioSilentMode.preload = "auto";
    audioSilentMode.type = "audio/mpeg";
    audioSilentMode.disableRemotePlayback = true;

    // play
    audioSilentMode.play();

    // cleanup
    audioSilentMode.remove();
    tmp.remove();
}
