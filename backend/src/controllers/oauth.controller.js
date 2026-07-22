const User = require('../models/User');
const { signAccessToken } = require('../utils/jwt');
const { writeAuditLog, ACTIONS } = require('../utils/audit');
const {
  buildGoogleAuthUrl,
  fetchGoogleUser,
  generateOAuthState,
  verifyOAuthState,
  generatePkce,
} = require('../utils/oauth');
const env = require('../config/env');

// Cookies that carry the state nonce and PKCE verifier during the OAuth round-trip.
// sameSite:'lax' is required: 'strict' would prevent the browser from sending
// the cookie when following the top-level redirect back from the provider.
const STATE_COOKIE = 'oauth_state';
const PKCE_COOKIE  = 'oauth_pkce_verifier';

const FLOW_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure:   env.NODE_ENV === 'production',
  maxAge:   10 * 60 * 1000, // 10 minutes - enough to complete the provider flow
  path:     '/api/auth/oauth',
};

// --- Initiate ---

function initiateGoogle(req, res) {
  if (!env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ error: 'Google OAuth is not configured on this server.' });
  }

  const state                    = generateOAuthState();
  const { verifier, challenge }  = generatePkce();

  // State nonce prevents CSRF; PKCE verifier proves code ownership on callback
  res.cookie(STATE_COOKIE, state,    FLOW_COOKIE_OPTS);
  res.cookie(PKCE_COOKIE,  verifier, FLOW_COOKIE_OPTS);

  return res.redirect(buildGoogleAuthUrl(state, challenge));
}

// --- Callback ---

async function callbackGoogle(req, res, next) {
  try {
    const { code, state: returnedState, error: providerError } = req.query;

    if (providerError) {
      return res.redirect(`${env.APP_URL}/login?error=oauth_denied`);
    }

    const storedState = req.cookies[STATE_COOKIE];
    const verifier    = req.cookies[PKCE_COOKIE];

    // Always clear flow cookies regardless of outcome
    res.clearCookie(STATE_COOKIE, { path: '/api/auth/oauth' });
    res.clearCookie(PKCE_COOKIE,  { path: '/api/auth/oauth' });

    // Verify: cookie must exist, signature must be valid, value must match
    if (
      !storedState ||
      !verifyOAuthState(storedState) ||
      returnedState !== storedState
    ) {
      return res.redirect(`${env.APP_URL}/login?error=oauth_state_mismatch`);
    }

    if (!code || !verifier) {
      return res.redirect(`${env.APP_URL}/login?error=oauth_missing_params`);
    }

    const userInfo = await fetchGoogleUser(code, verifier);

    if (!userInfo.email) {
      return res.redirect(`${env.APP_URL}/login?error=oauth_no_email`);
    }

    const { accessToken, refreshToken } = await findOrCreateUser(userInfo, 'google');

    return redirectWithTokens(res, accessToken, refreshToken);
  } catch (err) {
    next(err);
  }
}

// --- Shared helpers ---

// Three-step lookup: by encrypted hash, then by email (link), then create new.
// oauthId is never compared or stored in plaintext  -  only the HMAC hash is used
// for the database query; the raw ID is stored encrypted via user.setOauthId().
async function findOrCreateUser(info, provider) {
  // 1. Find by HMAC hash of provider:rawId  -  the indexed, non-plaintext lookup
  let user = await User.findByOauthId(provider, info.id);

  // 2. Email match  -  link OAuth to an existing local account
  if (!user) {
    user = await User.findOne({ email: info.email });

    if (user) {
      user.setOauthId(provider, info.id); // encrypt and hash the provider ID
      user.isVerified = true;
      await user.save();
    }
  }

  // 3. Create a brand-new account
  if (!user) {
    user = new User({
      email:     info.email,
      fullName:  info.name || info.email.split('@')[0],
      role:      'applicant',
      isVerified: true, // email already verified by Google
    });
    user.setOauthId(provider, info.id);
    await user.save();
  }

  // Issue Domovault tokens  -  identical to the local login flow
  const accessToken  = signAccessToken({ sub: user._id.toString(), role: user.role });
  const refreshToken = require('crypto').randomBytes(40).toString('hex');
  user.setRefreshToken(refreshToken);
  await user.save();

  await writeAuditLog({
    actorId:    user._id,
    action:     ACTIONS.OAUTH_LOGIN,
    targetType: 'User',
    targetId:   user._id,
    metadata:   { provider },
  });

  return { accessToken, refreshToken };
}

// Set refresh token as httpOnly strict cookie; put access token in redirect URL.
// The frontend callback page immediately moves it to sessionStorage and removes
// it from the URL with history.replaceState so it never persists in history.
function redirectWithTokens(res, accessToken, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure:   env.NODE_ENV === 'production',
    path:     '/api/auth',
    maxAge:   15 * 24 * 3600 * 1000,
  });

  const dest = new URL(`${env.APP_URL}/oauth/callback`);
  dest.searchParams.set('token', accessToken);

  return res.redirect(dest.toString());
}

module.exports = { initiateGoogle, callbackGoogle };
