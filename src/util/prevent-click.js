/**
 * Stops propagation of click event and removes event listener
 *
 * @private
 * @param {object} event The click event
 */
function preventClickHandler(event, doc, handler) {
    event.stopPropagation();
    doc.body.removeEventListener('click', handler, true);
}

// ** CUSTOMIZATION **
const wrappedPreventClickHandler = function( doc ) {
    const handler = function(event) {
        preventClickHandler(event, doc, handler);
    };
    return handler;
};

/**
 * Starts listening for click event and prevent propagation
 *
 * @param {object} values Values
 */
export default function preventClick(values, doc) {
    doc.body.addEventListener('click', wrappedPreventClickHandler(doc), true);
}
