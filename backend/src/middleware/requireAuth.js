const { verifyAccessToken } = require('../utils/jwt');

// This middleware runs on every route that requires a logged-in user.
// It reads the access token from the Authorization header and verifies it.
//
// Why the Authorization header and not a cookie?
// If the token were in a cookie, the browser would attach it automatically
// on every request, including cross-site ones - that is exactly the CSRF threat.
// In a header, the token only reaches the server when JavaScript explicitly sets it,
// and cross-origin JavaScript is blocked from reading sessionStorage by the browser.
function requireAuth(req, res, next) {
  // Read the Authorization header. A valid header looks like: "Bearer eyJhbG..."
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' '); // split on the space

  // Enforce the "Bearer" scheme prefix to avoid processing malformed headers
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  try {
    // verifyAccessToken calls jwt.verify() with algorithms:['HS256'].
    // If the token is expired, tampered, signed with the wrong key,
    // or uses an unexpected algorithm, this throws and we return 401.
    // On success, the decoded payload (sub, role, exp, jti) is attached to req.user
    // so downstream middleware and controllers can read who made the request.
    req.user = verifyAccessToken(token);
    next(); // token is valid - let the request continue to the next handler
  } catch {
    // Any JWT error (expired, bad signature, wrong alg, etc.) is treated the same:
    // the caller gets a 401 with no detail about why it failed.
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

module.exports = requireAuth;
