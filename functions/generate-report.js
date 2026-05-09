import { Resend } from "resend";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { pdfBase64, reportDate, ownerEmails } = await context.request.json();

    const fallbackEmails = context.env.OWNER_EMAILS
      ? context.env.OWNER_EMAILS.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const emails = ownerEmails
      ? ownerEmails.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const allEmails = [...new Set([...emails, ...fallbackEmails])];

    console.log("📧 Sending to:", allEmails);

    const resend = new Resend(context.env.RESEND_API_KEY);
    await resend.emails.send({
      from: context.env.RESEND_FROM || "reports@enddayreports.com",
      to: allEmails,
      subject: `Daily Report - ${reportDate}`,
      text: "Attached is your daily sales report.",
      attachments: [{
        filename: `${reportDate}_daily_report.pdf`,
        content: pdfBase64,
      }]
    });

    console.log("✅ Email sent successfully");
    return new Response("Report sent", { status: 200 });

  } catch (err) {
    console.error("❌ ERROR:", err);
    return new Response(err.message, { status: 500 });
  }
}