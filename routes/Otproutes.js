const express  = require('express');
const bcrypt   = require('bcryptjs');
const nodemailer = require('nodemailer');
const router   = express.Router();
const User     = require('../models/User');
const Otp      = require('../models/Otp');

/* ── UTIL: generate 6-digit OTP ──────────────────────── */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* ── NODEMAILER TRANSPORTER ──────────────────────────── */
const transporter = nodemailer.createTransport({
  service: 'gmail',   // swap with 'outlook', 'yahoo', or use SMTP host/port
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ── UTIL: send OTP email ─────────────────────────────── */
async function sendOtpEmail(toEmail, toName, otp) {
  const mailOptions = {
    from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to:      toEmail,
    subject: `Your ClustrCore OTP: ${otp}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#faf8f5;border-radius:16px;">
        <h2 style="margin:0 0 8px;color:#1a1410;">Hey ${toName} 👋</h2>
        <p style="color:#4a3f35;margin:0 0 24px;">Here's your one-time password to log in to <strong>ClustrCore</strong>:</p>
        <div style="letter-spacing:10px;font-size:36px;font-weight:700;color:#c8623a;text-align:center;
                    background:#fff;border:1px solid #e0d8cf;border-radius:12px;padding:20px 0;">
          ${otp}
        </div>
        <p style="color:#8c7b6d;font-size:13px;margin:20px 0 0;text-align:center;">
          Valid for <strong>10 minutes</strong>. Do not share this with anyone.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 OTP email sent to ${toEmail}`);
}

/* ══════════════════════════════════════════════════════════
   POST /api/otp/send
   Body: { name, team }
══════════════════════════════════════════════════════════ */
router.post('/send', async (req, res) => {
  try {
    const { name, team } = req.body;

    if (!name || !name.trim())
      return res.status(400).json({ message: 'Name is required.' });
    if (!team)
      return res.status(400).json({ message: 'Team is required.' });
    if (!['tech', 'events', 'digital'].includes(team.toLowerCase()))
      return res.status(400).json({ message: 'Invalid team.' });

    const user = await User.findOne({
      name:  { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      role:  'team',
      team:  team.toLowerCase(),
    });

    if (!user)
      return res.status(404).json({ message: 'No member found with that name in this team.' });

    if (!user.email)
      return res.status(400).json({ message: 'No email is registered for this account. Contact your admin.' });

    await Otp.deleteMany({ userId: user._id });

    const rawOtp    = generateOtp();
    const salt      = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(rawOtp, salt);

    await Otp.create({
      userId:    user._id,
      otp:       hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified:  false,
    });

    await sendOtpEmail(user.email, user.name, rawOtp);

    // Mask email for UI — e.g. "r***@gmail.com"
    const [localPart, domain] = user.email.split('@');
    const maskedEmail = localPart[0] + '***@' + domain;

    return res.status(200).json({
      message: `OTP sent to ${maskedEmail}.`,
      userId:  user._id,
      masked:  maskedEmail,   // frontend shows this in the hint
    });

  } catch (err) {
    console.error('🔴 OTP send error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to send OTP.' });
  }
});

/* ══════════════════════════════════════════════════════════
   POST /api/otp/verify
   Body: { userId, otp }
══════════════════════════════════════════════════════════ */
router.post('/verify', async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId)
      return res.status(400).json({ message: 'userId is required.' });
    if (!otp || otp.toString().length !== 6)
      return res.status(400).json({ message: 'A valid 6-digit OTP is required.' });

    const record = await Otp.findOne({
      userId,
      verified:  false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record)
      return res.status(400).json({ message: 'OTP has expired or was not found. Please request a new one.' });

    const isMatch = await bcrypt.compare(otp.toString(), record.otp);

    if (!isMatch)
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });

    await Otp.deleteOne({ _id: record._id });

    const user = await User.findById(userId).select('-password');
    if (!user)
      return res.status(404).json({ message: 'User not found.' });

    return res.status(200).json({
      message: 'OTP verified successfully.',
      user: {
        id:       user._id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        team:     user.team,
        teamRole: user.teamRole,
        phone:    user.phone,
      },
    });

  } catch (err) {
    console.error('🔴 OTP verify error:', err.message);
    res.status(500).json({ message: err.message || 'Verification failed.' });
  }
});

/* ══════════════════════════════════════════════════════════
   POST /api/otp/resend
   Body: { userId }
══════════════════════════════════════════════════════════ */
router.post('/resend', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId)
      return res.status(400).json({ message: 'userId is required.' });

    const recent = await Otp.findOne({ userId }).sort({ createdAt: -1 });
    if (recent) {
      const secondsAgo = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
      if (secondsAgo < 30) {
        const waitSecs = Math.ceil(30 - secondsAgo);
        return res.status(429).json({ message: `Please wait ${waitSecs}s before resending.` });
      }
    }

    const user = await User.findById(userId).select('name email team role');
    if (!user || user.role !== 'team' || !user.email)
      return res.status(404).json({ message: 'User not found or has no email.' });

    await Otp.deleteMany({ userId });

    const rawOtp    = generateOtp();
    const salt      = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(rawOtp, salt);

    await Otp.create({
      userId,
      otp:       hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified:  false,
    });

    await sendOtpEmail(user.email, user.name, rawOtp);

    const [localPart, domain] = user.email.split('@');
    const maskedEmail = localPart[0] + '***@' + domain;

    return res.status(200).json({
      message: `New OTP sent to ${maskedEmail}.`,
      masked:  maskedEmail,
    });

  } catch (err) {
    console.error('🔴 OTP resend error:', err.message);
    res.status(500).json({ message: err.message || 'Resend failed.' });
  }
});

module.exports = router;