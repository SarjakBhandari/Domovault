const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

async function sendOtpEmail(toEmail, otp) {
  await getTransporter().sendMail({
    from: `"Domovault" <${env.SMTP_FROM}>`,
    to: toEmail,
    subject: 'Your Domovault verification code',
    text: `Your verification code is: ${otp}\n\nEnter this code on the verification page to activate your account. It expires in 10 minutes.\n\nIf you did not create an account, ignore this email.`,
    html: `
      <p>Welcome to <strong>Domovault</strong>.</p>
      <p>Enter the code below to verify your email address:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f766e;margin:16px 0;">${otp}</p>
      <p style="color:#94a3b8;font-size:12px;">This code expires in 10 minutes. If you did not create an account, you can safely ignore this email.</p>
    `,
  });
}

async function sendPasswordResetEmail(toEmail, rawToken) {
  const link = `${env.APP_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(toEmail)}`;
  await getTransporter().sendMail({
    from: `"Domovault" <${env.SMTP_FROM}>`,
    to: toEmail,
    subject: 'Reset your Domovault password',
    text: `Click the link below to reset your password:\n\n${link}\n\nThis link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.`,
    html: `
      <p>You requested a password reset for your <strong>Domovault</strong> account.</p>
      <p>Click the link below to set a new password:</p>
      <p><a href="${link}" style="color:#0f766e;font-weight:600;">Reset my password</a></p>
      <p style="color:#94a3b8;font-size:12px;">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
    `,
  });
}

module.exports = { sendOtpEmail, sendPasswordResetEmail };
