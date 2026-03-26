const OTP          = require('../models/OTP');
const Registration = require('../models/Registration');
const Event        = require('../models/Event');
const transporter  = require('../config/mailer');

const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAIN || 'cuchd.in').split(',').map(d => d.trim());

/**
 * Sends a confirmation email to the registrant after successful registration.
 */
const sendConfirmationEmail = async ({ name, email, cluster, department, categories, event }) => {
  const eventDate = new Date(event.date).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const eventTime = event.time || new Date(event.date).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const categoryNames = {
    research:       '🔬 Research Award',
    innovation:     '💡 New Innovators',
    entrepreneurship: '🚀 Entrepreneurship',
    competitions:   '🏆 Competitions & Hackathons',
    patents:        '📜 Patents',
    certifications: '🎓 Certifications / Leadership',
  };

  const catListHtml = categories.map(c =>
    `<li style="margin-bottom:4px;">${categoryNames[c.type] || c.type}</li>`
  ).join('');

  await transporter.sendMail({
    from: `"ABHYUTTHANAM: Achievers Awards" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: `✅ Application Received — ${event.title}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
      <body style="margin:0;padding:0;background:#f8f9fa;font-family:'Google Sans',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 16px;">
          <tr><td align="center">
            <table width="100%" cellpadding="0" cellspacing="0"
              style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(60,64,67,.12);">

              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#1a73e8 0%,#0d47a1 100%);padding:36px 32px;text-align:center;">
                  <div style="display:inline-block;background:white;border-radius:12px;padding:8px 16px;margin-bottom:16px;">
                    <span style="font-size:24px;font-weight:700;letter-spacing:-1px;">
                      <span style="color:#ea4335">C</span><span style="color:#fbbc04">u</span><span style="color:#34a853">S</span><span style="color:#ea4335">O</span><span style="color:#fbbc04">C</span>
                    </span>
                  </div>
                  <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;line-height:1.3;">Application Received! 🎉</h1>
                  <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">ABHYUTTHANAM: Achievers Awards</p>
                </td>
              </tr>

              <!-- Green tick -->
              <tr>
                <td style="background:#e6f4ea;padding:20px 32px;text-align:center;border-bottom:1px solid #ceead6;">
                  <span style="font-size:40px;">✅</span>
                  <p style="margin:8px 0 0;color:#137333;font-size:15px;font-weight:600;">
                    Hi ${name}, your application has been submitted!
                  </p>
                </td>
              </tr>

              <!-- Details -->
              <tr>
                <td style="padding:28px 32px;">
                  <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#202124;">${event.title}</h2>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                    <tr>
                      <td width="40" valign="top"><div style="width:36px;height:36px;background:#e8f0fe;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">📅</div></td>
                      <td style="padding-left:12px;vertical-align:middle;">
                        <div style="font-size:11px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">Date</div>
                        <div style="font-size:15px;font-weight:500;color:#202124;">${eventDate}</div>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                    <tr>
                      <td width="40" valign="top"><div style="width:36px;height:36px;background:#e6f4ea;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">📍</div></td>
                      <td style="padding-left:12px;vertical-align:middle;">
                        <div style="font-size:11px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">Venue</div>
                        <div style="font-size:15px;font-weight:500;color:#202124;">${event.venue}</div>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                    <tr>
                      <td width="40" valign="top"><div style="width:36px;height:36px;background:#fce8e6;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">🎓</div></td>
                      <td style="padding-left:12px;vertical-align:middle;">
                        <div style="font-size:11px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">Cluster / Department</div>
                        <div style="font-size:15px;font-weight:500;color:#202124;">${department} (${cluster})</div>
                      </td>
                    </tr>
                  </table>

                  <!-- Categories applied -->
                  <div style="background:#e8f0fe;border-radius:12px;padding:16px 20px;margin-top:8px;">
                    <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#1a73e8;">📋 Categories Applied For (${categories.length})</p>
                    <ul style="margin:0;padding-left:18px;color:#3c4043;font-size:14px;line-height:1.8;">
                      ${catListHtml}
                    </ul>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr><td style="height:4px;background:linear-gradient(90deg,#ea4335 25%,#fbbc04 25% 50%,#34a853 50% 75%,#1a73e8 75%);"></td></tr>
              <tr>
                <td style="padding:16px 32px;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#9aa0a6;">
                    © ${new Date().getFullYear()} ABHYUTTHANAM: Achievers Awards, Chandigarh University
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });
};

/**
 * POST /register
 * OTP verified → duplicate check → seat check → insert → send email
 */
const register = async (req, res) => {
  try {
    const { name, email, uid, cluster, department, categories, otp } = req.body;

    // Basic field validation
    if (!name || !email || !uid || !cluster || !department || !otp) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'Please select at least one award category' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email domain
    const emailDomain = normalizedEmail.split('@')[1];
    if (!emailDomain || !ALLOWED_DOMAINS.includes(emailDomain)) {
      return res.status(400).json({
        error: `Only university emails (@${ALLOWED_DOMAINS.join(' or @')}) are allowed`,
      });
    }

    // ── 1. Verify OTP ─────────────────────────────────────────────────────────
    const otpRecord = await OTP.findOne({ email: normalizedEmail, otp: otp.trim() });

    if (!otpRecord) {
      return res.status(400).json({ error: 'OTP not verified. Please verify your OTP first.' });
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // ── 2. Check duplicate ────────────────────────────────────────────────────
    const existingReg = await Registration.findOne({ email: normalizedEmail }).lean();
    if (existingReg) {
      return res.status(409).json({ error: 'You are already registered for this event' });
    }

    // ── 3. Check seats ────────────────────────────────────────────────────────
    const event = await Event.findOne();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.bookedSeats >= event.totalSeats) {
      return res.status(409).json({ error: 'Event is full. No seats available.' });
    }

    // ── 4. Insert registration ────────────────────────────────────────────────
    await Registration.create({
      name:       name.trim(),
      email:      normalizedEmail,
      uid:        uid.trim(),
      cluster:    cluster.trim(),
      department: department.trim(),
      categories,
    });

    // ── 5. Increment booked seats ─────────────────────────────────────────────
    await Event.findByIdAndUpdate(event._id, { $inc: { bookedSeats: 1 } });

    // ── 6. Clean up OTP ───────────────────────────────────────────────────────
    await OTP.deleteMany({ email: normalizedEmail });

    // ── 7. Send confirmation email (non-blocking) ─────────────────────────────
    sendConfirmationEmail({
      name: name.trim(),
      email: normalizedEmail,
      cluster: cluster.trim(),
      department: department.trim(),
      categories,
      event,
    }).catch(err => console.error('Confirmation email failed:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully! 🎉',
    });
  } catch (err) {
    // Duplicate key error from MongoDB
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You are already registered for this event' });
    }
    console.error('register error:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

module.exports = { register };
