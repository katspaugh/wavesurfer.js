function preventClickHandler(e) {
    e.stopPropagation();
    document.body.removeEventListener('click', preventClickHandler, true);
}

export default function preventClick(values) {
    document.body.addEventListener('click', preventClickHandler, true);
}
