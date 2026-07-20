import jsPDF from "jspdf";
import logo from "./assets/logo.png";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const shortDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function buildReportPDF({ title, subtitle, summary, dailyReports, totalLabel }) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const cw = pageWidth - margin * 2;
  let y = 42;

  doc.setFillColor(196, 82, 0);
  doc.rect(0, 0, pageWidth, 36, "F");
  try { doc.addImage(logo, "PNG", pageWidth / 2 - 14, 3, 28, 14); } catch (e) {}
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(title, pageWidth / 2, 23, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  doc.text(subtitle, pageWidth / 2, 31, { align: "center" });

  const secHeader = (label) => {
    doc.setFillColor(26, 61, 43);
    doc.rect(margin, y, cw, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text(label, margin + cw / 2, y + 5, { align: "center" });
    y += 7;
  };

  const row = (label, value, bold = false) => {
    doc.setDrawColor(200, 150, 100);
    doc.setFillColor(bold ? 235 : 255, bold ? 245 : 255, bold ? 235 : 255);
    doc.rect(margin, y, cw, 6, bold ? "FD" : "D");
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8);
    doc.setTextColor(bold ? 26 : 60, bold ? 61 : 60, bold ? 43 : 60);
    doc.text(String(label), margin + 2, y + 4.5);
    doc.text(String(value), margin + cw - 2, y + 4.5, { align: "right" });
    y += 6;
  };

  secHeader("CASH");
  row("Cash Sale", fmt(summary.cashSale));
  row("Cash Tip", fmt(summary.cashTip));
  row("Cash Catering", fmt(summary.cashCatering));
  row("Total Cash (incl. Tip)", fmt(summary.totalCashIncTip), true);
  y += 2;

  secHeader("CREDIT CARD");
  row("Total CC Settle", fmt(summary.totalSettle));
  row("CC Tip", fmt(summary.creditCardTip));
  row("CC Sale", fmt(summary.creditCardSale), true);
  y += 2;

  secHeader("ONLINE SALES");
  row("Restaurant Online", fmt(summary.restaurantOnline));
  row("Grubhub", fmt(summary.grubhub));
  row("DoorDash", fmt(summary.doordash));
  row("Uber Eats", fmt(summary.uberEats));
  row("Total Online", fmt(summary.totalOnline), true);
  y += 2;

  secHeader("CATERING");
  row("Cash Catering", fmt(summary.cashCatering));
  row("Cheques Catering", fmt(summary.chequesCatering));
  row("Total Catering", fmt(summary.totalCatering), true);
  y += 2;

  secHeader("GUESTS");
  row("Total Guests (Lunch + Dinner)", summary.totalGuests);
  y += 2;

  secHeader(totalLabel.sectionTitle);
  row("Total Sale (excl. Tip)", fmt(summary.totalSale), true);
  row("Total Tips (Cash + CC)", fmt(summary.totalTips));
  row("Total Amount (incl. Tip)", fmt(summary.totalAmountIncTip), true);
  y += 4;

  doc.setFillColor(196, 82, 0);
  doc.rect(margin, y, cw, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(totalLabel.bannerTitle, margin + 4, y + 8);
  doc.text(fmt(summary.totalSale), margin + cw - 3, y + 8, { align: "right" });
  y += 18;

  if (dailyReports?.length) {
    if (y > pageHeight - 40) { doc.addPage(); y = 15; }
    secHeader("DAILY BREAKDOWN");
    const colB = Math.floor(cw / 3);
    const cols = [colB, colB, cw - colB * 2];
    let hx = margin;
    ["Date", "Guests", "Total Sales"].forEach((h, i) => {
      doc.setFillColor(255, 235, 200);
      doc.setDrawColor(200, 150, 100);
      doc.rect(hx, y, cols[i], 6, "FD");
      doc.setTextColor(140, 55, 0);
      doc.setFont("helvetica", "bold").setFontSize(7);
      doc.text(h, hx + cols[i] / 2, y + 4.5, { align: "center" });
      hx += cols[i];
    });
    y += 6;
    dailyReports.forEach((r) => {
      if (y > pageHeight - 20) { doc.addPage(); y = 15; }
      const cells = [shortDate(r.date), String((Number(r.lunchGuests) || 0) + (Number(r.dinnerGuests) || 0)), fmt(r.totalSalesDay)];
      let dx = margin;
      cells.forEach((val, i) => {
        doc.setDrawColor(200, 200, 200);
        doc.rect(dx, y, cols[i], 6);
        doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(50, 50, 50);
        doc.text(val, dx + cols[i] / 2, y + 4.5, { align: "center" });
        dx += cols[i];
      });
      y += 6;
    });
  }

  doc.setFillColor(196, 82, 0);
  doc.rect(0, pageHeight - 10, pageWidth, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal").setFontSize(7);
  doc.text(`© ${new Date().getFullYear()} EndDay Reports • enddayreports.com • All Rights Reserved`, pageWidth / 2, pageHeight - 4, { align: "center" });

  return doc;
}

/**
 * Builds a weekly summary PDF from an aggregated `summary` object
 * (see WeeklyReport.jsx for the shape) plus the week's date range and
 * the list of daily reports included.
 */
export function generateWeeklyPDF({ weekStart, weekEnd, summary, dailyReports }) {
  return buildReportPDF({
    title: "WEEKLY SALES REPORT",
    subtitle: `${shortDate(weekStart)} — ${shortDate(weekEnd)}`,
    summary,
    dailyReports,
    totalLabel: { sectionTitle: "WEEKLY TOTALS", bannerTitle: "TOTAL SALE OF THE WEEK" },
  });
}

/**
 * Same layout as generateWeeklyPDF, but for a full calendar month.
 */
export function generateMonthlyPDF({ monthLabel, summary, dailyReports }) {
  return buildReportPDF({
    title: "MONTHLY SALES REPORT",
    subtitle: monthLabel,
    summary,
    dailyReports,
    totalLabel: { sectionTitle: "MONTHLY TOTALS", bannerTitle: "TOTAL SALE OF THE MONTH" },
  });
}

/**
 * Same layout again, for an arbitrary custom date range.
 */
export function generateCustomRangePDF({ rangeStart, rangeEnd, summary, dailyReports }) {
  return buildReportPDF({
    title: "SALES REPORT",
    subtitle: `${shortDate(rangeStart)} — ${shortDate(rangeEnd)}`,
    summary,
    dailyReports,
    totalLabel: { sectionTitle: "RANGE TOTALS", bannerTitle: "TOTAL SALE OF THE RANGE" },
  });
}