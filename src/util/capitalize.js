/**
 * Capitalize a string's first character
 *
 * @param   {String} str String to capitalize
 * @returns {String} str but with the first letter uppercased
 * @example console.log(capitalize("hello")); // logs "Hello"
 */
export default function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
