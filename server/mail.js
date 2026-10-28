const nodemailer = require('nodemailer');
const t = process.env.SMTP_HOST && nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT || 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
module.exports = async (to, subject, text) => {
  if (!t) return console.log(`[email → ${to}] ${subject}\n${text}`);
  try { await t.sendMail({ from: process.env.MAIL_FROM, to, subject, text }); } catch (e) { console.error('Mail failed:', e.message); }
};