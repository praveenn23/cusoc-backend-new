const OTP    = require('../models/OTP');
const Registration = require('../models/Registration');
const Event  = require('../models/Event');
const transporter = require('../config/mailer');

const ALLOWED_DOMAINS  = (process.env.ALLOWED_EMAIL_DOMAIN || 'cuchd.in').split(',').map(d => d.trim());
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;

/** Generate a 6-digit OTP */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * POST /send-otp
 * Validates university email, checks seat availability, stores OTP in MongoDB, sends email.
 */
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate university domain
    const emailDomain = normalizedEmail.split('@')[1];
    if (!emailDomain || !ALLOWED_DOMAINS.includes(emailDomain)) {
      return res.status(400).json({
        error: `Only university emails (@${ALLOWED_DOMAINS.join(' or @')}) are allowed`,
      });
    }

    // Check if already registered
    const existingReg = await Registration.findOne({ email: normalizedEmail }).lean();
    if (existingReg) {
      return res.status(409).json({ error: 'This email is already registered for the event' });
    }

    // Check seat availability
    const event = await Event.findOne().lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.bookedSeats >= event.totalSeats) {
      return res.status(409).json({ error: 'Event is full. No seats available.' });
    }

    // Generate OTP and expiry
    const otp       = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Delete any previous OTPs for this email, then insert fresh one
    await OTP.deleteMany({ email: normalizedEmail });
    await OTP.create({ email: normalizedEmail, otp, expiresAt });

    // Send OTP email
    await transporter.sendMail({
      from: `"Event Registration" <${process.env.EMAIL_FROM}>`,
      to: normalizedEmail,
      subject: 'Your OTP for Event Registration',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: 'Google Sans', Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
            <div style="background: #1a73e8; padding: 32px 24px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">🎟️ Event Registration</h1>
            </div>
            <div style="padding: 32px 24px;">
              <p style="color: #3c4043; font-size: 16px; margin: 0 0 16px;">Hello!</p>
              <p style="color: #3c4043; font-size: 16px; margin: 0 0 24px;">
                Use the OTP below to verify your email and complete your registration:
              </p>
              <div style="background: #e8f0fe; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #1a73e8;">${otp}</span>
              </div>
              <p style="color: #5f6368; font-size: 14px; margin: 0 0 8px;">
                ⏱️ This OTP is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
              </p>
              <p style="color: #5f6368; font-size: 14px; margin: 0;">
                If you did not request this, please ignore this email.
              </p>
            </div>
            <div style="background: #f8f9fa; padding: 16px 24px; text-align: center;">
              <p style="color: #9aa0a6; font-size: 12px; margin: 0;">
                Secure OTP — Do not share this with anyone
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${normalizedEmail}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
    });
  } catch (err) {
    console.error('sendOTP error:', err.message);
    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
};

/**
 * POST /verify-otp
 * Validates OTP and its expiry.
 */
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const record = await OTP.findOne({ email: normalizedEmail, otp: otp.trim() });

    if (!record) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    // Check expiry (MongoDB TTL may not have cleaned it up yet within the same second)
    if (new Date() > new Date(record.expiresAt)) {
      await OTP.deleteOne({ _id: record._id });
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    return res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    console.error('verifyOTP error:', err.message);
    return res.status(500).json({ error: 'Failed to verify OTP. Please try again.' });
  }
};

module.exports = { sendOTP, verifyOTP };
