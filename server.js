const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");
require("dotenv").config();

const app = express();

connectDB();

app.use(cors());

// express.json() handles application/json requests (REST calls, login, etc.)
app.use(express.json({ limit: "50mb" }));

// ⚠️  DO NOT add express.urlencoded() here.
//     It conflicts with multer on multipart/form-data routes (signup photo upload).
//     Multer parses multipart bodies — including all text fields — on its own.

app.use(express.static(path.join(__dirname, "public")));

const studentRoutes        = require("./routes/studentRoutes");
const authRoutes           = require("./routes/authRoutes");
const resumeRoutes         = require("./routes/resumeRoutes");
const Teamroutes           = require("./routes/Teamroutes");
const Otproutes            = require("./routes/Otproutes");
const eventRoutes          = require("./routes/eventRoutes");
const techRoutes           = require('./routes/techRoutes');
const registrationRoutes   = require('./routes/registrationRoutes');
const Digitalroutes        = require('./routes/Digitalroutes');
const Studentresourceroute = require('./routes/Studentresourceroute');

app.use("/api/students",        studentRoutes);
app.use("/api/auth",            authRoutes);
app.use("/api/resume",          resumeRoutes);
app.use("/api/team",            Teamroutes);
app.use("/api/otp",             Otproutes);
app.use("/api/events",          eventRoutes);
app.use('/api/tech',            techRoutes);
app.use("/api/registrations",   registrationRoutes);
app.use("/api/digital",         Digitalroutes);
app.use("/api/studentresources",Studentresourceroute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});