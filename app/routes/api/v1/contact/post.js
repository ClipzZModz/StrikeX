const express = require('express');
const router = express.Router();
require('dotenv').config();
const axios = require('axios');
const middleware = require("../../../../middleware/middleware");

// MySQL
var SQL = require('../../../../storage/database');
const db = new SQL();

router.post('/', middleware.verifySession, async function (req, res) {
  const { name, email, subject, message, recaptchaToken } = req.body;

  if (!name || !email || !subject || !message || !recaptchaToken) {
    return res.status(400).json({ error: 'Missing required fields or reCAPTCHA token.' });
  }

  try {
    // ✅ Verify reCAPTCHA token with Google
    const recaptchaRes = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET, 
        response: recaptchaToken
      })
    );

    if (!recaptchaRes.data.success) {
      return res.status(403).json({ error: 'reCAPTCHA validation failed.' });
    }

    // ✅ Format message for Discord webhook
    const payload = {
      embeds: [
        {
          title: '📩 New Contact Form Submission',
          color: 0x2f3136,
          fields: [
            { name: '👤 Name', value: name, inline: false },
            { name: '📧 Email', value: email, inline: false },
            { name: '🎯 Subject', value: subject, inline: false },
            { name: '💬 Message', value: message, inline: false },
            { name: '✅ Accepted Terms', value: 'Yes', inline: false }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    };

    // ✅ Send to Discord webhook
    await axios.post(process.env.DISCORD_WEBHOOK_URL, payload);

    res.json({ success: true, message: 'Form submitted successfully.' });

  } catch (error) {
    console.error('reCAPTCHA or webhook error:', error.message || error);
    res.status(500).json({ error: 'Server error while submitting form.' });
  }
});

module.exports = router;