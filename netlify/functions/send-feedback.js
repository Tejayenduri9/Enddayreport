import nodemailer from "nodemailer";

const createTransporter = () => nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { feedback, date, ownerEmails } = JSON.parse(event.body);

    const fallbackEmails = process.env.OWNER_EMAILS
      ? process.env.OWNER_EMAILS.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const emails = ownerEmails
      ? ownerEmails.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const allEmails = [...new Set([...emails, ...fallbackEmails])];

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: allEmails.join(", "),
      subject: `Report Feedback - ${date}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #1a3d2b;">📋 Report Feedback</h2>
          <p style="color: #555;">A correction was submitted for the <strong>${date}</strong> daily report:</p>
          <div style="background: #f7f8f7; border-left: 4px solid #1a3d2b; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
            <p style="margin: 0; font-size: 15px; color: #111;">${feedback}</p>
          </div>
          <p style="color: #999; font-size: 12px;">Please review and correct the report if needed.</p>
        </div>
      `,
    });

    return { statusCode: 200, body: "Feedback sent" };
  } catch (err) {
    console.error("❌ Feedback error:", err);
    return { statusCode: 500, body: err.message };
  }
};