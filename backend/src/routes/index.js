const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const mfaRoutes = require('./mfa.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/mfa', mfaRoutes);

module.exports = router;
