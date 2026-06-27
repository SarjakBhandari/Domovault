// Validates against req.body only. Auth/state-changing endpoints never read
// req.query for input - this middleware enforces that by construction, since
// there is nowhere else for a Zod schema to be applied here.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: result.error.flatten().fieldErrors,
      });
    }

    req.body = result.data;
    next();
  };
}

module.exports = validateBody;
