import { Resend } from "resend";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { feedback, date, ownerEmails } = await context.request.json();

    const fallbackEmails = context.env.OWNER_EMAILS
      ? context.env.OWNER_EMAILS.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const emails = ownerEmails
      ? ownerEmails.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const allEmails = [...new Set([...emails, ...fallbackEmails])];

    const resend = new Resend(context.env.RESEND_API_KEY);
    await resend.emails.send({
      from: context.env.RESEND_FROM || "reports@enddayreports.com",
      to: allEmails,
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

    return new Response("Feedback sent", { status: 200 });
  } catch (err) {
    console.error("❌ Feedback error:", err);
    return new Response(err.message, { status: 500 });
  }
}