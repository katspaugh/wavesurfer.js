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
 *     cache: 'default'
 * };
 *
 * // override default options
 * options.url = '../media/demo.wav';
 *
 * // make fetch call
 * let request = util.fetchFile(options);
 * request.on('progress', e => {
 *     console.log('progress', e);
 * });
 * request.on('success', (data, e) => {
 *     console.log('success!', data);
 * });
 * request.on('error', e => {
 *     console.warn('fetchFile error: ' + e.target.statusText);
 * });
 */
export default function fetchFile(options) {
    const instance = new Observer();
    if (self.fetch) {
        const fetchRequest = new Request(options.url);
        let fetchHeaders = new Headers();

        // check if headers and credentials are added
        if (options) {
            if (options.requestHeaders) {
                // add custom request headers
                options.requestHeaders.forEach(header => {
                    fetchHeaders.append(header.key, header.value);
                });
            }
        }

        // set default fetch options
        const fetchOptions = {
            method: options.method || 'GET',
            headers: fetchHeaders,
            mode: options.mode || 'cors',
            credentials: options.credentials || 'same-origin',
            cache: options.cache || 'default'
        };

        // do the fetch
        fetch(fetchRequest, fetchOptions)
            .then(response => {
                if (response.ok) {
                    return response.blob();
                } else {
                    instance.fireEvent('HTTP error status ', response.status);
                }
            })
            .then(blobResponse => {
                var objectURL = URL.createObjectURL(blobResponse);
                instance.fireEvent('load', objectURL);
                instance.fireEvent('success', fetchRequest.response, objectURL);
            })
            .catch(error => {
                instance.fireEvent('error', error.message);
            });

        // return the fetch
        instance.fetchRequest = fetchRequest;
    } else {
        instance.fireEvent('error', 'fetch api not supported');
    }
    return instance;
}
