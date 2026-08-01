import jsPDF from "jspdf";
import logo from "./assets/logo.png";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const shortDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const ordinalSuffix = (n) => {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
};

// e.g. "Jul 31st, 2026, Friday" - used for per-day rows in the Daily Breakdown table
const fullDateLabel = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${month} ${d}${ordinalSuffix(d)}, ${y}, ${weekday}`;
};

function buildTaxPDF({ title, subtitle, summary, dailyReports, totalLabel }) {
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
  y += 2;

  secHeader("TAX");
  row("Tax (7%, extracted)", fmt(summary.tax));
  row("Net Sales (Tax Removed)", fmt(summary.totalInclTax), true);
  y += 4;

  doc.setFillColor(196, 82, 0);
  doc.rect(margin, y, cw, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text("NET SALES (TAX REMOVED)", margin + 4, y + 8);
  doc.text(fmt(summary.totalInclTax), margin + cw - 3, y + 8, { align: "right" });
  y += 18;

  if (dailyReports?.length) {
    if (y > pageHeight - 40) { doc.addPage(); y = 15; }
    secHeader("DAILY BREAKDOWN");
    const colDate = Math.floor(cw * 0.42);
    const colGuests = Math.floor(cw * 0.24);
    const cols = [colDate, colGuests, cw - colDate - colGuests];
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
      const cells = [fullDateLabel(r.date), String((Number(r.lunchGuests) || 0) + (Number(r.dinnerGuests) || 0)), fmt(r.totalSalesDay)];
      let dx = margin;
      cells.forEach((val, i) => {
        doc.setDrawColor(200, 200, 200);
        doc.rect(dx, y, cols[i], 6);
        doc.setFont("helvetica", "normal").setFontSize(i === 0 ? 6.5 : 7.5).setTextColor(50, 50, 50);
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

export function generateTaxDailyPDF({ date, summary }) {
  return buildTaxPDF({
    title: "DAILY TAX REPORT",
    subtitle: shortDate(date),
    summary,
    dailyReports: [],
    totalLabel: { sectionTitle: "DAILY TOTALS", bannerTitle: "NET SALES (TAX REMOVED)" },
  });
}

export function generateTaxWeeklyPDF({ weekStart, weekEnd, summary, dailyReports }) {
  return buildTaxPDF({
    title: "WEEKLY TAX REPORT",
    subtitle: `${shortDate(weekStart)} — ${shortDate(weekEnd)}`,
    summary,
    dailyReports,
    totalLabel: { sectionTitle: "WEEKLY TOTALS", bannerTitle: "TOTAL (INCL. TAX)" },
  });
}

export function generateTaxMonthlyPDF({ monthLabel, summary, dailyReports }) {
  return buildTaxPDF({
    title: "MONTHLY TAX REPORT",
    subtitle: monthLabel,
    summary,
    dailyReports,
    totalLabel: { sectionTitle: "MONTHLY TOTALS", bannerTitle: "TOTAL (INCL. TAX)" },
  });
}

export function generateTaxCustomRangePDF({ rangeStart, rangeEnd, summary, dailyReports }) {
  return buildTaxPDF({
    title: "TAX REPORT",
    subtitle: `${shortDate(rangeStart)} — ${shortDate(rangeEnd)}`,
    summary,
    dailyReports,
    totalLabel: { sectionTitle: "RANGE TOTALS", bannerTitle: "TOTAL (INCL. TAX)" },
  });
}