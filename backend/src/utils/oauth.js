const crypto = require('crypto');
const env = require('../config/env');

// Build Google OAuth 2.0 authorization URL (Authorization Code + PKCE flow)
function buildGoogleAuthUrl(state, codeChallenge) {
  const params = new URLSearchParams({
    client_id:             env.GOOGLE_CLIENT_ID,
    redirect_uri:          `${env.APP_URL}/api/auth/oauth/google/callback`,
    response_type:         'code',
    scope:                 'openid email profile',
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',      // SHA-256 hash of the verifier
    access_type:           'offline',
    prompt:                'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Exchange Google authorization code for user info.
// Server-to-server exchange  -  client_secret never leaves the backend.
async function fetchGoogleUser(code, codeVerifier) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  `${env.APP_URL}/api/auth/oauth/google/callback`,
      grant_type:    'authorization_code',
      code,
      code_verifier: codeVerifier, // PKCE verifier proves possession of the code request
    }),
    redirect: 'error',
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${body}`);
  }

  const { access_token } = await tokenRes.json();

  // Use userinfo endpoint  -  no need to validate the ID token JWT ourselves
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
    redirect: 'error',
  });

  if (!userRes.ok) throw new Error('Failed to fetch Google user info');

  const info = await userRes.json();
  return {
    id:            String(info.sub),
    email:         typeof info.email === 'string' ? info.email.toLowerCase() : null,
    name:          info.name || null,
    emailVerified: info.email_verified === true,
  };
}

// --- State token ---
// The OAuth state parameter serves as a CSRF nonce. A random nonce is
// HMAC-SHA256 signed with OAUTH_STATE_SECRET so an attacker who intercepts
// a state value cannot forge a different one.

function getStateSecret() {
  if (!env.OAUTH_STATE_SECRET) throw new Error('OAUTH_STATE_SECRET is not configured');
  return env.OAUTH_STATE_SECRET;
}

function generateOAuthState() {
  const nonce = crypto.randomBytes(20).toString('hex');
  const sig   = crypto
    .createHmac('sha256', getStateSecret())
    .update(nonce)
    .digest('hex');
  return `${nonce}.${sig}`;
}

// Returns true only if state is structurally valid and signature matches.
function verifyOAuthState(state) {
  if (typeof state !== 'string') return false;
  const dot = state.lastIndexOf('.');
  if (dot === -1) return false;
  const nonce = state.slice(0, dot);
  const sig   = state.slice(dot + 1);
  if (!nonce || !sig) return false;

  const expected = crypto
    .createHmac('sha256', getStateSecret())
    .update(nonce)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig,      'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

// --- PKCE helpers ---
// PKCE (Proof Key for Code Exchange, RFC 7636) prevents authorization-code
// interception attacks. The verifier is a random secret; the challenge is its
// SHA-256 hash sent to the provider. On token exchange the verifier is sent
// so the provider can confirm the same party initiated the flow.

function generatePkce() {
  const verifier  = crypto.randomBytes(32).toString('base64url'); // 43-char URL-safe base64
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

module.exports = {
  buildGoogleAuthUrl,
  fetchGoogleUser,
  generateOAuthState,
  verifyOAuthState,
  generatePkce,
};
