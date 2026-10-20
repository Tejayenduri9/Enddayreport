import { Resend } from "resend";
import { requireUser, ownerEmails, escapeHtml } from "../server/auth.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const user = await requireUser(context);
  if (user instanceof Response) return user;

  try {
    const { feedback, date } = await context.request.json();

    // Feedback only ever goes to the owners configured on the server.
    const allEmails = ownerEmails(context.env);
    if (allEmails.length === 0) {
      return new Response("No recipients configured (set OWNER_EMAILS)", { status: 500 });
    }

    const resend = new Resend(context.env.RESEND_API_KEY);
    await resend.emails.send({
      from: context.env.RESEND_FROM || "reports@enddayreports.com",
      to: allEmails,
      subject: `Report Feedback - ${String(date).slice(0, 10)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #1a3d2b;">📋 Report Feedback</h2>
          <p style="color: #555;">A correction was submitted for the <strong>${escapeHtml(date)}</strong> daily report:</p>
          <div style="background: #f7f8f7; border-left: 4px solid #1a3d2b; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
            <p style="margin: 0; font-size: 15px; color: #111; white-space: pre-wrap;">${escapeHtml(feedback)}</p>
          </div>
          <p style="color: #999; font-size: 12px;">Please review and correct the report if needed.</p>
        </div>
      `,
    });

    return new Response("Feedback sent", { status: 200 });
  } catch (err) {
    console.error("❌ Feedback error:", err);
    return new Response("Failed to send feedback", { status: 500 });
  }
}