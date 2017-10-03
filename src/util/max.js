/**
 * Get the largest value
 *
 * @param   {Array} values Array of numbers
 * @returns {Number} Largest number found
 */
export default function max(values) {
    let largest = -Infinity;
    Object.keys(values).forEach(i => {
        if (values[i] > largest) {
            largest = values[i];
        }
    });
    return largest;
}
