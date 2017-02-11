import Observer from './observer';

/**
 * Perform an ajax request
 *
 * @param {Options} options Description
 *
 * @returns {Object} Observer instance
 */
export default function ajax (options) {
    const instance = new Observer();
    const xhr = new XMLHttpRequest();
    let fired100 = false;
    xhr.open(options.method || 'GET', options.url, true);
    xhr.responseType = options.responseType || 'json';
    xhr.addEventListener('progress', e => {
        instance.fireEvent('progress', e);
        if (e.lengthComputable && e.loaded == e.total) {
            fired100 = true;
        }
    });
    xhr.addEventListener('load', e => {
        if (!fired100) {
            instance.fireEvent('progress', e);
        }
        instance.fireEvent('load', e);
        if (200 == xhr.status || 206 == xhr.status) {
            instance.fireEvent('success', xhr.response, e);
        } else {
            instance.fireEvent('error', e);
        }
    });
    xhr.addEventListener('error', e => instance.fireEvent('error', e));
    xhr.send();
    instance.xhr = xhr;
    return instance;
}
