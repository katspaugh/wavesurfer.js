/**
 * Get a random prefixed ID
 *
 * @returns {String} Random ID
 * @example console.log(getId()); // logs 'wavesurfer_b5pors4ru6g'
 */
export default function getId() {
    return (
        'wavesurfer_' +
        Math.random()
            .toString(32)
            .substring(2)
    );
}
