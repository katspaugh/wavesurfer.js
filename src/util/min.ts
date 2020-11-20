/**
 * Get the smallest number in an array of numbers
 *
 * @param values Array of numbers
 * @returns Smallest number found
 * @example console.log(min([1, 2, 3])); // logs 1
 */
export default function min(values: number[]): number {
    let smallest = Infinity;

    for (const value of values) {
        if (value < smallest) {
            smallest = value;
        }
    }

    return smallest;
}
