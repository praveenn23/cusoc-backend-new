const Registration = require('../models/Registration');
const Event        = require('../models/Event');
const transporter  = require('../config/mailer');

// ── GET /admin/stats ────────────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [event, totalCount, attendedCount] = await Promise.all([
      Event.findOne().lean(),
      Registration.countDocuments(),
      Registration.countDocuments({ attendedAt: { $ne: null } }),
    ]);

    return res.json({
      success: true,
      stats: {
        totalSeats:         event?.totalSeats  ?? 0,
        bookedSeats:        event?.bookedSeats ?? 0,
        remainingSeats:     (event?.totalSeats ?? 0) - (event?.bookedSeats ?? 0),
        totalRegistrations: totalCount,
        attendedCount,
      },
    });
  } catch (err) {
    console.error('getStats error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// ── GET /admin/registrations ────────────────────────────────────────────────
const getRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find()
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const mapped = registrations.map(r => ({
      ...r,
      id:             r._id,
      created_at:     r.createdAt,
      ticket_sent_at: r.ticketSentAt,
      attended_at:    r.attendedAt,
      faculty_attended_at: r.facultyAttendedAt,
      faculty_ticket_code: r.facultyTicketCode,
      detailed_categories: (r.categories || []).map(c => {
        const details = c.data ? Object.entries(c.data)
          .filter(([_, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => `${k.replace(/_/g, ' ').toUpperCase()}: ${v}`)
          .join(', ') : '';
        return `${(c.type || '').toUpperCase()}: ${details}${c.award ? ` [AWARD: ${c.award.toUpperCase()}]` : ''}`;
      }).join(' | ')
    }));

    return res.json({ success: true, registrations: mapped });
  } catch (err) {
    console.error('getRegistrations error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch registrations' });
  }
};

// ── DELETE /admin/registrations/:id ─────────────────────────────────────────
const deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Registration ID required' });

    const reg = await Registration.findByIdAndDelete(id);
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    // Decrement booked seats
    await Event.findOneAndUpdate({}, { $inc: { bookedSeats: -1 } });

    return res.json({ success: true, message: 'Registration deleted successfully' });
  } catch (err) {
    console.error('deleteRegistration error:', err.message);
    return res.status(500).json({ error: 'Failed to delete registration' });
  }
};

