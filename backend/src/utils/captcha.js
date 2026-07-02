const env = require('../config/env');

const PROVIDER_ENDPOINTS = {
  hcaptcha: 'https://hcaptcha.com/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
};

// Gated by CAPTCHA_PROVIDER, not by a feature flag scattered through the
// controller - login.js calls this unconditionally once the failed-attempt
// threshold is hit, and this function alone decides what "valid" means for
// the configured provider.
async function verifyCaptcha(token) {
  if (env.CAPTCHA_PROVIDER === 'none') {
    return true;
  }

  if (env.CAPTCHA_PROVIDER === 'test') {
    // Deterministic, offline stand-in for integration tests. env.js refuses
    // this provider whenever NODE_ENV=production, so it can never end up
    // gating a real deployment.
    return token === 'test-pass';
  }

  if (!token) {
    return false;
  }

  const endpoint = PROVIDER_ENDPOINTS[env.CAPTCHA_PROVIDER];
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: env.CAPTCHA_SECRET_KEY, response: token }),
  });

  const data = await response.json();
  return Boolean(data.success);
}

module.exports = { verifyCaptcha };
