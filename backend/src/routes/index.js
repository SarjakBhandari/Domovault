const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const mfaRoutes = require('./mfa.routes');
const propertyRoutes = require('./property.routes');
const applicationRoutes = require('./application.routes');
const profileRoutes = require('./profile.routes');
const messagingRoutes = require('./messaging.routes');
const maintenanceRoutes = require('./maintenance.routes');
const billingRoutes = require('./billing.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/mfa', mfaRoutes);
router.use('/properties', propertyRoutes);
router.use('/applications', applicationRoutes);
router.use('/profile', profileRoutes);
router.use('/messaging', messagingRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/billing', billingRoutes);

module.exports = router;
