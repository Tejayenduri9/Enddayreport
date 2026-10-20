import { Resend } from "resend";
import { requireUser, ownerEmails as configuredOwnerEmails } from "../server/auth.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const user = await requireUser(context);
  if (user instanceof Response) return user;

  try {
    const {
      pdfBase64, reportDate, ownerEmails, emailBody, isUpdate,
      weeklyPdfBase64, weekLabel, // optional: only present when Sunday's report also triggers the weekly summary
      monthlyPdfBase64, monthlyLabel, // optional: only present when the last day of the month is submitted
      auditPdfBase64, // optional: same trigger as monthly - Tax Audit Report for the owner to review before manually sending to the auditor
      subjectOverride, attachmentFilename, // optional: used by non-daily reports (e.g. the Audit report)
    } = await context.request.json();

    // Reports always go to the owners configured on the server (OWNER_EMAILS).
    // Only admins may add other recipients (the Tax Audit report goes to the
    // auditor) - the kiosk can never choose who gets emailed.
    const extraEmails = user.role === "admin" && ownerEmails
      ? ownerEmails.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const allEmails = [...new Set([...extraEmails, ...configuredOwnerEmails(context.env)])];
    if (allEmails.length === 0) {
      return new Response("No recipients configured (set OWNER_EMAILS)", { status: 500 });
    }

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

    if (monthlyPdfBase64) {
      attachments.push({
        filename: `Monthly_Report_${(monthlyLabel || reportDate).replace(/ /g, "_")}.pdf`,
        content: monthlyPdfBase64,
      });
      subject += " + Monthly Summary";
      body += `\n\nSince this closes out the month, your Monthly Sales Report (${monthlyLabel || "this month"}) is also attached.`;
    }

    if (auditPdfBase64) {
      attachments.push({
        filename: `Audit_Report_${(monthlyLabel || reportDate).replace(/ /g, "_")}.pdf`,
        content: auditPdfBase64,
      });
      subject += " + Tax Audit Report";
      body += `\n\nThe Tax Audit Report for ${monthlyLabel || "this month"} is also attached for your review before sending it on to your auditor.`;
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
    return new Response("Failed to send report", { status: 500 });
  }
}