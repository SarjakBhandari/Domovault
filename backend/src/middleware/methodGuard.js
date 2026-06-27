// Express dispatches route layers in registration order, so when this is
// chained after the method-specific handler(s) with router.route(path), it
// only ever runs for verbs that weren't already handled - any method not in
// the whitelist gets an explicit 405 instead of falling through to a generic
// 404, which would leak no information about which methods are valid.
function methodNotAllowed(allowedMethods) {
  return (req, res) => {
    res.set('Allow', allowedMethods.join(', '));
    res.status(405).json({ error: `Method ${req.method} not allowed on this route` });
  };
}

module.exports = methodNotAllowed;
