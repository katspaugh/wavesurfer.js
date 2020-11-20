/**
 * @since 3.0.0
 */

import Observer from './observer';

// This code dynamically creates properties on the Observer instance
type FetchObserver = Observer & {
    _reader: ReadableStreamReader;
    onProgress: (e: Partial<ProgressEvent>) => void;
};

class ProgressHandler {
    public instance: FetchObserver;

    public total: number;

    public loaded: number = 0;

    /**
     * Instantiate ProgressHandler
     *
     * @param instance The `fetchFile` observer instance.
     * @param contentLength Content length.
     * @param response Response object.
     */
    constructor(instance: FetchObserver, contentLength: number | string, response: Response) {
        this.instance = instance;

        // TODO: body may be null
        // @ts-ignore
        this.instance._reader = response.body.getReader();

        if (typeof contentLength === 'string') {
            this.total = parseInt(contentLength, 10);
        } else {
            this.total = contentLength;
        }
    }

    /**
     * A method that is called once, immediately after the `ReadableStream``
     * is constructed.
     *
     * @param controller Controller instance used to control the stream.
     */
    start(controller: ReadableStreamDefaultController) {
        const read = () => {
            // instance._reader.read() returns a promise that resolves
            // when a value has been received
            this.instance._reader
                .read()
                .then(({ done, value }) => {
                    // result objects contain two properties:
                    // done  - true if the stream has already given you all its data.
                    // value - some data. Always undefined when done is true.
                    if (done) {
                        // ensure onProgress called when content-length=0
                        if (this.total === 0) {
                            this.instance.onProgress.call(this.instance, {
                                loaded: this.loaded,
                                total: this.total,
                                lengthComputable: false
                            });
                        }
                        // no more data needs to be consumed, close the stream
                        controller.close();
                        return;
                    }

                    this.loaded += value.byteLength;
                    this.instance.onProgress.call(this.instance, {
                        loaded: this.loaded,
                        total: this.total,
                        lengthComputable: !(this.total === 0)
                    });
                    // enqueue the next data chunk into our target stream
                    controller.enqueue(value);
                    read();
                })
                .catch(error => {
                    controller.error(error);
                });
        };

        read();
    }
}

type FetchOptions = RequestInit & {
    url: Request | string,
    requestHeaders: any,
    responseType?: string,
};

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

 * // available types: 'arraybuffer', 'blob', 'json' or 'text'
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
export default function fetchFile(options?: Partial<FetchOptions>): Observer {
    if (!options) {
        throw new Error('fetch options missing');
    } else if (!options.url) {
        throw new Error('fetch url missing');
    }

    const instance: any = new Observer();
    const fetchHeaders = new Headers();
    const fetchRequest = new Request(options.url);

    // add ability to abort
    instance.controller = new AbortController();

    // check if headers have to be added
    if (options && options.requestHeaders) {
        // add custom request headers
        options.requestHeaders.forEach((header: any) => {
            fetchHeaders.append(header.key, header.value);
        });
    }

    // parse fetch options
    const responseType = options.responseType || 'json';
    const fetchOptions: RequestInit = {
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
            // store response reference
            instance.response = response;

            let progressAvailable = true;
            if (!response.body) {
                // ReadableStream is not yet supported in this browser
                // see https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
                progressAvailable = false;
            }

            // Server must send CORS header "Access-Control-Expose-Headers: content-length"
            const contentLength = response.headers.get('content-length');
            if (contentLength === null) {
                // Content-Length server response header missing.
                // Don't evaluate download progress if we can't compare against a total size
                // see https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#Access-Control-Expose-Headers
                progressAvailable = false;
            }

            if (!progressAvailable) {
                // not able to check download progress so skip it
                return response;
            }

            // fire progress event when during load
            instance.onProgress = (e: ProgressEvent) => {
                instance.fireEvent('progress', e);
            };

            return new Response(
                new ReadableStream(
                    new ProgressHandler(instance, contentLength!, response)
                ),
                fetchOptions
            );
        })
        .then(response => {
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
            instance.fireEvent('success', response);
        })
        .catch(error => {
            instance.fireEvent('error', error);
        });

    // return the fetch request
    instance.fetchRequest = fetchRequest;
    return instance;
}
