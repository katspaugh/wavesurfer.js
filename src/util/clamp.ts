/**
 * Returns a number limited to the given range.
 *
 * @param val The number to be limited to a range
 * @param min The lower boundary of the limit range
 * @param max The upper boundary of the limit range
 * @returns A number in the range [min, max]
 */
export default function clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(min, val), max);
}
