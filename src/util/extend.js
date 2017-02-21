 /**
  * Extend an object shallowly with others
  *
  * @param {Object} dest The target object
  * @param {Object[]} sources The objects to use for extending
  *
  * @return {Object} Merged object
  */
export default function extend (dest, ...sources) {
    sources.forEach(source => {
        Object.keys(source).forEach(key => {
            dest[key] = source[key];
        });
    });
    return dest;
}
