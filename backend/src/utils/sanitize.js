const sanitizeHtml = require('sanitize-html');

// Allow-list of tags and attributes that are safe to render in HTML.
// Everything not on this list is stripped (not escaped) before storage,
// so even if a renderer outputs the field verbatim the worst outcome
// is missing formatting, not script execution.
const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'];
const ALLOWED_ATTRIBUTES = {
  a: ['href', 'title'],
};
// Only http/https/mailto in hrefs - prevents javascript: XSS via anchor tags.
const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

function sanitize(input) {
  if (typeof input !== 'string') {
    return input;
  }
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
  });
}

// Plain-text fields (maintenance notes, message content in API responses that
// are never rendered as HTML) can be sanitized more aggressively by stripping
// all tags entirely.
function sanitizePlainText(input) {
  if (typeof input !== 'string') {
    return input;
  }
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
}

module.exports = { sanitize, sanitizePlainText };
