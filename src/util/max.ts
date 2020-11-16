/**
 * Get the largest value
 *
 * @param values Array of numbers
 * @returns Largest number found
 * @example console.log(max([1, 2, 3])); // logs 3
 */
export default function max(values: number[]) {
    let largest = -Infinity;

    for (const value of values) {
        if (value > largest) {
            largest = value;
        }
    }

    return largest;
}
