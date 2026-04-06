const express = require("express");
const User    = require("../models/User");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const multer  = require("multer");
const router  = express.Router();

// ── Multer setup ─────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/* ══════════════════════════════════════════════════════════
   POST /api/auth/signup
══════════════════════════════════════════════════════════ */
router.post("/signup", upload.single('photo'), async (req, res) => {
  try {
    const {
      name, email, password,
      role = "student",
      secretCode,          // ← new field
      phone,
      team, teamRole,
      linkedin, github,
    } = req.body;

    /* ── 1. Basic required fields ─────────────────────────── */
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    /* ── 2. Secret-code gate for team / admin ─────────────── */
    if (role === "team" || role === "admin") {

      if (!secretCode) {
        return res.status(400).json({
          message: "A secret access code is required for team and admin sign-ups.",
        });
      }

      // Load expected codes from environment variables
      const expectedCode =
        role === "admin"
          ? process.env.ADMIN_CODE   // e.g. ADMIN2025
          : process.env.TEAM_CODE;   // e.g. TEAM2025

      if (!expectedCode) {
        // Misconfiguration — the env var is missing on the server
        console.error(`🔴 Missing env var: ${role === "admin" ? "ADMIN_CODE" : "TEAM_CODE"}`);
        return res.status(500).json({
          message: "Server configuration error. Please contact an administrator.",
        });
      }

      if (secretCode.trim() !== expectedCode.trim()) {
        return res.status(403).json({
          message:
            role === "admin"
              ? "Invalid admin signup code. Please check with your coordinator."
              : "Invalid team signup code. Please check with your coordinator.",
        });
      }
    }

    /* ── 3. Role-specific required fields ─────────────────── */
    if (role === "team" || role === "admin") {
      if (!phone) {
        return res.status(400).json({
          message: "Phone number is required for team and admin accounts.",
        });
      }
    }

    if (role === "team") {
      if (!team) {
        return res.status(400).json({
          message: "Please select your team (tech / events / digital).",
        });
      }
      if (!teamRole) {
        return res.status(400).json({
          message: "Please select your role within the team.",
        });
      }
    }

    /* ── 4. Duplicate email check ─────────────────────────── */
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "An account with this email already exists.",
      });
    }

    /* ── 5. Handle optional photo ─────────────────────────── */
    let photoData = null;
    let photoMime = null;
    if (req.file && (role === "team" || role === "admin")) {
      photoData = req.file.buffer.toString("base64");
      photoMime = req.file.mimetype;
    }

    /* ── 6. Create user ───────────────────────────────────── */
    const user = new User({
      name,
      email,
      password,
      role,
      ...(phone    && { phone }),
      ...(team     && { team }),
      ...(teamRole && { teamRole }),
      ...(photoData && { photo:     photoData }),
      ...(photoMime && { photoMime: photoMime }),
      ...(linkedin  && { linkedin }),
      ...(github    && { github }),
    });

    await user.save();

    return res.status(201).json({
      message: "Account created successfully! Please log in.",
      user: {
        id:       user._id,
        _id:      user._id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        ...(user.phone    && { phone:    user.phone }),
        ...(user.team     && { team:     user.team }),
        ...(user.teamRole && { teamRole: user.teamRole }),
        ...(user.photo    && { photo:    user.photo }),
        ...(user.linkedin && { linkedin: user.linkedin }),
        ...(user.github   && { github:   user.github }),
      },
    });

  } catch (err) {
    console.error("🔴 Signup error:", err.message);

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(" ") });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }

    return res.status(500).json({
      message: err.message || "Server error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }
});

/* ══════════════════════════════════════════════════════════
   POST /api/auth/login
══════════════════════════════════════════════════════════ */
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    if (role && user.role !== role) {
      return res.status(400).json({
        message: `This account is not registered as ${role}.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    return res.json({
      message: "Login successful",
      user: {
        id:       user._id,
        _id:      user._id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        ...(user.phone    && { phone:    user.phone }),
        ...(user.team     && { team:     user.team }),
        ...(user.teamRole && { teamRole: user.teamRole }),
      },
    });

  } catch (err) {
    console.error("🔴 Login error:", err.message);
    return res.status(500).json({
      message: err.message || "Server error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }
});

module.exports = router;