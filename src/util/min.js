/**
 * Get the smallest value
 *
 * @param   {Array} values Array of numbers
 * @returns {Number}       Smallest number found
 */
export default function min(values) {
    let smallest = Number(Infinity);
    Object.keys(values).forEach(i => {
        if (values[i] < smallest) {
            smallest = values[i];
        }
    });
    return smallest;
}
