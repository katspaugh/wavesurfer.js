/**
 * Returns the requestAnimationFrame function for the browser, or a shim with
 * setTimeout if none is found
 *
 * @return {function}
 */
export default (window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    ((callback, element) => setTimeout(callback, 1000 / 60))
).bind(window);
