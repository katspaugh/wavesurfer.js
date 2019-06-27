/**
 * @since 3.0.0
 */

import Observer from './observer';

/**
 * Load a file using `fetch`.
 *
 * @param {Options} options Request options to use. See example below.
 * @returns {Observer} Observer instance
 * @example
 * // default options
 * let options = {
 *     method: 'GET',
 *     mode: 'cors',
 *     credentials: 'same-origin',
 *     url: undefined,
 *     cache: 'default',
 *     responseType: 'json',
 *     requestHeaders: []
 * };
 *
 * // override default options
 * options.responseType = 'arraybuffer';
 * options.url = '../media/demo.wav';
 *
 * // make fetch call
 * let request = util.fetchFile(options);
 * request.on('progress', e => {
 *     console.log('progress', e);
 * });
 * request.on('success', data => {
 *     console.log('success!', data);
 * });
 * request.on('error', e => {
 *     console.warn('fetchFile error: ', e);
 * });
 */
export default function fetchFile(options) {
    const instance = new Observer();
    const fetchRequest = new Request(options.url);
    let fetchHeaders = new Headers();

    // check if headers are added
    if (options && options.requestHeaders) {
        // add custom request headers
        options.requestHeaders.forEach(header => {
            fetchHeaders.append(header.key, header.value);
        });
    }

    // set default fetch options
    const fetchOptions = {
        method: options.method || 'GET',
        headers: fetchHeaders,
        mode: options.mode || 'cors',
        credentials: options.credentials || 'same-origin',
        cache: options.cache || 'default',
        responseType: 'json'
    };
    const responseType = options.responseType || 'json';

    // do the fetch
    fetch(fetchRequest, fetchOptions)
        .then(response => {
            instance.response = response;

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
                        instance.fireEvent(
                            'error',
                            'Unknown responseType: ' + responseType
                        );
                        break;
                }
            } else {
                instance.fireEvent(
                    'error',
                    'HTTP error status: ' + response.status
                );
            }
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
