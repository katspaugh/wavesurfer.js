import utilCapitalize from './capitalize';
import 'proxy-polyfill/proxy.min.js';

/**
 * @property {function} makeOrientation Factory for an Orientation object
 */

const verticalPropMap = {
    width: 'height',
    height: 'width',

    overflowX: 'overflowY',
    overflowY: 'overflowX',

    clientWidth: 'clientHeight',
    clientHeight: 'clientWidth',

    clientX: 'clientY',
    clientY: 'clientX',

    scrollWidth: 'scrollHeight',
    scrollLeft: 'scrollTop',

    offsetLeft: 'offsetTop',
    offsetHeight: 'offsetWidth',

    left: 'top',
    right: 'bottom',
    top: 'left',
    bottom: 'right',

    borderRightStyle: 'borderBottomStyle',
    borderRightWidth: 'borderBottomWidth',
    borderRightColor: 'borderBottomColor'
};

/**
 * Convert a horizontally-oriented property name to a vertical one.
 *
 * @param {string} prop A property name
 * @param {bool} vertical Whether the element is oriented vertically
 * @returns {string} prop, converted appropriately
 */
function mapProp(prop, vertical) {
    if (Object.prototype.hasOwnProperty.call(verticalPropMap, prop)) {
        return vertical ? verticalPropMap[prop] : prop;
    } else {
        return prop;
    }
}

/**
 * Returns an appropriately oriented object based on vertical.
 *
 * @param {object} target The object to be wrapped and oriented
 * @param {bool} vertical Whether the element is oriented vertically
 * @returns {Proxy} An oriented object with attr translation via verticalAttrMap
 */
export default function withOrientation(target, vertical) {
    return new Proxy(
        target, {
            get: function(obj, prop, receiver) {
                if (prop === 'style') {
                    return withOrientation(obj.style, vertical);
                } else if (prop === 'canvas') {
                    return withOrientation(obj.canvas, vertical);
                } else if (prop === 'getBoundingClientRect') {
                    return function(...args) {
                        return withOrientation(obj.getBoundingClientRect(...args), vertical);
                    };
                } else if (prop === 'getContext') {
                    return function(...args) {
                        return withOrientation(obj.getContext(...args), vertical);
                    };
                } else {
                    let value = obj[mapProp(prop, vertical)];
                    return typeof value == 'function' ? value.bind(obj) : value;
                }
            },
            set: function(obj, prop, value) {
                obj[mapProp(prop, vertical)] = value;
                return true;
            }
        }
    );
}

// Cursors: used where?
// return 'col-resize';
// return 'row-resize';
