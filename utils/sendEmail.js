const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,   // ✅ FIXED
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"ClustrCore" <${process.env.EMAIL_USER}>`, // ✅ FIXED
      to,
      subject,
      html,
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully to:", to);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
};

module.exports = sendEmail;
