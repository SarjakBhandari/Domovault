const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Backend is never exposed directly to the browser - only the Next.js proxy calls it,
// so the allow-list contains only that single trusted origin.
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Helmet sets 14 security headers. CSP is configured explicitly here rather
// than using helmet's default so the directives are visible and auditable.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        connectSrc: ["'none'"],
        fontSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
        // The backend API never serves HTML - these directives are as tight
        // as possible. The Next.js frontend has its own CSP via next.config.
      },
      reportOnly: false,
    },
    // X-Content-Type-Options: nosniff prevents browsers from MIME-sniffing
    // responses; important when serving uploaded files.
    noSniff: true,
    // X-Frame-Options: DENY - API responses should never be framed.
    frameguard: { action: 'deny' },
    // Strict-Transport-Security - enforced in production.
    hsts: env.NODE_ENV === 'production' ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    // Referrer-Policy: no-referrer so internal paths are never leaked in the
    // Referer header of outbound requests from API responses.
    referrerPolicy: { policy: 'no-referrer' },
    // X-XSS-Protection: '0' - disabling the legacy XSS auditor is the
    // current recommendation since it introduced its own bypass vectors.
    xssFilter: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// express-mongo-sanitize strips keys that start with '$' or contain '.' from
// req.body, req.query, and req.params, preventing NoSQL injection via MongoDB
// query operators. Combined with Zod .strict() schemas (which reject any key
// not in the schema), there is no path for raw user input to become a query
// operator.
app.use(mongoSanitize());

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
