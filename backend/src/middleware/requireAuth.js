const { verifyAccessToken } = require('../utils/jwt');

// Access token travels in the Authorization header, never a cookie - that
// keeps it out of CSRF's reach entirely (the browser never attaches it
// automatically). Every request re-verifies signature and algorithm; nothing
// upstream of this middleware is ever trusted as pre-authenticated.
function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

module.exports = requireAuth;
