 /**
  * extend - Extend an object shallowly with others
  *
  * @param {type}  dest    The target object
  * @param {array} sources The objects to use for extending
  *
  * @returns {type} Description
  */
 export default function extend (dest, ...sources) {
    sources.forEach(source => {
        Object.keys(source).forEach(key => {
            dest[key] = source[key];
        });
    });
    return dest;
}
