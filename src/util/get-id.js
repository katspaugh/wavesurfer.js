/**
 * Get a random prefixed ID
 *
 * @returns {String} Random ID
 */
export default function getId () {
    return 'wavesurfer_' + Math.random().toString(32).substring(2);
}
