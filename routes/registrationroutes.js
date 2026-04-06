const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const Registration = require('../models/Registration');
const Event        = require('../models/Event');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 3 * 1024 * 1024 }, // 3 MB for screenshot
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPEG/PNG/WEBP allowed'), ok);
  },
});

/* ══════════════════════════════════════════════════════════
   POST /api/registrations
   Body: multipart/form-data  (paymentScreenshot optional file)
   All form fields come as req.body strings.
══════════════════════════════════════════════════════════ */
router.post('/', upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const {
      eventId, eventName,
      name, email, phone,
      course, year, branch,
      /* hackathon */
      teamName, teamSize, teamMembers, projectIdea,
      /* workshop */
      laptopRequired,
      /* general */
      message,
      /* payment */
      paymentUtrRef,
    } = req.body;

    /* ── Basic validation ── */
    if (!eventId || !name || !email) {
      return res.status(400).json({ message: 'eventId, name and email are required.' });
    }

    /* ── Look up event for category + payment info ── */
    const event = await Event.findById(eventId).select('category title registrationClose').lean();
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    /* ── Check registration window ── */
    if (event.registrationClose && new Date() > new Date(event.registrationClose)) {
      return res.status(400).json({ message: 'Registration for this event has closed.' });
    }

    /* ── Parse teamMembers JSON string sent from frontend ── */
    let parsedMembers = [];
    if (teamMembers) {
      try { parsedMembers = JSON.parse(teamMembers); } catch {}
    }

    /* ── Payment screenshot → base64 ── */
    let screenshotBase64 = '';
    if (req.file) {
      screenshotBase64 = req.file.buffer.toString('base64');
    }

    /* Determine payment status */
    const paymentStatus = screenshotBase64
      ? 'screenshot_uploaded'
      : 'not_required';

    const reg = await Registration.create({
      eventId,
      eventName:      eventName || event.title,
      eventCategory:  event.category,

      name:   name.trim(),
      email:  email.trim().toLowerCase(),
      phone:  phone  || undefined,
      course: course || undefined,
      year:   year   ? Number(year) : undefined,
      branch: branch || undefined,

      /* hackathon */
      teamName:    teamName    || undefined,
      teamSize:    teamSize    ? Number(teamSize) : undefined,
      teamMembers: parsedMembers,
      projectIdea: projectIdea || undefined,

      /* workshop */
      laptopRequired: laptopRequired != null ? laptopRequired === 'true' : null,

      message: message || undefined,

      paymentStatus,
      paymentScreenshot: screenshotBase64,
      paymentUtrRef:     paymentUtrRef || '',
    });

    res.status(201).json({
      message:        'Registration successful!',
      registrationId: reg._id,
      paymentStatus:  reg.paymentStatus,
    });

  } catch (err) {
    console.error('🔴 POST /registrations:', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This email is already registered for this event.' });
    }
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════
   GET /api/registrations/event/:eventId
   Returns all registrations for an event (Tech team)
══════════════════════════════════════════════════════════ */
router.get('/event/:eventId', async (req, res) => {
  try {
    const regs = await Registration.find({ eventId: req.params.eventId })
      .select('-paymentScreenshot')   // don't send base64 in list
      .sort({ createdAt: -1 })
      .lean();

    // Count attended registrations
    const attended = regs.filter(reg => reg.status === 'attended').length;

    res.json({
      registrations: regs,
      total: regs.length,
      attended: attended
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function bufferImageMime(buf) {
  if (!buf || buf.length < 12) return 'image/jpeg';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return 'image/jpeg';
}

/* GET /api/registrations/:id/screenshot  — download screenshot */
router.get('/:id/screenshot', async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.id).select('paymentScreenshot').lean();
    if (!reg?.paymentScreenshot) return res.status(404).json({ message: 'No screenshot found.' });
    const buf = Buffer.from(reg.paymentScreenshot, 'base64');
    const mime = bufferImageMime(buf);
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="payment_${req.params.id}.${ext}"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   PATCH /api/registrations/:id/attendance
   Body: { attended: true|false } OR { status: 'attended'|'approved'|etc }
   Update registration status (Tech team)
══════════════════════════════════════════════════════════ */
router.patch('/:id/attendance', async (req, res) => {
  try {
    let { status, attended } = req.body;

    // Handle attended boolean from frontend
    if (attended !== undefined) {
      status = attended ? 'attended' : 'approved';
    }

    if (!status) {
      return res.status(400).json({ message: 'Status or attended field is required.' });
    }

    const validStatuses = ['pending', 'approved', 'rejected', 'waitlisted', 'attended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const updated = await Registration.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    res.json({
      message: `Registration marked as ${status}`,
      registration: updated,
    });
  } catch (err) {
    console.error('🔴 PATCH /registrations/:id/attendance:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════
   PATCH /api/registrations/:id/payment
   Body: { paymentStatus: 'verified' | 'rejected' | 'pending' }
   Update payment status (Tech team verifies screenshots)
══════════════════════════════════════════════════════════ */
router.patch('/:id/payment', async (req, res) => {
  try {
    const { paymentStatus } = req.body;

    if (!paymentStatus) {
      return res.status(400).json({ message: 'paymentStatus is required.' });
    }

    const validStatuses = ['verified', 'rejected', 'pending', 'not_required', 'screenshot_uploaded'];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ 
        message: `Invalid paymentStatus. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const updated = await Registration.findByIdAndUpdate(
      req.params.id,
      { paymentStatus },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    res.json({
      message: `Payment status updated to ${paymentStatus}`,
      registration: updated,
    });
  } catch (err) {
    console.error('🔴 PATCH /registrations/:id/payment:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/* ══════════════════════════════════════════════════════════
   PUT /api/registrations/:id
   Update any registration fields
══════════════════════════════════════════════════════════ */
router.put('/:id', async (req, res) => {
  try {
    const updated = await Registration.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Registration not found.' });
    }

    res.json({
      message: 'Registration updated successfully',
      registration: updated,
    });
  } catch (err) {
    console.error('🔴 PUT /registrations/:id:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

module.exports = router;