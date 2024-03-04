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