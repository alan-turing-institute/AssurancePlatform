/**
 * Sanitize text for use in HTML, and optionally replace newlines with <br/>.
 *
 * @param {string} input_text - The text to sanitize
 * @param {boolean} replaceNewLines - Whether to replace newlines with <br/>
 * @returns {string} The sanitized text
 */
export function sanitizeForHtml(input_text: any, replaceNewLines = false) {
  let result = input_text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");

  if (replaceNewLines) {
    result = result.replace(/\n/g, "<br/>");
  }

  return result;
}

/**
 * Remove an element from an array. Modifies the array in place. If the element
 * is not found, nothing happens.
 *
 * @param {Array} array - The array to remove the element from
 * @param {*} element - The element to remove
 * @returns {void}
 */
export function removeArrayElement(array: any[], element: any) {
  // Remove from `array`, in place, the (first instance of?) `element`.
  array.splice(array.indexOf(element), 1);
}