import reqAnimationFrame from './request-animation-frame';

/**
 * Create a function which will be called at the next requestAnimationFrame
 * cycle
 *
 * @param func The function to call
 *
 * @return The function wrapped within a requestAnimationFrame
 */
export default function frame(func: Function): Function {
    return (...args: any[]) => reqAnimationFrame(() => func(...args));
}
