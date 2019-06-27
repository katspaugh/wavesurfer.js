/**
 * @since 3.0.0
 */

import Observer from './observer';

/**
 * Load a file using `fetch`.
 *
 * @param {object} options Request options to use. See example below.
 * @returns {Observer} Observer instance
 * @example
 * // default options
 * let options = {
 *     url: undefined,
 *     method: 'GET',
 *     mode: 'cors',
 *     credentials: 'same-origin',
 *     cache: 'default',
 *     responseType: 'json',
 *     requestHeaders: [],
 *     redirect: 'follow',
 *     referrer: 'client'
 * };
 *
 * // override some options
 * options.url = '../media/demo.wav';
 * options.responseType = 'arraybuffer';
 *
 * // make fetch call
 * let request = util.fetchFile(options);
 *
 * // listen for events
 * request.on('progress', e => {
 *     console.log('progress', e);
 * });
 *
 * request.on('success', data => {
 *     console.log('success!', data);
 * });
 *
 * request.on('error', e => {
 *     console.warn('fetchFile error: ', e);
 * });
 */
export default function fetchFile(options) {
    if (!options) {
        throw new Error('fetch options missing');
    }
    if (!options.url) {
        throw new Error('fetch url missing');
    }
    const instance = new Observer();
    let fetchHeaders = new Headers();
    let fetchRequest = new Request(options.url);

    // add ability to abort
    instance.controller = new AbortController();

    // check if headers have to be added
    if (options && options.requestHeaders) {
        // add custom request headers
        options.requestHeaders.forEach(header => {
            fetchHeaders.append(header.key, header.value);
        });
    }

    // parse fetch options
    const responseType = options.responseType || 'json';
    const fetchOptions = {
        method: options.method || 'GET',
        headers: fetchHeaders,
        mode: options.mode || 'cors',
        credentials: options.credentials || 'same-origin',
        cache: options.cache || 'default',
        redirect: options.redirect || 'follow',
        referrer: options.referrer || 'client',
        signal: instance.controller.signal
    };

    fetch(fetchRequest, fetchOptions)
        .then(response => {
            instance.response = response;

            let errMsg;
            if (response.ok) {
                switch (responseType) {
                    case 'arraybuffer':
                        return response.arrayBuffer();

                    case 'json':
                        return response.json();

                    case 'blob':
                        return response.blob();

                    case 'text':
                        return response.text();

                    default:
                        errMsg = 'Unknown responseType: ' + responseType;
                        break;
                }
            }

            if (!errMsg) {
                errMsg = 'HTTP error status: ' + response.status;
            }

            throw new Error(errMsg);
        })
        .then(response => {
            instance.fireEvent('load', response);
            instance.fireEvent('success', response);
        })
        .catch(error => {
            instance.fireEvent('error', error);
        });

    // return the fetch request
    instance.fetchRequest = fetchRequest;
    return instance;
}
