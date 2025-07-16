import Wavesurfer from './wavesurfer';
export declare function makeDraggable(element: HTMLElement | null, onDrag: (dx: number, dy: number, x: number, y: number) => void, onStart?: (x: number, y: number) => void, onEnd?: (x: number, y: number) => void, wavesurfer?: Wavesurfer, threshold?: number, mouseButton?: number, touchDelay?: number): () => void;
