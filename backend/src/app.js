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

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize());

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
