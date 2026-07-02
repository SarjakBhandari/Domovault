// RBAC middleware factory. Always applied after requireAuth so req.user is
// guaranteed to be set. Returning 403 (not 401) here: the request is
// authenticated but the role is insufficient.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = requireRole;
