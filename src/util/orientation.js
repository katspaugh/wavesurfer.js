import utilCapitalize from './capitalize';

/**
 * @property {function} makeOrientation Factory for an Orientation object
 */

/**
 * Returns an appropriate Orientation object based on vertical.
 *
 * @param {HTMLElement} el The element being oriented
 * @param {bool} rtl Whether to reverse the direction of progress
 * @param {bool} vertical Whether the element is oriented vertically
 * @returns {OrientationBase} A HorizontalOrientation or VerticalOrientation object
 */
export default function makeOrientation(el, rtl, vertical) {
    if (vertical) {
        return new VerticalOrientation(el, rtl);
    } else {
        return new HorizontalOrientation(el, rtl);
    }
}

class OrientationBase {
    constructor(el, rtl) {
        if (this.constructor == OrientationBase) {
            throw new Error("Abstract class OrientationBase can't be instantiated. Use HorizontalOrientation or VerticalOrientation.");
        }

        this.rtl = rtl;
        this.el = el;
    }

    attrFor(horizontallyOrientedAttr) {
        return horizontallyOrientedAttr;
    }

    wrappedAttrFor(before, horizontallyOrientedAttr, after) {
        return before +
            utilCapitalize(this.attrFor(horizontallyOrientedAttr)) +
            utilCapitalize(after);
    }

    progressPixels(wrapperBbox, clientPos) {
        if (this.rtl) {
            return wrapperBbox[this.attrFor('right')] - clientPos;
        } else {
            return clientPos - wrapperBbox[this.attrFor('left')];
        }
    }

    canvasTransform(ctx) {
        return;
    }
}

/**
 * Orientation classes
 */
export class HorizontalOrientation extends OrientationBase {
}

export class VerticalOrientation extends OrientationBase {
    /**
     * Constants
     */
    static attrMapping = {
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
        bottom: 'right'
    }

    attrFor(horizontallyOrientedAttr) {
        return this.constructor.attrMapping[horizontallyOrientedAttr];
    }

    canvasTransform(ctx) {
        // reflect across y = -x
        ctx.setTransform(0, 1, 1, 0, 0, 0);
        super.canvasTransform(ctx);
    }
}
