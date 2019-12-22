/**
 * Create a function which will be called at the next requestAnimationFrame
 * cycle
 *
 * @param {function} func The function to call
 *
 * @return {func} The function wrapped within a requestAnimationFrame
 */
export default function frame(func) {
    console.warn(
        'util.frame is deprecated; use window.requestAnimationFrame instead'
    );
    return (...args) => window.requestAnimationFrame(() => func(...args));
}
