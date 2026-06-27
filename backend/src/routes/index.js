const express = require('express');
const healthRoutes = require('./health.routes');

const router = express.Router();

router.use('/health', healthRoutes);

// Mounted in feature/auth-jwt: router.use('/auth', authRoutes);

module.exports = router;
