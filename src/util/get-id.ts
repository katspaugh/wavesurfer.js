/**
 * Get a random prefixed ID
 *
 * @param prefix Prefix to use. Default is `'wavesurfer_'`.
 * @returns Random prefixed ID
 * @example
 * console.log(getId()); // logs 'wavesurfer_b5pors4ru6g'
 *
 * let prefix = 'foo-';
 * console.log(getId(prefix)); // logs 'foo-b5pors4ru6g'
 */
export default function getId(prefix: string = 'wavesurfer_'): string {
    return (
        prefix +
        Math.random()
            .toString(32)
            .substring(2)
    );
}
