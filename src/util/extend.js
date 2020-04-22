/* eslint no-console: ["error", { allow: ["warn"] }] */
/**
 * Extend an object shallowly with others
 *
 * @param {Object} dest The target object
 * @param {Object[]} sources The objects to use for extending
 *
 * @return {Object} Merged object
 * @deprecated since version 3.3.0
 */
export default function extend(dest, ...sources) {
    console.warn('util.extend is deprecated; use Object.assign instead');
    sources.forEach(source => {
        Object.keys(source).forEach(key => {
            dest[key] = source[key];
        });
    });
    return dest;
}