// ── GET /admin/event ─────────────────────────────────────────────────────────
const getEvent = async (req, res) => {
  try {
    const event = await Event.findOne();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    return res.json({ success: true, event });
  } catch (err) {
    console.error('admin getEvent error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
};

// ── PUT /admin/event ─────────────────────────────────────────────────────────
const updateEvent = async (req, res) => {
  try {
    const {
      title, description, date, time, venue, total_seats,
      about_text, event_sections, speakers, partners,
    } = req.body;

    if (!title || !date || !venue || !total_seats) {
      return res.status(400).json({ error: 'title, date, venue, and total_seats are required' });
    }

    const newTotalSeats = parseInt(total_seats);
    if (isNaN(newTotalSeats) || newTotalSeats < 1) {
      return res.status(400).json({ error: 'total_seats must be a positive number' });
    }

    if (event_sections !== undefined && !Array.isArray(event_sections)) {
      return res.status(400).json({ error: 'event_sections must be an array' });
    }
    if (speakers !== undefined && !Array.isArray(speakers)) {
      return res.status(400).json({ error: 'speakers must be an array' });
    }
    if (partners !== undefined && !Array.isArray(partners)) {
      return res.status(400).json({ error: 'partners must be an array' });
    }

    const existing = await Event.findOne();
    if (!existing) return res.status(404).json({ error: 'Event not found' });

    if (newTotalSeats < existing.bookedSeats) {
      return res.status(400).json({
        error: `Cannot set total seats (${newTotalSeats}) below already booked seats (${existing.bookedSeats})`,
      });
    }

    const updatePayload = {
      title:      title.trim(),
      description: description?.trim() || null,
      date,
      time:       time?.trim() || null,
      venue:      venue.trim(),
      totalSeats: newTotalSeats,
    };

    if (about_text     !== undefined) updatePayload.aboutText     = about_text?.trim() || null;
    if (event_sections !== undefined) updatePayload.eventSections = event_sections;
    if (speakers       !== undefined) updatePayload.speakers      = speakers;
    if (partners       !== undefined) updatePayload.partners      = partners;

    const updated = await Event.findByIdAndUpdate(existing._id, updatePayload, { new: true });
    return res.json({ success: true, event: updated, message: 'Event updated successfully' });
  } catch (err) {
    console.error('updateEvent error:', err.message);
    return res.status(500).json({ error: 'Failed to update event' });
  }
};

// ── POST /admin/login ────────────────────────────────────────────────────────
const adminLogin = async (req, res) => {
  const { password } = req.body;
  const secret = process.env.ADMIN_SECRET_KEY;

  if (!password) return res.status(400).json({ error: 'Password required' });
  if (!secret)   return res.status(500).json({ error: 'Admin not configured on server' });
  if (password !== secret) return res.status(401).json({ error: 'Invalid admin password' });

  return res.json({ success: true, token: secret });
};

// ── POST /admin/send-tickets ─────────────────────────────────────────────────
const sendTickets = async (req, res) => {
  try {
    const registrations = await Registration.find({
      ticketSentAt: null,
      $or: [
        { evaluation_status: 'Approved' },
        { 'categories.status': 'Approved' }
      ]
    })
      .sort({ createdAt: 1 })
      .limit(5000)
      .lean();

    const totalApprovedCount = await Registration.countDocuments({
      $or: [
        { evaluation_status: 'Approved' },
        { 'categories.status': 'Approved' }
      ]
    });
    const alreadySent = totalApprovedCount - registrations.length;

    if (!registrations || registrations.length === 0) {
      return res.json({
        success: true,
        message: `All ${totalApprovedCount} approved participants have already received their ticket emails. No new emails sent.`,
        sent: 0, failed: 0, skipped: alreadySent,
      });
    }

    const event = await Event.findOne().lean();
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const eventDate = new Date(event.date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const eventTime = event.time || new Date(event.date).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });

    const CONCURRENCY = 5;
    const results = { sent: 0, failed: 0, errors: [] };

    for (let i = 0; i < registrations.length; i += CONCURRENCY) {
      const chunk = registrations.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (reg) => {
          const ticketNo   = `EVT-${reg._id.toString().slice(-4).toUpperCase()}`;
          const department = reg.department || 'N/A';

          const approvedCategories = Array.isArray(reg.categories)
            ? reg.categories.filter(c => {
                const effectiveStatus = c.status || reg.evaluation_status || 'Pending';
                return effectiveStatus === 'Approved';
              })
            : [];
          const approvedCategoryNames = approvedCategories.map(c => {
            const catName = (c.type || '').charAt(0).toUpperCase() + (c.type || '').slice(1);
            let specificTitle = '';
            if (c.data) {
              specificTitle = c.data.comp_name ||
                              c.data.research_name ||
                              c.data.patent_title ||
                              c.data.startup_name ||
                              c.data.club_name ||
                              c.data.cert_title ||
                              c.data.award_name || '';
            }
            return specificTitle ? `${catName}: <strong>${specificTitle}</strong>` : catName;
          });

          let selectedCategoryHtml = '';
          if (approvedCategoryNames.length > 0) {
            selectedCategoryHtml = `
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px dashed #e0e0e0;padding-top:12px;">
                    <tr>
                      <td width="140" style="font-size:12px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;">Selected For</td>
                      <td style="font-size:14px;color:#202124;">${approvedCategoryNames.join('<br />')}</td>
                    </tr>
                  </table>`;
          }

          const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Google Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0"
        style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 28px rgba(60,64,67,.14);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a73e8 0%,#0d47a1 100%);padding:36px 32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;line-height:1.3;">🎟 Event Ticket Confirmation</h1>
            <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">Your ticket has been issued successfully!</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="background:#e8f0fe;padding:20px 32px;text-align:center;border-bottom:1px solid #c5d8fb;">
            <p style="margin:0;color:#1a73e8;font-size:15px;font-weight:600;">Dear ${reg.name},</p>
            <p style="margin:6px 0 0;color:#3c4043;font-size:14px;line-height:1.6;">
              Greetings from the Organizing Team!<br />
              We are pleased to inform you that your nomination has been <strong>approved</strong> for the Achievers Day Award.<br />
              For more detailed info, please join the WhatsApp group linked below.
            </p>
          </td>
        </tr>

        <!-- Ticket Card -->
        <tr>
          <td style="padding:28px 32px 8px;">
            <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#202124;">🎫 Event Ticket Details</h2>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f8f9fa;border-radius:12px;border:2px dashed #c5d8fb;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                    <tr>
                      <td width="140" style="font-size:12px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;padding-bottom:2px;">Ticket No.</td>
                      <td style="font-size:18px;font-weight:700;color:#1a73e8;letter-spacing:1px;">${ticketNo}</td>
                    </tr>
                  </table>
                  <hr style="border:none;border-top:1px solid #e0e0e0;margin:0 0 14px;" />
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                    <tr>
                      <td width="140" style="font-size:12px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;">Name</td>
                      <td style="font-size:14px;font-weight:600;color:#202124;">${reg.name}</td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                    <tr>
                      <td width="140" style="font-size:12px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;">Department</td>
                      <td style="font-size:14px;font-weight:500;color:#202124;">${department}</td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="140" style="font-size:12px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;">University Email</td>
                      <td style="font-size:14px;font-weight:500;color:#202124;">${reg.email}</td>
                    </tr>
                  </table>
                  ${selectedCategoryHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Event Details -->
        <tr>
          <td style="padding:20px 32px 8px;">
            <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#202124;">📌 Event Details</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td width="40" valign="top"><div style="width:36px;height:36px;background:#e8f0fe;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">📅</div></td>
                <td style="padding-left:12px;vertical-align:middle;">
                  <div style="font-size:11px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">Date</div>
                  <div style="font-size:14px;font-weight:500;color:#202124;">${eventDate}</div>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td width="40" valign="top"><div style="width:36px;height:36px;background:#e6f4ea;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">🕐</div></td>
                <td style="padding-left:12px;vertical-align:middle;">
                  <div style="font-size:11px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">Time</div>
                  <div style="font-size:14px;font-weight:500;color:#202124;">${eventTime}</div>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td width="40" valign="top"><div style="width:36px;height:36px;background:#fce8e6;border-radius:8px;text-align:center;line-height:36px;font-size:18px;">📍</div></td>
                <td style="padding-left:12px;vertical-align:middle;">
                  <div style="font-size:11px;color:#9aa0a6;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">Venue</div>
                  <div style="font-size:14px;font-weight:500;color:#202124;">${event.venue}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Important Instructions -->
        <tr>
          <td style="padding:16px 32px 24px;">
            <div style="background:#fffde7;border-radius:12px;padding:18px 22px;border:1px solid #ffe082;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#e65100;">📋 Important Instructions</p>
              <ul style="margin:0;padding-left:18px;color:#3c4043;font-size:13px;line-height:2;">
                <li>This email serves as your <strong>official event entry ticket</strong>.</li>
                <li>Your University Email ID will be <strong>verified at the venue</strong> by the organizing team.</li>
                <li>Duty Leave (DL) attendance will be granted only after successful verification at the venue.</li>
                <li>Please carry your <strong>University ID Card</strong> for identity confirmation.</li>
                <li>Kindly ensure that the above details are correct. In case of any discrepancy, contact the organizing team <strong>before the event date</strong>.</li>
                <li><strong>Dress Code:</strong> Semi Formals</li>
              </ul>
            </div>
          </td>
        </tr>

        <!-- ACO Approved Badge -->
        <tr>
          <td style="padding:0 32px 20px;">
            <div style="background:#e8f5e9;border-radius:12px;padding:16px 20px;border:1px solid #a5d6a7;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="40" valign="top" style="text-align:center;font-size:22px;padding-top:2px;">✅</td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <div style="font-size:13px;font-weight:700;color:#1b5e20;margin-bottom:4px;">ACO Approval — University Level Co-Curricular Club</div>
                    <div style="font-size:12px;color:#2e7d32;line-height:1.7;margin-bottom:12px;">
                      For applying Duty Leave (DL) for this event, kindly take prior approval from ACO / Assistant Dean OAA on the mentioned category's duty leave format.
                    </div>
                    <a href="https://drive.google.com/file/d/11oQHrEJwYyaD52yndoVyRtQ0MGvCktJx/view?usp=sharing"
                      target="_blank"
                      style="display:inline-block;background:#1b5e20;color:#ffffff;font-size:12px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none;letter-spacing:.3px;">
                      📄 View DL Format Document
                    </a>
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- WhatsApp Group -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#e7f7ee;border-radius:12px;padding:18px 22px;border:1px solid #b2dfdb;text-align:center;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#00695c;">💬 Join Our WhatsApp Group</p>
              <p style="margin:0 0 14px;font-size:13px;color:#3c4043;line-height:1.6;">
                Stay updated with event announcements, schedules, and last-minute changes.<br />
                Join our official WhatsApp group for participants:
              </p>
              <a href="https://chat.whatsapp.com/GOzVfSfxsggCrMJFAGnucs"
                target="_blank"
                style="display:inline-block;background:#25d366;color:#ffffff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:50px;text-decoration:none;letter-spacing:.3px;">
                🟢 Join WhatsApp Group
              </a>
            </div>
          </td>
        </tr>

        <!-- Best Regards -->
        <tr>
          <td style="padding:0 32px 24px;background:#f8f9fa;border-top:1px solid #e0e0e0;">
            <p style="margin:16px 0 6px;font-size:14px;font-weight:600;color:#202124;">We look forward to your active participation!</p>
            <p style="margin:0;font-size:13px;color:#5f6368;line-height:2;">
              Best Regards,<br />
              <strong>ABHYUTTHANAM Organizing Team</strong><br />
              Chandigarh University<br />
              <span style="font-weight:600;color:#3c4043;">POC Mobile No. 8708255863, 9773553664</span><br />
              <span style="color:#9aa0a6;font-size:12px;">Approved under: University Level (Co-Curricular Clubs) | ACO Certified</span>
            </p>
          </td>
        </tr>

        <!-- Footer strip -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#ea4335 25%,#fbbc04 25% 50%,#34a853 50% 75%,#1a73e8 75%);"></td></tr>
        <tr>
          <td style="padding:14px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9aa0a6;">
              © ${new Date().getFullYear()} ABHYUTTHANAM, Chandigarh University — See you there! 🎉
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

          try {
            await transporter.sendMail({
              from: `"ABHYUTTHANAM" <${process.env.EMAIL_FROM}>`,
              to: reg.email,
              subject: `🎟 Your Event Ticket Confirmation – ABHYUTTHANAM | ${ticketNo}`,
              html,
            });
            results.sent++;
            await Registration.findByIdAndUpdate(reg._id, { ticketSentAt: new Date() });
          } catch (mailErr) {
            results.failed++;
            results.errors.push({ email: reg.email, error: mailErr.message });
            console.error(`Ticket email failed for ${reg.email}:`, mailErr.message);
          }
        })
      );
    }

    console.log(`✅ Ticket blast done — sent: ${results.sent}, failed: ${results.failed}, skipped: ${alreadySent}`);
    return res.json({
      success: true,
      message: `Tickets sent to ${results.sent} new participant(s). ${alreadySent > 0 ? `${alreadySent} already emailed (skipped).` : ''} Failed: ${results.failed}.`,
      sent:    results.sent,
      failed:  results.failed,
      skipped: alreadySent,
      ...(results.errors.length ? { errors: results.errors } : {}),
    });
  } catch (err) {
    console.error('sendTickets error:', err.message);
    return res.status(500).json({ error: 'Failed to send ticket emails.' });
  }
};

