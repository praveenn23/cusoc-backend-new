const nodemailer = require('nodemailer');

// Mocking the ENV content from the provided file
const config = {
    host: 'smtp.gmail.com',
    port: 587,
    user: 'noreply.cuinnovfest2026@cumail.in',
    pass: 'mexyrnzwguikyvnj',
    from: 'noreply.cuinnovfest2026@cumail.in'
};

const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false, // true for 465, false for other ports
    auth: {
        user: config.user,
        pass: config.pass,
    },
});

const facultyName = "Dr. Ankita Sharma";
const facultyEcode = "E9938";
const studentName = "Abhigya Ranjan";
const projectTitle = "SANSAD National Youth Parliament";
const category = "Competitions";

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Faculty Mentor Invitation</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
    body { margin: 0; padding: 0; background-color: #f4f7fa; font-family: 'Outfit', sans-serif; color: #1a1f36; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); padding: 60px 40px; text-align: center; color: #ffffff; position: relative; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; font-weight: 300; }
    .content { padding: 40px; }
    .greeting { font-size: 20px; font-weight: 600; color: #1a73e8; margin-bottom: 20px; }
    .invitation-text { font-size: 16px; line-height: 1.6; color: #4f566b; margin-bottom: 30px; }
    .detail-card { background: #f8faff; border: 1px solid #e3e8ee; border-radius: 16px; padding: 25px; margin-bottom: 30px; }
    .detail-row { display: flex; margin-bottom: 15px; }
    .detail-label { font-size: 12px; text-transform: uppercase; color: #8792a2; font-weight: 600; letter-spacing: 1px; width: 140px; }
    .detail-value { font-size: 15px; color: #1a1f36; font-weight: 500; }
    .student-badge { display: inline-block; padding: 4px 12px; background: #e8f0fe; color: #1a73e8; border-radius: 20px; font-size: 14px; font-weight: 600; margin-top: 5px; }
    .footer { padding: 30px 40px; background: #f8faff; border-top: 1px solid #e3e8ee; text-align: center; }
    .footer p { font-size: 14px; color: #8792a2; margin: 5px 0; }
    .cta-button { display: inline-block; padding: 16px 32px; background: #1a73e8; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; margin-top: 20px; transition: all 0.3s ease; }
    .ornament { position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); width: 40px; height: 40px; background: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Honored Faculty Mentor</h1>
      <p>ABHYUTTHANAM – Annual Recognition Ceremony 2026</p>
      <div class="ornament">🏆</div>
    </div>
    <div class="content">
      <div class="greeting">Dear ${facultyName},</div>
      <p class="invitation-text">
        It is with great pride that we recognize your invaluable contribution to student excellence. Your mentorship has played a pivotal role in the success of your student's project.
        <br><br>
        We are pleased to invite you to the <strong>Faculty Recognition Segment</strong> of the upcoming ceremony to receive your citation of honor.
      </p>

      <div class="detail-card">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom: 15px;">
              <div class="detail-label">Nominated By</div>
              <div class="detail-value">${studentName}</div>
              <div class="student-badge">Project Mentor</div>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 15px;">
              <div class="detail-label">Project Title</div>
              <div class="detail-value">${projectTitle}</div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="detail-label">Category</div>
              <div class="detail-value">${category}</div>
            </td>
          </tr>
        </table>
      </div>

      <p class="invitation-text" style="text-align: center;">
        Please carry this invitation (Digital/Physical) for priority entry and seating at the Faculty Enclave.
      </p>
      
      <div style="text-align: center;">
        <p style="font-size: 14px; color: #4f566b; margin-bottom: 10px;">Event Date & Venue</p>
        <div style="font-size: 16px; font-weight: 600; color: #1a1f36;">April 25, 2026 • Main University Auditorium</div>
      </div>
    </div>
    <div class="footer">
      <p>Organized by Team CuSoc</p>
      <p>Chandigarh University • Office of Academic Affairs</p>
      <p style="font-size: 12px; margin-top: 15px; opacity: 0.7;">© 2026 ABHYUTTHANAM | All Rights Reserved</p>
    </div>
  </div>
</body>
</html>
`;

async function main() {
    try {
        const info = await transporter.sendMail({
            from: `"ABHYUTTHANAM" <${config.from}>`,
            to: "sahilpraveenk03@gmail.com",
            subject: "Invitation: Faculty Mentor Recognition — ABHYUTTHANAM",
            html,
        });
        console.log("Message sent: %s", info.messageId);
    } catch (err) {
        console.error("Error sending mail:", err);
    }
}

main();
