import jsPDF from "jspdf";
import logo from "./assets/logo.png";

const OG = {
  primary: [196, 82, 0],
  dark: [140, 55, 0],
  light: [232, 121, 58],
  accent: [255, 200, 100],
  cash: [180, 90, 20],
  cc: [150, 60, 10],
  guests: [100, 70, 30],
  online: [196, 110, 30],
  channels: [160, 80, 10],
};

/**
 * Builds the daily sales report PDF from a form object + catering notes.
 * Used by both the daily-entry form (App.jsx) and the admin dashboard
 * (to regenerate a PDF for a report already saved in Firestore).
 */
export function generatePDF(form, cateringNotes) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const margin = 14;
  const cw = pageWidth - margin * 2;

  doc.setFillColor(...OG.primary);
  doc.rect(0, 0, pageWidth, 36, "F");
  try { doc.addImage(logo, "PNG", pageWidth / 2 - 14, 3, 28, 14); } catch (e) {}
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("DAILY SALES REPORT", pageWidth / 2, 23, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  const [dYear, dMonth, dDay] = form.date.split("-").map(Number);
  const dateText = new Date(dYear, dMonth - 1, dDay).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  doc.text(dateText, pageWidth / 2, 31, { align: "center" });

  let y = 42;

  const col5Base = Math.floor(cw / 5);
  const col5s = [col5Base, col5Base, col5Base, col5Base, cw - col5Base * 4];
  const summaryColors = [[26, 61, 43], [35, 75, 52], [44, 88, 62], [32, 68, 50], [26, 61, 43]];
  const summaryLabels = ["TOTAL SALES", "TOTAL CASH", "IN-HOUSE SALES", "ONLINE ORDERS", "TOTAL CATERING"];
  const summaryValues = [
    fmt(form.totalSalesDay),
    fmt((Number(form.totalCashWithTip) || 0) + (Number(form.cashCatering) || 0)),
    fmt(form.totalInHouse),
    fmt(form.totalRestaurantOnline),
    fmt(form.totalCatering),
  ];
  let sumX = margin;
  summaryColors.forEach(([r, g, b], i) => {
    const sw = col5s[i];
    doc.setFillColor(r, g, b);
    doc.setDrawColor(255, 200, 100);
    doc.rect(sumX, y, sw, 18, "FD");
    doc.setTextColor(...OG.accent);
    doc.setFont("helvetica", "normal").setFontSize(4.8);
    doc.text(summaryLabels[i], sumX + sw / 2, y + 6, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text(summaryValues[i], sumX + sw / 2, y + 14, { align: "center" });
    sumX += sw;
  });
  y += 24;

  const secHeader = (title, color, x, w) => {
    doc.setFillColor(...color);
    doc.rect(x, y, w, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text(title, x + w / 2, y + 5, { align: "center" });
    y += 7;
  };

  const row = (label, value, x, w, bold = false) => {
    doc.setDrawColor(200, 150, 100);
    doc.setFillColor(bold ? 235 : 255, bold ? 245 : 255, bold ? 235 : 255);
    doc.rect(x, y, w, 6, bold ? "FD" : "D");
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8);
    if (bold) { doc.setTextColor(26, 61, 43); } else { doc.setTextColor(60, 60, 60); }
    doc.text(String(label), x + 2, y + 4.5);
    doc.text(String(value), x + w - 2, y + 4.5, { align: "right" });
    y += 6;
  };

  secHeader("GUESTS & DINE-IN", [26, 61, 43], margin, cw);
  const gcb = Math.floor(cw / 3);
  const gcs = [gcb, gcb, cw - gcb * 2];
  doc.setDrawColor(180, 180, 180);
  doc.rect(margin, y, gcs[0], 6, "D");
  doc.rect(margin + gcs[0], y, gcs[1], 6, "D");
  doc.rect(margin + gcs[0] + gcs[1], y, gcs[2], 6, "D");
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(60, 60, 60);
  doc.text(`Lunch: ${form.lunchGuests || 0}`, margin + gcs[0] / 2, y + 4.5, { align: "center" });
  doc.text(`Dinner: ${form.dinnerGuests || 0}`, margin + gcs[0] + gcs[1] / 2, y + 4.5, { align: "center" });
  doc.setFont("helvetica", "bold").setTextColor(26, 61, 43);
  doc.text(`Dine-in: ${fmt(form.dineInSales)}`, margin + gcs[0] + gcs[1] + gcs[2] / 2, y + 4.5, { align: "center" });
  y += 8;

  const hw = cw / 2;
  const rx = margin + hw;
  const hy = y;
  doc.setFillColor(26, 61, 43);
  doc.rect(margin, hy, hw, 7, "F");
  doc.setFillColor(26, 61, 43);
  doc.rect(rx, hy, hw, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("CASH", margin + hw / 2, hy + 5, { align: "center" });
  doc.text("CREDIT CARD", rx + hw / 2, hy + 5, { align: "center" });
  y = hy + 7;

  const cy0 = y;
  row("Cash Sale", fmt(form.cashSale), margin, hw);
  row("Cash Tip", fmt(form.cashTip), margin, hw);
  row("Cash Catering", fmt(form.cashCatering), margin, hw);
  row("Total Cash", fmt((Number(form.totalCashWithTip) || 0) + (Number(form.cashCatering) || 0)), margin, hw, true);
  const cyEnd = y;

  y = cy0;
  row("Total CC Settle", fmt(form.totalSettle), rx, hw);
  row("CC Tip", fmt(form.creditCardTip), rx, hw);
  row("CC Sale", fmt(form.creditCardSale), rx, hw, true);
  if (y < cyEnd) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 150, 100);
    doc.rect(rx, y, hw, cyEnd - y, "FD");
  }
  y = Math.max(cyEnd, y);
  doc.setDrawColor(150, 150, 150);
  doc.rect(margin, hy, cw, y - hy);
  y += 4;

  secHeader("SALES CHANNELS", [26, 61, 43], margin, cw);
  row("System Gross Sale", fmt(form.systemGross), margin, cw);
  row("Gift Card Redeemed", fmt(form.giftCard), margin, cw);
  row("Total In House", fmt(form.totalInHouse), margin, cw, true);
  y += 2;

  secHeader("ONLINE SALES", [26, 61, 43], margin, cw);
  const ocb = Math.floor(cw / 5);
  const ocs = [ocb, ocb, ocb, ocb, cw - ocb * 4];
  const platforms = [
    { label: "Restaurant Online", val: form.restaurantOnline },
    { label: "Online Tips", val: form.restaurantOnlineTips },
    { label: "Grubhub", val: form.grubhub },
    { label: "DoorDash", val: form.doordash },
    { label: "Uber Eats", val: form.uberEats },
  ];
  let ox = margin;
  platforms.forEach((p, i) => {
    const pw = ocs[i];
    doc.setFillColor(240, 248, 240);
    doc.setDrawColor(180, 210, 180);
    doc.rect(ox, y, pw, 14, "FD");
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(60, 80, 60);
    doc.text(p.label, ox + pw / 2, y + 5, { align: "center" });
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(26, 61, 43);
    doc.text(fmt(p.val), ox + pw / 2, y + 11, { align: "center" });
    ox += pw;
  });
  y += 14;
  doc.setFillColor(220, 240, 220);
  doc.setDrawColor(150, 200, 150);
  doc.rect(margin, y, cw, 6, "FD");
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(26, 61, 43);
  doc.text("Total Online Sales", margin + 3, y + 4.5);
  doc.text(fmt(form.totalRestaurantOnline), margin + cw - 2, y + 4.5, { align: "right" });
  y += 8;

  secHeader("FINAL TOTALS", [26, 61, 43], margin, cw);
  row("Total Restaurant Sales", fmt(form.totalRestaurantSales), margin, cw, true);
  row("Cash Catering", fmt(form.cashCatering), margin, cw);
  row("Cheques Catering", fmt(form.chequesCatering), margin, cw);
  const totalTipsAll = (Number(form.restaurantOnlineTips) || 0) + (Number(form.cashTip) || 0) + (Number(form.creditCardTip) || 0);
  row("Tips (Online + Cash + CC)", fmt(totalTipsAll), margin, cw);
  row("Total Catering", fmt(form.totalCatering), margin, cw, true);
  y += 2;

  doc.setFillColor(...OG.primary);
  doc.rect(margin, y, cw, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text("TOTAL SALES OF THE DAY", margin + 4, y + 8);
  const totalSalesInclTip = (Number(form.totalSalesDay) || 0) + totalTipsAll;
  doc.text(fmt(totalSalesInclTip), margin + cw - 3, y + 8, { align: "right" });
  y += 16;

  const validCatering = (cateringNotes || []).filter(c => c.name || c.cateringDate || c.paymentType || c.amount);
  if (validCatering.length > 0) {
    if (y > pageHeight - 40) { doc.addPage(); y = 15; }
    secHeader("CATERING NOTES", [26, 61, 43], margin, cw);
    const ccb = Math.floor(cw / 4);
    const ccs = [ccb, ccb, ccb, cw - ccb * 3];
    const cHeaders = ["Catering Date", "Name", "Payment Type", "Amount"];
    let chx = margin;
    cHeaders.forEach((h, i) => {
      doc.setFillColor(255, 235, 200);
      doc.setDrawColor(200, 150, 100);
      doc.rect(chx, y, ccs[i], 6, "FD");
      doc.setTextColor(...OG.dark);
      doc.setFont("helvetica", "bold").setFontSize(7);
      doc.text(String(h), chx + ccs[i] / 2, y + 4.5, { align: "center" });
      chx += ccs[i];
    });
    y += 6;
    validCatering.forEach((c) => {
      if (y > pageHeight - 20) { doc.addPage(); y = 15; }
      const cells = [c.cateringDate || "—", c.name || "—", c.paymentType || "—", c.amount ? fmt(c.amount) : "—"];
      let cdx = margin;
      cells.forEach((val, i) => {
        doc.setDrawColor(200, 200, 200);
        doc.rect(cdx, y, ccs[i], 6);
        doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(50, 50, 50);
        doc.text(String(val), cdx + ccs[i] / 2, y + 4.5, { align: "center" });
        cdx += ccs[i];
      });
      y += 6;
    });
  }

  doc.setFillColor(...OG.primary);
  doc.rect(0, pageHeight - 10, pageWidth, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal").setFontSize(7);
  const yr = new Date().getFullYear();
  doc.text(`© ${yr} EndDay Reports • enddayreports.com • All Rights Reserved`, pageWidth / 2, pageHeight - 4, { align: "center" });

  return doc;
}