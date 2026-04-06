const express  = require('express');
const bcrypt   = require('bcryptjs');
const nodemailer = require('nodemailer');
const router   = express.Router();
const User     = require('../models/User');
const Otp      = require('../models/Otp');
const multer   = require('multer');

// ── Multer setup for photo uploads ──────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

/* ── NODEMAILER TRANSPORTER ──────────────────────────── */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ── UTIL: generate 6-digit OTP ──────────────────────── */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* ── UTIL: send OTP email ─────────────────────────────── */
async function sendOtpEmail(toEmail, toName, otp) {
  await transporter.sendMail({
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
  });
  console.log(`📧 OTP email sent to ${toEmail}`);
}

/* ══════════════════════════════════════════════════════════
   POST /api/team/send-otp
   Body: { name, team }
══════════════════════════════════════════════════════════ */
router.post('/send-otp', async (req, res) => {
  try {
    const { name, team } = req.body;

    if (!name || !team)
      return res.status(400).json({ message: 'Name and team are required.' });

    const user = await User.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      role: 'team',
      team: team.toLowerCase(),
    });

    if (!user)
      return res.status(404).json({ message: 'No team member found with that name in this team.' });

    if (!user.email)
      return res.status(400).json({ message: 'No email registered for this account. Contact your admin.' });

    await Otp.deleteMany({ userId: user._id });

    const raw  = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(raw, salt);

    await Otp.create({
      userId:    user._id,
      otp:       hash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await sendOtpEmail(user.email, user.name, raw);

    // Mask email for UI — e.g. "r***@gmail.com"
    const [localPart, domain] = user.email.split('@');
    const masked = localPart[0] + '***@' + domain;

    res.json({
      message: `OTP sent to ${masked}`,
      userId:  user._id,
      masked,
    });

  } catch (err) {
    console.error('🔴 send-otp error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════
   POST /api/team/verify-otp
   Body: { userId, otp }
══════════════════════════════════════════════════════════ */
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp)
      return res.status(400).json({ message: 'userId and otp are required.' });

    const record = await Otp.findOne({
      userId,
      verified:  false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record)
      return res.status(400).json({ message: 'OTP expired or not found. Please request a new one.' });

    const isMatch = await bcrypt.compare(otp.toString(), record.otp);
    if (!isMatch)
      return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });

    await Otp.deleteOne({ _id: record._id });

    const user = await User.findById(userId).select('-password');
    if (!user)
      return res.status(404).json({ message: 'User not found.' });

    res.json({
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
    console.error('🔴 verify-otp error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /api/team/members/:team
══════════════════════════════════════════════════════════ */
router.get('/members/:team', async (req, res) => {
  try {
    const { team } = req.params;

    if (!['tech', 'events', 'digital'].includes(team))
      return res.status(400).json({ message: 'Invalid team name.' });

    const members = await User.find(
      { role: 'team', team },
      'name teamRole'
    ).sort({ name: 1 });

    res.json({ members });

  } catch (err) {
    console.error('🔴 members error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /api/team/profile/:userId
══════════════════════════════════════════════════════════ */
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('name team teamRole photo photoMime linkedin');
    if (!user)
      return res.status(404).json({ message: 'User not found.' });

    if (user.role !== 'team')
      return res.status(403).json({ message: 'Access denied.' });

    res.json({
      user: {
        id:        user._id,
        name:      user.name,
        team:      user.team,
        teamRole:  user.teamRole,
        photo:     user.photo,
        photoMime: user.photoMime,
        linkedin:  user.linkedin,
      }
    });

  } catch (err) {
    console.error('🔴 profile get error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════
   PUT /api/team/profile/:userId
══════════════════════════════════════════════════════════ */
router.put('/profile/:userId', upload.single('photo'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { linkedin } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: 'User not found.' });

    if (user.role !== 'team' && user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied.' });

    if (req.file) {
      user.photo     = req.file.buffer.toString('base64');
      user.photoMime = req.file.mimetype;
    }

    if (linkedin !== undefined) user.linkedin = linkedin;

    await user.save();

    res.json({
      message: 'Profile updated successfully.',
      user: {
        id:        user._id,
        name:      user.name,
        email:     user.email,
        role:      user.role,
        team:      user.team,
        teamRole:  user.teamRole,
        phone:     user.phone,
        photo:     user.photo,
        photoMime: user.photoMime,
        linkedin:  user.linkedin,
      }
    });

  } catch (err) {
    console.error('🔴 profile update error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

module.exports = router;