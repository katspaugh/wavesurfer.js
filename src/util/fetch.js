import Observer from './observer';

/**
 * Perform an fetch request
 *
 * @param {Options} options Description
 * dofetch({
 *   url: "https://www.waveform.al/sample.json"
 * })
 *
 * @returns {Object} Observer instance
 */
export default function dofetch(options) {
    if (self.fetch) {
        const instance = new Observer();
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
            method: (options.method || "GET"),
            headers: fetchHeaders,
            mode: (options.mode || "cors"),
            credentials: (options.credentials || "same-origin"),
            cache: (options.cache || "default")
        };

        // do the fetch
        fetch(fetchRequest,fetchOptions).then(function(response) {
          if (response.ok) {
            return response.blob();
          } else{
            instance.fireEvent('HTTP error status ', response.status)
          }
        }).then(function(blobResponse) {        
            var objectURL = URL.createObjectURL(blobResponse);
            instance.fireEvent('load', objectURL);
            instance.fireEvent('success', fetchRequest.response, objectURL);
        }).catch(function(error) {
            instance.fireEvent('error', error.message)
        });

        // return the fetch
        instance.fetchRequest = fetchRequest;
        return instance;
    } else{
        instance.fireEvent('error', 'fetch api not supported');
    }
}