const getFacultyTicketId = (ecode) => {
  if (!ecode) return 'N/A';
  let hash = 0;
  for (let i = 0; i < ecode.length; i++) {
    hash = ((hash << 5) - hash) + ecode.charCodeAt(i);
    hash |= 0;
  }
  return `F${Math.abs(hash).toString(16).slice(-3).toUpperCase()}`;
};

// ── POST /admin/mark-attendance ──────────────────────────────────────────────
const markAttendance = async (req, res) => {
  try {
    const { ticketCode } = req.body;
    if (!ticketCode || typeof ticketCode !== 'string') {
      return res.status(400).json({ error: 'ticketCode is required.' });
    }

    const code = ticketCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code)) {
      return res.status(400).json({ error: 'Ticket code must be exactly 4 alphanumeric characters.' });
    }

    const isFaculty = code.startsWith('F');
    const registrations = await Registration.find().lean().limit(10000);

    if (isFaculty) {
      // Find all registrations where any category has this faculty E-code (hashed)
      const matches = registrations.filter(r => {
        if (!Array.isArray(r.categories)) return false;
        return r.categories.some(cat => 
          cat.data && cat.data.faculty_ecode && getFacultyTicketId(cat.data.faculty_ecode) === code
        );
      });

      if (matches.length === 0) {
        return res.status(404).json({ error: `No faculty mentor found with ticket code ${code}.` });
      }

      // Check if already marked (check any matched registration)
      if (matches.some(m => m.facultyAttendedAt)) {
        const m = matches.find(m => m.facultyAttendedAt);
        const cat = m.categories.find(c => c.data && getFacultyTicketId(c.data.faculty_ecode) === code);
        return res.status(409).json({
          error: 'Faculty member already marked present!',
          alreadyPresent: true,
          registration: {
            name: cat.data.faculty_name,
            email: cat.data.faculty_email || 'N/A',
            department: 'Faculty Mentor',
            ticketCode: code,
            attendedAt: m.facultyAttendedAt,
          }
        });
      }

      // Mark ALL matched registrations as attended for this faculty
      const ids = matches.map(m => m._id);
      await Registration.updateMany({ _id: { $in: ids } }, { facultyAttendedAt: new Date(), facultyTicketCode: code });

      const firstMatch = matches[0];
      const cat = firstMatch.categories.find(c => c.data && getFacultyTicketId(c.data.faculty_ecode) === code);

      return res.json({
        success: true,
        message: `Attendance marked for Faculty: ${cat.data.faculty_name}`,
        registration: {
          name: cat.data.faculty_name,
          email: cat.data.faculty_email || 'N/A',
          department: 'Faculty Mentor',
          ticketCode: code,
          type: 'faculty'
        }
      });
    }

    // Student Logic
    const reg = registrations.find(
      r => r._id.toString().slice(-4).toUpperCase() === code
    ) ?? null;

    if (!reg) {
      return res.status(404).json({
        error: `No student found with ticket code EVT-${code}.`,
      });
    }

    if (reg.attendedAt) {
      return res.status(409).json({
        error: 'Student already marked present!',
        alreadyPresent: true,
        registration: {
          name:       reg.name,
          email:      reg.email,
          department: reg.department,
          cluster:    reg.cluster,
          attendedAt: reg.attendedAt,
          ticketCode: `EVT-${code}`,
        },
      });
    }

    await Registration.findByIdAndUpdate(reg._id, { attendedAt: new Date() });

    console.log(`✅ Attendance marked for ${reg.name} (EVT-${code})`);
    return res.json({
      success: true,
      message: `Attendance marked for ${reg.name}`,
      registration: {
        name:       reg.name,
        email:      reg.email,
        department: reg.department,
        cluster:    reg.cluster,
        ticketCode: `EVT-${code}`,
      },
    });
  } catch (err) {
    console.error('markAttendance error:', err.message);
    return res.status(500).json({ error: 'Failed to mark attendance.' });
  }
};

