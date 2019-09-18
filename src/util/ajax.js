import Observer from './observer';

/**
 * Perform an ajax request using `XMLHttpRequest`.
 *
 * @deprecated Use `util.fetchFile` instead.
 *
 * @param {Object} options AJAX options to use. See example below for options.
 * @returns {Observer} Observer instance
 * @example
 * // default options
 * let options = {
 *     method: 'GET',
 *     url: undefined,
 *     responseType: 'json',
 *     xhr: {}
 * };
 *
 * // override default options
 * options.url = '../media/demo.wav';
 * options.responseType = 'arraybuffer';
 * options.xhr = {
 *     requestHeaders: [
 *         {
 *             key: 'Authorization',
 *             value: 'my-token'
 *         }
 *     ],
 *     withCredentials: true
 * };
 *
 * // make ajax call
 * let ajaxCall = util.ajax(options);
 * ajaxCall.on('progress', e => {
 *     console.log('progress', e);
 * });
 * ajaxCall.on('success', (data, e) => {
 *     console.log('success!', data);
 * });
 * ajaxCall.on('error', e => {
 *     console.warn('ajax error: ' + e.target.statusText);
 * });
 */
export default function ajax(options) {
    const instance = new Observer();
    const xhr = new XMLHttpRequest();
    let fired100 = false;
    xhr.open(options.method || 'GET', options.url, true);
    xhr.responseType = options.responseType || 'json';

    if (options.xhr) {
        if (options.xhr.requestHeaders) {
            // add custom request headers
            options.xhr.requestHeaders.forEach(header => {
                xhr.setRequestHeader(header.key, header.value);
            });
        }
        if (options.xhr.withCredentials) {
            // use credentials
            xhr.withCredentials = true;
        }
    }

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
