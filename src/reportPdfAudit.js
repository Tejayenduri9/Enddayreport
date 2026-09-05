import jsPDF from "jspdf";
import logo from "./assets/logo.png";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtPlain = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const HEADERS = ["Date", "Cash Sale", "CC Sale", "Rest.\nOnline", "Grubhub", "DoorDash", "Uber\nEats", "Catering\n(excl. cash)", "Total\nw/o Tip", "Tax", "Cash Tip", "Credit\nTip", "Online\nTip", "Grand\nTotal"];
const COL_WIDTHS = [46, 36, 36, 36, 32, 32, 32, 40, 38, 32, 32, 32, 32, 40];

/**
 * dayRows: array of { dayLabel, cashSale, creditCardSale, restaurantOnline, grubhub,
 *   doordash, uberEats, chequesCatering, cashTip, creditCardTip, tax, grandTotal, hasData }
 * summary: { totalTaxableSale, totalTax, totalNetSale, cashSale, creditCardSale,
 *   restaurantOnline, grubhub, doordash, uberEats, chequesCatering, cashTip,
 *   creditCardTip, totalCashExclCatering, totalCcSettle }
 */
export function generateAuditPDF({ monthLabel, dayRows, summary }) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const cw = pageWidth - margin * 2;
  const totalColW = COL_WIDTHS.reduce((a, b) => a + b, 0);
  const scale = cw / totalColW;
  const colW = COL_WIDTHS.map((w) => w * scale);
  let y;

  // --- Header ---
  const headerH = 38;
  doc.setFillColor(196, 82, 0);
  doc.rect(0, 0, pageWidth, headerH, "F");

  // compact white card behind the logo, tightly fitted
  const logoCardW = 26, logoCardH = 16;
  const logoCardX = pageWidth / 2 - logoCardW / 2, logoCardY = 4;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(logoCardX, logoCardY, logoCardW, logoCardH, 2, 2, "F");
  try { doc.addImage(logo, "PNG", logoCardX + 2, logoCardY + 2, logoCardW - 4, logoCardH - 4); } catch (e) {}

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text(`MONTHLY AUDIT REPORT - ${monthLabel.toUpperCase()}`, pageWidth / 2, logoCardY + logoCardH + 10, { align: "center" });

  y = headerH + 10;

  // --- Summary strip ---
  const sumLabels = ["Total Taxable Sale", "Total Tax (7%)", "Net Sale (Tax Removed)"];
  const sumValues = [fmt(summary.totalTaxableSale), fmt(summary.totalTax), fmt(summary.totalNetSale)];
  const sumW = cw / 3;
  let sx = margin;
  sumLabels.forEach((label, i) => {
    doc.setFillColor(26, 61, 43);
    doc.setDrawColor(255, 200, 100);
    doc.rect(sx, y, sumW - 4, 20, "FD");
    doc.setTextColor(255, 200, 100);
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(label, sx + (sumW - 4) / 2, y + 7, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text(sumValues[i], sx + (sumW - 4) / 2, y + 15, { align: "center" });
    sx += sumW;
  });
  y += 30;

  // --- Cash / Credit Card / Online / Catering breakdown ---
  const taxOf = (v) => v * 0.07;
  const netOf = (v) => v - taxOf(v);
  const colGap = 4;
  const breakdownColW = (cw - colGap * 3) / 4;
  const bxStart = margin;

  const drawBreakdownCol = (x, title, rows) => {
    let by = y;
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.setTextColor(196, 82, 0);
    doc.text(title, x, by);
    by += 3;
    doc.setDrawColor(230, 200, 170);
    doc.line(x, by, x + breakdownColW - colGap, by);
    by += 5;

    rows.forEach(({ label, value, taxed, bold }) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text(label, x, by);
      doc.text(fmt(value), x + breakdownColW - colGap, by, { align: "right" });
      by += 5;
      if (taxed) {
        doc.setFont("helvetica", "normal").setFontSize(6.5);
        doc.setTextColor(196, 130, 60);
        doc.text(`-7% tax: ${fmt(taxOf(value))}`, x + breakdownColW - colGap, by, { align: "right" });
        by += 3.8;
        doc.setTextColor(60, 130, 70);
        doc.text(`Net: ${fmt(netOf(value))}`, x + breakdownColW - colGap, by, { align: "right" });
        by += 5.5;
      }
    });
    return by;
  };

  const colBottoms = [
    drawBreakdownCol(bxStart, "CASH", [
      { label: "Cash Sale", value: summary.cashSale, taxed: true },
      { label: "Cash Tip", value: summary.cashTip },
      { label: "Total Cash", value: summary.totalCashExclCatering, bold: true },
    ]),
    drawBreakdownCol(bxStart + (breakdownColW + colGap), "CREDIT CARD", [
      { label: "Total CC Settle", value: summary.totalCcSettle },
      { label: "CC Tip", value: summary.creditCardTip },
      { label: "CC Sale", value: summary.creditCardSale, taxed: true, bold: true },
    ]),
    drawBreakdownCol(bxStart + (breakdownColW + colGap) * 2, "ONLINE", [
      { label: "Restaurant Online", value: summary.restaurantOnline, taxed: true },
      { label: "Online Tips", value: summary.restaurantOnlineTips },
      { label: "Grubhub", value: summary.grubhub, taxed: true },
      { label: "DoorDash", value: summary.doordash, taxed: true },
      { label: "Uber Eats", value: summary.uberEats, taxed: true },
    ]),
    drawBreakdownCol(bxStart + (breakdownColW + colGap) * 3, "CATERING", [
      { label: "Catering", value: summary.chequesCatering, taxed: true, bold: true },
    ]),
  ];

  y = Math.max(...colBottoms) + 6;

  const HEADER_H = 12;
  const ROW_H = 9;

  // "Sep 1st, 2026, Tuesday" -> ["Sep 1st, 2026", "Tuesday"] so the Date
  // column can wrap onto two lines instead of overflowing past its border.
  const splitDateLabel = (label) => {
    const idx = label.lastIndexOf(", ");
    if (idx === -1) return [label];
    return [label.slice(0, idx), label.slice(idx + 2)];
  };

  const drawHeaderRow = () => {
    let hx = margin;
    HEADERS.forEach((h, i) => {
      doc.setFillColor(26, 61, 43);
      doc.setDrawColor(150, 150, 150);
      doc.rect(hx, y, colW[i], HEADER_H, "FD");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold").setFontSize(7);
      const lines = h.split("\n");
      if (lines.length === 1) {
        doc.text(lines[0], hx + colW[i] / 2, y + HEADER_H / 2 + 1.5, { align: "center" });
      } else {
        doc.text(lines[0], hx + colW[i] / 2, y + HEADER_H / 2 - 1, { align: "center" });
        doc.text(lines[1], hx + colW[i] / 2, y + HEADER_H / 2 + 4, { align: "center" });
      }
      hx += colW[i];
    });
    y += HEADER_H;
  };

  drawHeaderRow();

  dayRows.forEach((row) => {
    if (y > pageHeight - 25) {
      doc.addPage("landscape");
      y = 15;
      drawHeaderRow();
    }
    const cells = [
      row.dayLabel, fmtPlain(row.cashSale), fmtPlain(row.creditCardSale), fmtPlain(row.restaurantOnline),
      fmtPlain(row.grubhub), fmtPlain(row.doordash), fmtPlain(row.uberEats), fmtPlain(row.chequesCatering),
      fmtPlain(row.totalWithoutTip), fmtPlain(row.tax), fmtPlain(row.cashTip), fmtPlain(row.creditCardTip),
      fmtPlain(row.restaurantOnlineTips), fmtPlain(row.grandTotal),
    ];
    let cx = margin;
    const grey = row.hasData ? 255 : 248;
    cells.forEach((val, i) => {
      doc.setDrawColor(215, 215, 215);
      doc.setFillColor(grey, grey, grey);
      doc.rect(cx, y, colW[i], ROW_H, "FD");
      doc.setFont("helvetica", i === 0 ? "bold" : "normal").setFontSize(7);
      const textGrey = row.hasData ? 40 : 195;
      doc.setTextColor(row.hasData && i === 0 ? 140 : textGrey, row.hasData && i === 0 ? 55 : textGrey, row.hasData && i === 0 ? 0 : textGrey);
      if (i === 0) {
        const lines = splitDateLabel(String(val));
        if (lines.length === 1) {
          doc.text(lines[0], cx + colW[i] / 2, y + ROW_H / 2 + 1.4, { align: "center" });
        } else {
          doc.text(lines[0], cx + colW[i] / 2, y + ROW_H / 2 - 0.8, { align: "center" });
          doc.text(lines[1], cx + colW[i] / 2, y + ROW_H / 2 + 3.4, { align: "center" });
        }
      } else {
        doc.text(String(val), cx + colW[i] / 2, y + ROW_H / 2 + 1.4, { align: "center" });
      }
      cx += colW[i];
    });
    y += ROW_H;
  });

  // Totals row
  if (y > pageHeight - 25) { doc.addPage("landscape"); y = 15; drawHeaderRow(); }
  const t = dayRows.reduce(
    (acc, r) => ({
      cashSale: acc.cashSale + r.cashSale,
      creditCardSale: acc.creditCardSale + r.creditCardSale,
      restaurantOnline: acc.restaurantOnline + r.restaurantOnline,
      grubhub: acc.grubhub + r.grubhub,
      doordash: acc.doordash + r.doordash,
      uberEats: acc.uberEats + r.uberEats,
      chequesCatering: acc.chequesCatering + r.chequesCatering,
      totalWithoutTip: acc.totalWithoutTip + r.totalWithoutTip,
      cashTip: acc.cashTip + r.cashTip,
      creditCardTip: acc.creditCardTip + r.creditCardTip,
      restaurantOnlineTips: acc.restaurantOnlineTips + r.restaurantOnlineTips,
      tax: acc.tax + r.tax,
      grandTotal: acc.grandTotal + r.grandTotal,
    }),
    { cashSale: 0, creditCardSale: 0, restaurantOnline: 0, grubhub: 0, doordash: 0, uberEats: 0, chequesCatering: 0, totalWithoutTip: 0, cashTip: 0, creditCardTip: 0, restaurantOnlineTips: 0, tax: 0, grandTotal: 0 }
  );
  const totalCells = ["TOTAL", fmtPlain(t.cashSale), fmtPlain(t.creditCardSale), fmtPlain(t.restaurantOnline), fmtPlain(t.grubhub), fmtPlain(t.doordash), fmtPlain(t.uberEats), fmtPlain(t.chequesCatering), fmtPlain(t.totalWithoutTip), fmtPlain(t.tax), fmtPlain(t.cashTip), fmtPlain(t.creditCardTip), fmtPlain(t.restaurantOnlineTips), fmtPlain(t.grandTotal)];
  let tx2 = margin;
  totalCells.forEach((val, i) => {
    doc.setDrawColor(200, 150, 100);
    doc.setFillColor(255, 235, 200);
    doc.rect(tx2, y, colW[i], 8, "FD");
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    doc.setTextColor(140, 55, 0);
    doc.text(String(val), tx2 + colW[i] / 2, y + 5.3, { align: "center" });
    tx2 += colW[i];
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(196, 82, 0);
    doc.rect(0, pageHeight - 8, pageWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.text(`© ${new Date().getFullYear()} EndDay Reports • enddayreports.com`, pageWidth / 2, pageHeight - 3, { align: "center" });
  }

  return doc;
}