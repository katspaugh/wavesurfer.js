/**
 * @property {function} makeOrientation Factory for an Orientation object
 */

/**
 * Returns an appropriate Orientation object based on vertical.
 *
 * @param {number} mainAxisSize The nominal length of the main axis
 * @param {number} crossAxisSize The length of the cross axis
 * @param {HTMLElement} el The element being oriented
 * @param {bool} rtl Whether to reverse the direction of progress
 * @param {bool} vertical Whether the element is oriented vertically
 * @returns {OrientationBase} A HorizontalOrientation or VerticalOrientation object
 */
export default function makeOrientation(mainAxisSize, crossAxisSize, el, rtl, vertical) {
    if (vertical) {
        return new VerticalOrientation(mainAxisSize, crossAxisSize, el, rtl);
    } else {
        return new HorizontalOrientation(mainAxisSize, crossAxisSize, el, rtl);
    }
}

class OrientationBase {
    constructor(mainAxisSize, crossAxisSize, rtl, el) {
        if (this.constructor == OrientationBase) {
            throw new Error("Abstract class OrientationBase can't be instantiated. Use HorizontalOrientation or VerticalOrientation.");
        }

        this.mainAxisSize = mainAxisSize;
        this.crossAxisSize = crossAxisSize;
        this.rtl = rtl;
        this.el = el;
    }

    nominalMainAxisSize() {
        return this.mainAxisSize;
    }

    nominalCrossAxisSize() {
        return this.crossAxisSize;
    }

    mainAxisSize(el = this.el) {
        return el[this.mainAxisSizeAttr];
    }

    scrollSize(el = this.el) {
        return el.wrapper[this.scrollSizeAttr];
    }

    scrollAmount(el = this.el) {
        return el.wrapper[this.scrollAmountAttr];
    }

    mainAxisClientSize(el = this.el) {
        return el.wrapper[this.mainAxisClientSizeAttr];
    }

    mainAxisClientLocation(obj) {
        return obj[this.mainAxisClientLocationAttr];
    }

    crossAxisClientLocation(obj) {
        return obj[this.crossAxisClientLocationAttr];
    }

    progressPixels() {
        let bbox = this.bboxDimensions();

        return this.rtl ? bbox.mainAxisEnd - location : location - bbox.mainAxisBegin;
    }

    scrollbarThickness() {
        return this.el.wrapper[this.crossAxisOffsetSizeAttr] -
            this.el.wrapper[this.clientCrossAxisSizeAttr];
    }

    canvasTransform(ctx) {
        if (this.rtl) {
            ctx.scale(-1, 1);
        }
    }

    toAbsolute(point) {
        return {
            x: point.mainAxis,
            y: point.crossAxis
        };
    }
}

/**
 * Orientation classes
 */
export class HorizontalOrientation {
    /**
     * Constants
     */
    static get mainAxisSizeAttr() { return 'width'; }
    static get crossAxisSizeAttr() { return 'height'; }

    static get mainAxisOverflowAttr() { return 'overflowX'; }
    static get crossAxisOverflowAttr() { return 'overflowY'; }

    static get mainAxisClientSizeAttr() { return 'clientWidth'; }
    static get crossAxisClientSizeAttr() { return 'clientHeight'; }

    static get mainAxisClientLocationAttr() { return 'clientX'; }
    static get crossAxisClientLocationAttr() { return 'clientY'; }

    static get scrollSizeAttr() { return 'scrollWidth'; }
    static get scrollAmountAttr() { return 'scrollLeft'; }

    static get mainAxisOffsetLocationAttr() { return 'offsetLeft'; }
    static get crossAxisOffsetSizeAttr() { return 'offsetHeight'; }

    static get mainAxisPositionStartAttr() { return 'left'; }
    static get mainAxisPositionEndAttr() { return 'right'; }
    static get crossAxisPositionStartAttr() { return 'top'; }
    static get crossAxisPositionEndAttr() { return 'bottom'; }

    bboxDimensions(el = this.el) {
        let bbox = this.el.wrapper.getBoundingClientRect();
        return {
            mainAxisBegin: this.params.rtl ? bbox.left : bbox.right,
            mainAxisEnd: this.params.rtl ? bbox.right : bbox.left,
            crossAxisBegin: bbox.top,
            crossAxisEnd: bbox.bottom
        };
    }

    canvasTransform(ctx) {
        super.canvasTransform(ctx);
    }
}

export class VerticalOrientation {
    /**
     * Constants
     */
    static get mainAxisSizeAttr() { return 'height'; }
    static get crossAxisSizeAttr() { return 'width'; }

    static get mainAxisOverflowAttr() { return 'overflowY'; }
    static get crossAxisOverflowAttr() { return 'overflowX'; }

    static get mainAxisClientSizeAttr() { return 'clientHeight'; }
    static get crossAxisClientSizeAttr() { return 'clientWidth'; }

    static get mainAxisClientLocationAttr() { return 'clientY'; }
    static get crossAxisClientLocationAttr() { return 'clientX'; }

    static get scrollSizeAttr() { return 'scrollHeight'; }
    static get scrollAmountAttr() { return 'scrollTop'; }

    static get mainAxisOffsetLocationAttr() { return 'offsetTop'; }
    static get crossAxisOffsetSizeAttr() { return 'offsetWidth'; }

    static get mainAxisPositionStartAttr() { return 'top'; }
    static get mainAxisPositionEndAttr() { return 'bottom'; }
    static get crossAxisPositionStartAttr() { return 'left'; }
    static get crossAxisPositionEndAttr() { return 'right'; }

    bboxDimensions(el = this.el) {
        let bbox = this.el.wrapper.getBoundingClientRect();
        return {
            mainAxisBegin: this.params.rtl ? bbox.bottom : bbox.top,
            mainAxisEnd: this.params.rtl ? bbox.top : bbox.bottom,
            crossAxisBegin: bbox.left,
            crossAxisEnd: bbox.right
        };
    }

    canvasTransform(ctx) {
        super.canvasTransform(ctx);
        ctx.rotate(-Math.PI / 4);
    }

    toAbsolute(point) {
        return {
            x: point.crossAxis,
            y: point.mainAxis
        };
    }
}
