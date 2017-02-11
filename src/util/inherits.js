/**
* es2015 class extends shim, used for etending classes without using the class
* syntax (for example to iteratively build the plugins) – The code was taken
* from the webpack build, it is how the class syntax is actually being
* implemented
*
* @param  {type} subClass - The class to extend
* @param  {type} superClass - The super class
*/
export default function inherits (subClass, superClass) {
    if (typeof superClass !== 'function' && superClass !== null) {
        throw new TypeError(`Super expression must either be null or a function, not ${typeof superClass}`);
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });
    /* eslint-disable no-proto */
    if (superClass) {
        Object.setPrototypeOf
            ? Object.setPrototypeOf(subClass, superClass)
            : subClass.__proto__ = superClass;
    }
    /* eslint-enable no-proto */
}
