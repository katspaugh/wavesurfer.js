import type { GenericPlugin } from './base-plugin.js';
import Player from './player.js';
export type WaveSurferOptions = {
    /** Required: an HTML element or selector where the waveform will be rendered. */
    container: HTMLElement | string;
    /** The height of the waveform in pixels, or "auto" to fill the container height */
    height?: number | 'auto';
    /** The color of the waveform */
    waveColor?: string | string[] | CanvasGradient;
    /** The color of the progress mask */
    progressColor?: string | string[] | CanvasGradient;
    /** The color of the playpack cursor */
    cursorColor?: string;
    /** The cursor width */
    cursorWidth?: number;
    /** If set, the waveform will be rendered with bars like this: ▁ ▂ ▇ ▃ ▅ ▂ */
    barWidth?: number;
    /** Spacing between bars in pixels */
    barGap?: number;
    /** Rounded borders for bars */
    barRadius?: number;
    /** A vertical scaling factor for the waveform */
    barHeight?: number;
    /** Vertical bar alignment */
    barAlign?: 'top' | 'bottom';
    /** Minimum pixels per second of audio (i.e. the zoom level) */
    minPxPerSec?: number;
    /** Stretch the waveform to fill the container, true by default */
    fillParent?: boolean;
    /** Audio URL */
    url?: string;
    /** Pre-computed audio data, arrays of floats for each channel */
    peaks?: Array<Float32Array | number[]>;
    /** Pre-computed audio duration in seconds */
    duration?: number;
    /** Use an existing media element instead of creating one */
    media?: HTMLMediaElement;
    /** Whether to show default audio element controls */
    mediaControls?: boolean;
    /** Play the audio on load */
    autoplay?: boolean;
    /** Pass false to disable clicks on the waveform */
    interact?: boolean;
    /** Hide the scrollbar */
    hideScrollbar?: boolean;
    /** Audio rate, i.e. the playback speed */
    audioRate?: number;
    /** Automatically scroll the container to keep the current position in viewport */
    autoScroll?: boolean;
    /** If autoScroll is enabled, keep the cursor in the center of the waveform during playback */
    autoCenter?: boolean;
    /** Decoding sample rate. Doesn't affect the playback. Defaults to 8000 */
    sampleRate?: number;
    /** Render each audio channel as a separate waveform */
    splitChannels?: WaveSurferOptions[];
    /** Stretch the waveform to the full height */
    normalize?: boolean;
    /** The list of plugins to initialize on start */
    plugins?: GenericPlugin[];
    /** Custom render function */
    renderFunction?: (peaks: Array<Float32Array | number[]>, ctx: CanvasRenderingContext2D) => void;
    /** Options to pass to the fetch method */
    fetchParams?: RequestInit;
};
declare const defaultOptions: {
    waveColor: string;
    progressColor: string;
    cursorWidth: number;
    minPxPerSec: number;
    fillParent: boolean;
    interact: boolean;
    autoScroll: boolean;
    autoCenter: boolean;
    sampleRate: number;
};
export type WaveSurferEvents = {
    /** When audio starts loading */
    load: [url: string];
    /** During audio loading */
    loading: [percent: number];
    /** When the audio has been decoded */
    decode: [duration: number];
    /** When the audio is both decoded and can play */
    ready: [duration: number];
    /** When a waveform is drawn */
    redraw: [];
    /** When the audio starts playing */
    play: [];
    /** When the audio pauses */
    pause: [];
    /** When the audio finishes playing */
    finish: [];
    /** On audio position change, fires continuously during playback */
    timeupdate: [currentTime: number];
    /** An alias of timeupdate but only when the audio is playing */
    audioprocess: [currentTime: number];
    /** When the user seeks to a new position */
    seeking: [currentTime: number];
    /** When the user interacts with the waveform (i.g. clicks or drags on it) */
    interaction: [newTime: number];
    /** When the user clicks on the waveform */
    click: [relativeX: number];
    /** When the user drags the cursor */
    drag: [relativeX: number];
    /** When the waveform is scrolled (panned) */
    scroll: [visibleStartTime: number, visibleEndTime: number];
    /** When the zoom level changes */
    zoom: [minPxPerSec: number];
    /** Just before the waveform is destroyed so you can clean up your events */
    destroy: [];
};
declare class WaveSurfer extends Player<WaveSurferEvents> {
    options: WaveSurferOptions & typeof defaultOptions;
    private renderer;
    private timer;
    private plugins;
    private decodedData;
    protected subscriptions: Array<() => void>;
    /** Create a new WaveSurfer instance */
    static create(options: WaveSurferOptions): WaveSurfer;
    /** Create a new WaveSurfer instance */
    constructor(options: WaveSurferOptions);
    private initTimerEvents;
    private initPlayerEvents;
    private initRendererEvents;
    private initPlugins;
    /** Set new wavesurfer options and re-render it */
    setOptions(options: Partial<WaveSurferOptions>): void;
    /** Register a wavesurfer.js plugin */
    registerPlugin<T extends GenericPlugin>(plugin: T): T;
    /** For plugins only: get the waveform wrapper div */
    getWrapper(): HTMLElement;
    /** Get the current scroll position in pixels */
    getScroll(): number;
    /** Get all registered plugins */
    getActivePlugins(): GenericPlugin[];
    loadAudio(url: string, blob?: Blob, channelData?: WaveSurferOptions['peaks'], duration?: number): Promise<void>;
    /** Load an audio file by URL, with optional pre-decoded audio data */
    load(url: string, channelData?: WaveSurferOptions['peaks'], duration?: number): Promise<void>;
    /** Load an audio blob */
    loadBlob(blob: Blob, channelData?: WaveSurferOptions['peaks'], duration?: number): Promise<void>;
    /** Zoom the waveform by a given pixels-per-second factor */
    zoom(minPxPerSec: number): void;
    /** Get the decoded audio data */
    getDecodedData(): AudioBuffer | null;
    /** Get decoded peaks */
    exportPeaks({ channels, maxLength, precision }?: {
        channels?: number | undefined;
        maxLength?: number | undefined;
        precision?: number | undefined;
    }): Array<number[]>;
    /** Get the duration of the audio in seconds */
    getDuration(): number;
    /** Toggle if the waveform should react to clicks */
    toggleInteraction(isInteractive: boolean): void;
    /** Seek to a percentage of audio as [0..1] (0 = beginning, 1 = end) */
    seekTo(progress: number): void;
    /** Play or pause the audio */
    playPause(): Promise<void>;
    /** Stop the audio and go to the beginning */
    stop(): void;
    /** Skip N or -N seconds from the current position */
    skip(seconds: number): void;
    /** Empty the waveform by loading a tiny silent audio */
    empty(): void;
    /** Unmount wavesurfer */
    destroy(): void;
}
export default WaveSurfer;
