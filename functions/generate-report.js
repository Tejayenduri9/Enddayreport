import { Resend } from "resend";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const {
      pdfBase64, reportDate, ownerEmails, emailBody, isUpdate,
      weeklyPdfBase64, weekLabel, // optional: only present when Sunday's report also triggers the weekly summary
      subjectOverride, attachmentFilename, // optional: used by non-daily reports (e.g. the Audit report)
    } = await context.request.json();

    const fallbackEmails = context.env.OWNER_EMAILS
      ? context.env.OWNER_EMAILS.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const emails = ownerEmails
      ? ownerEmails.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const allEmails = [...new Set([...emails, ...fallbackEmails])];

    console.log("📧 Sending to:", allEmails);

    const attachments = [{
      filename: attachmentFilename || `Daily_Report_${reportDate.replace(/ /g, "_")}.pdf`,
      content: pdfBase64,
    }];

    let subject = subjectOverride || (isUpdate ? `⚠️ UPDATED Report - ${reportDate}` : `Daily Report - ${reportDate}`);
    let body = emailBody || "Attached is your daily sales report.";

    if (weeklyPdfBase64) {
      attachments.push({
        filename: `Weekly_Report_${(weekLabel || reportDate).replace(/ /g, "_")}.pdf`,
        content: weeklyPdfBase64,
      });
      subject += " + Weekly Summary";
      body += `\n\nSince this closes out the week, your Weekly Sales Report (${weekLabel || "this week"}) is also attached.`;
    }

    const resend = new Resend(context.env.RESEND_API_KEY);
    await resend.emails.send({
      from: context.env.RESEND_FROM || "reports@enddayreports.com",
      to: allEmails,
      subject,
      text: body,
      attachments,
    });

    console.log("✅ Email sent successfully");
    return new Response("Report sent", { status: 200 });

  } catch (err) {
    console.error("❌ ERROR:", err);
    return new Response(err.message, { status: 500 });
  }
}