// ── PUT /admin/registrations/:id/evaluation ─────────────────────────────────
const updateEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, categoryIndex } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: 'Missing id or status' });
    }

    const reg = await Registration.findById(id);
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    let updatePayload = {};

    if (categoryIndex !== undefined && categoryIndex !== null) {
      const idx = parseInt(categoryIndex, 10);
      if (idx < 0 || idx >= reg.categories.length) {
        return res.status(400).json({ error: 'Invalid category index' });
      }
      const categories = [...reg.categories];
      categories[idx] = { ...categories[idx], status };
      updatePayload = { categories };
    } else {
      updatePayload = { evaluation_status: status };
    }

    const updated = await Registration.findByIdAndUpdate(id, updatePayload, { new: true });
    return res.json({ success: true, registration: updated });
  } catch (err) {
    console.error('updateEvaluation error:', err.message);
    return res.status(500).json({ error: 'Failed to update evaluation' });
  }
};

// ── GET /admin/registrations/export ──────────────────────────────────────────
const exportRegistrations = async (req, res) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 }).lean();

    if (!registrations || registrations.length === 0) {
      return res.status(404).json({ error: 'No registrations found to export' });
    }

    const headers = [
      'Name', 'Email', 'UID/EID', 'Department', 'Cluster',
      'Overall Status', 'Attendance Status', 'Registered At',
      'Category Type', 'Category Status', 'Award/Grant', 'Category Details'
    ];

    const rows = [headers.join(',')];

    registrations.forEach(reg => {
      const basicInfo = [
        `"${reg.name || ''}"`,
        `"${reg.email || ''}"`,
        `"${reg.uid || ''}"`,
        `"${reg.department || ''}"`,
        `"${reg.cluster || ''}"`,
        `"${reg.evaluation_status || 'Pending'}"`,
        `"${reg.attendedAt ? 'Present' : 'Absent'}"`,
        `"${reg.createdAt ? new Date(reg.createdAt).toLocaleString('en-IN') : ''}"`
      ];

      if (reg.categories && Array.isArray(reg.categories) && reg.categories.length > 0) {
        reg.categories.forEach(cat => {
          const details = cat.data ? Object.entries(cat.data)
            .filter(([_, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => {
              const displayKey = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              return `${displayKey}: ${v}`;
            }).join('; ') : '';
          const row = [
            ...basicInfo,
            `"${cat.type || 'N/A'}"`,
            `"${cat.status || 'Pending'}"`,
            `"${cat.award || 'None'}"`,
            `"${details.replace(/"/g, '""')}"`
          ];
          rows.push(row.join(','));
        });
      } else {
        const row = [...basicInfo, '"N/A"', '"N/A"', '"None"', '""'];
        rows.push(row.join(','));
      }
    });

    const csvContent = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=registrations_export_${new Date().toISOString().split('T')[0]}.csv`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('exportRegistrations error:', err.message);
    return res.status(500).json({ error: 'Failed to generate export file' });
  }
};

// ── PUT /admin/registrations/:id/award ──────────────────────────────────────
const updateAward = async (req, res) => {
  try {
    const { id } = req.params;
    const { award, categoryIndex, isFaculty } = req.body;

    if (!id || award === undefined || categoryIndex === undefined) {
      return res.status(400).json({ error: 'Missing id, award, or categoryIndex' });
    }

    const reg = await Registration.findById(id);
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    const idx = parseInt(categoryIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= reg.categories.length) {
      return res.status(400).json({ error: 'Invalid category index' });
    }

    const categories = [...reg.categories];
    const field = isFaculty ? 'faculty_award' : 'award';
    categories[idx] = { ...categories[idx], [field]: award };

    const updated = await Registration.findByIdAndUpdate(id, { categories }, { new: true });
    return res.json({ success: true, registration: updated });
  } catch (err) {
    console.error('updateAward error:', err.message);
    return res.status(500).json({ error: 'Failed to update award' });
  }
};

// ── POST /admin/registrations/add ───────────────────────────────────────────
// Admin-only: manually add an awardee with Approved status.
// Seat logic:
//   - If seats are available (remaining > 0): just consume one (bookedSeats++)
//   - If house is full  (remaining === 0):  expand + consume (totalSeats++, bookedSeats++)
const addAwardee = async (req, res) => {
  try {
    const { name, email, uid, cluster, department, categories } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    // Force every submitted category to Approved
    const approvedCategories = (Array.isArray(categories) ? categories : []).map(cat => ({
      ...cat,
      status: 'Approved',
    }));

    const newReg = await Registration.create({
      name:              name.trim(),
      email:             email.trim().toLowerCase(),
      uid:               uid?.trim() || null,
      cluster:           cluster?.trim() || null,
      department:        department?.trim() || null,
      categories:        approvedCategories,
      evaluation_status: 'Approved',
    });

    // Check current seat state AFTER the registration is created
    const event = await Event.findOne().lean();
    const remaining = (event?.totalSeats ?? 0) - (event?.bookedSeats ?? 0);
    const noSeatsLeft = remaining <= 0;

    // Only expand totalSeats if the venue is already full
    const seatUpdate = noSeatsLeft
      ? { $inc: { totalSeats: 1, bookedSeats: 1 } }   // full house → grow + consume
      : { $inc: { bookedSeats: 1 } };                 // seats available → just consume

    await Event.findOneAndUpdate({}, seatUpdate);

    console.log(`✅ Awardee added by admin: ${name} <${email}> (seat expanded: ${noSeatsLeft})`);
    return res.status(201).json({
      success: true,
      registration: newReg.toJSON(),
      seatAction: noSeatsLeft ? 'expanded' : 'consumed', // tells frontend which counters to update
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A registration with this email already exists.' });
    }
    console.error('addAwardee error:', err.message);
    return res.status(500).json({ error: 'Failed to add awardee.' });
  }
};

// ── PUT /admin/mentor/update ────────────────────────────────────────────────
const updateMentorDetails = async (req, res) => {
  try {
    const { oldEcode, oldName, newName, newEcode, newEmail } = req.body;

    if (!oldEcode && !oldName) {
      return res.status(400).json({ error: 'Identification (oldEcode or oldName) required' });
    }

    const filter = oldEcode 
      ? { 'categories.data.faculty_ecode': oldEcode }
      : { 'categories.data.faculty_name': oldName };

    const arrayFilter = oldEcode
      ? { 'elem.data.faculty_ecode': oldEcode }
      : { 'elem.data.faculty_name': oldName };

    const update = {};
    if (newName) update['categories.$[elem].data.faculty_name'] = newName.trim();
    if (newEcode) update['categories.$[elem].data.faculty_ecode'] = newEcode.trim().toUpperCase();
    if (newEmail) update['categories.$[elem].data.faculty_email'] = newEmail.trim().toLowerCase();

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No new details provided to update' });
    }

    const result = await Registration.updateMany(
      filter,
      { $set: update },
      { arrayFilters: [arrayFilter] }
    );

    console.log(`✅ Mentor updated: ${oldEcode || oldName} → ${newEcode || ''} ${newName || ''} (${result.modifiedCount} records)`);
    return res.json({ 
      success: true, 
      message: `Mentor details updated in ${result.modifiedCount} records.`,
      modifiedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error('updateMentorDetails error:', err.message);
    return res.status(500).json({ error: 'Failed to update mentor details.' });
  }
};

// ── POST /admin/send-test-mail ──────────────────────────────────────────────
const sendTestMail = async (req, res) => {
  try {
    const { email, type, mentorData } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const isFaculty = type === 'faculty';
    const m = mentorData || {
      facultyName: "Dr. Ankita Sharma",
      studentName: "Abhigya Ranjan",
      projectTitle: "SANSAD National Youth Parliament",
      category: "Competitions",
      ticketId: "FB4A"
    };

    const subject = isFaculty 
      ? 'Invitation: Faculty Mentor Recognition — ABHYUTTHANAM' 
      : 'TEST: Your Event Ticket Confirmation – ABHYUTTHANAM | TEST-0001';

    const html = isFaculty ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
    body { margin: 0; padding: 0; background-color: #f4f7fa; font-family: 'Outfit', sans-serif; color: #1a1f36; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); padding: 60px 40px; text-align: center; color: #ffffff; position: relative; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 600; color: #1a73e8; margin-bottom: 20px; }
    .detail-card { background: #f8faff; border: 1px solid #e3e8ee; border-radius: 16px; padding: 25px; margin-bottom: 30px; }
    .detail-label { font-size: 11px; text-transform: uppercase; color: #8792a2; font-weight: 600; letter-spacing: 1px; }
    .detail-value { font-size: 15px; color: #1a1f36; font-weight: 500; margin-top: 4px; }
    .footer { padding: 30px 40px; background: #f8faff; border-top: 1px solid #e3e8ee; text-align: center; font-size: 13px; color: #8792a2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Honored Faculty Mentor</h1>
      <p>ABHYUTTHANAM – Annual Recognition Ceremony 2026</p>
    </div>
    <div class="content">
      <div class="greeting">Dear ${m.facultyName},</div>
      <p style="line-height:1.6; color:#4f566b;">
        Your invaluable mentorship has played a pivotal role in the success of your student's project. We are honored to invite you to the <strong>Faculty Recognition Segment</strong> of the upcoming ceremony.
      </p>
      <div class="detail-card">
        <div style="margin-bottom:15px;">
          <div class="detail-label">Faculty Ticket ID</div>
          <div class="detail-value" style="color:#1a73e8; font-weight:700; font-family:monospace; font-size:18px; letter-spacing:1px;">${m.ticketId || 'N/A'}</div>
        </div>
        <div style="margin-bottom:15px;">
          <div class="detail-label">Nominated By</div>
          <div class="detail-value">${m.studentName}</div>
        </div>
        <div style="margin-bottom:15px;">
          <div class="detail-label">Project Title</div>
          <div class="detail-value">${m.projectTitle}</div>
        </div>
        <div>
          <div class="detail-label">Category</div>
          <div class="detail-value">${m.category}</div>
        </div>
      </div>
      <p style="text-align:center; font-size:14px; color:#1a73e8; font-weight:600;">
        Main University Auditorium • April 25, 2026
      </p>
    </div>
    <div class="footer">
      Organized by Team CuSoc • Chandigarh University
    </div>
  </div>
</body>
</html>` : `
<!-- Student Template logic here (simplified for brevity or copy from sendTickets) -->
<p>Test Student Ticket</p>
`;

    await transporter.sendMail({
      from: `"ABHYUTTHANAM" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject,
      html,
    });

    return res.json({ success: true, message: `Test ${type} email sent to ${email}` });
  } catch (err) {
    console.error('sendTestMail error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ── POST /admin/send-faculty-invitations ─────────────────────────────────────
const sendBulkFacultyInvitations = async (req, res) => {
  try {
    const { facultyMembers } = req.body; 
    if (!Array.isArray(facultyMembers) || facultyMembers.length === 0) {
      return res.status(400).json({ error: 'No faculty members provided' });
    }

    console.log(`🚀 Starting bulk faculty mailing for ${facultyMembers.length} members...`);

    // Use a loop or promise.all with rate limiting if needed
    // For now, let's process them and send. NodeMailer pool handles queueing.
    const results = { success: 0, failed: 0 };

    for (const member of facultyMembers) {
      try {
        const m = {
          facultyName: member.facultyName,
          studentName: member.studentName || 'Your Students',
          projectTitle: member.projectTitle || 'Various Projects',
          category: member.category || 'Mentorship',
          ticketId: member.ticketId || 'N/A'
        };

        const subject = 'Invitation: Faculty Mentor Recognition — ABHYUTTHANAM';
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
    body { margin: 0; padding: 0; background-color: #f4f7fa; font-family: 'Outfit', sans-serif; color: #1a1f36; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); padding: 60px 40px; text-align: center; color: #ffffff; position: relative; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 600; color: #1a73e8; margin-bottom: 20px; }
    .detail-card { background: #f8faff; border: 1px solid #e3e8ee; border-radius: 16px; padding: 25px; margin-bottom: 30px; }
    .detail-label { font-size: 11px; text-transform: uppercase; color: #8792a2; font-weight: 600; letter-spacing: 1px; }
    .detail-value { font-size: 14px; color: #1a1f36; font-weight: 500; margin-top: 4px; }
    .footer { padding: 30px 40px; background: #f8faff; border-top: 1px solid #e3e8ee; text-align: center; font-size: 13px; color: #8792a2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Honored Faculty Mentor</h1>
      <p>ABHYUTTHANAM – Annual Recognition Ceremony 2026</p>
    </div>
    <div class="content">
      <div class="greeting">Dear ${m.facultyName},</div>
      <p style="line-height:1.6; color:#4f566b;">
        Your invaluable mentorship has played a pivotal role in the success of your student's project. We are honored to invite you to the <strong>Faculty Recognition Segment</strong> of the upcoming ceremony.
      </p>
      <div class="detail-card">
        <div style="margin-bottom:15px;">
          <div class="detail-label">Faculty Ticket ID</div>
          <div class="detail-value" style="color:#1a73e8; font-weight:700; font-family:monospace; font-size:18px; letter-spacing:1px;">${m.ticketId}</div>
        </div>
        <div style="margin-bottom:15px;">
          <div class="detail-label">Nominated By</div>
          <div class="detail-value">${m.studentName}</div>
        </div>
        <div style="margin-bottom:15px;">
          <div class="detail-label">Project Title</div>
          <div class="detail-value">${m.projectTitle}</div>
        </div>
        <div>
          <div class="detail-label">Category</div>
          <div class="detail-value">${m.category}</div>
        </div>
      </div>
      <p style="text-align:center; font-size:14px; color:#1a73e8; font-weight:600;">
        Main University Auditorium • April 25, 2026
      </p>
    </div>
    <div class="footer">
      Organized by Team CuSoc • Chandigarh University
    </div>
  </div>
</body>
</html>`;

        await transporter.sendMail({
          from: `"ABHYUTTHANAM" <${process.env.EMAIL_FROM}>`,
          to: member.email,
          subject,
          html,
        });
        results.success++;
      } catch (err) {
        console.error(`Failed to send mail to ${member.email}:`, err.message);
        results.failed++;
      }
    }

    return res.json({ 
      success: true, 
      message: `Bulk mailing complete. Sent: ${results.success}, Failed: ${results.failed}`,
      results 
    });
  } catch (err) {
    console.error('sendBulkFacultyInvitations error:', err.message);
    return res.status(500).json({ error: 'Internal server error during bulk mailing.' });
  }
};

module.exports = {
  getStats,
  getRegistrations,
  deleteRegistration,
  getEvent,
  updateEvent,
  adminLogin,
  sendTickets,
  markAttendance,
  updateEvaluation,
  exportRegistrations,
  updateAward,
  addAwardee,
  updateMentorDetails,
  sendTestMail,
  sendBulkFacultyInvitations,
};
