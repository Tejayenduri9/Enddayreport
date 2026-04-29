const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    console.log("🔥 Request received");
    const data = JSON.parse(event.body);
    const reportDate = data.date || new Date().toISOString().split("T")[0];

    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 30, bottom: 30, left: 40, right: 40 }
      });

      const buffers = [];
      doc.on("data", (b) => buffers.push(b));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const pageWidth = doc.page.width;
      const startX = 40;
      const tableWidth = pageWidth - 80;
      const col1Width = Math.floor(tableWidth * 0.6);
      const col2Width = tableWidth - col1Width;
      const rowHeight = 20;
      let y = 80;

      const formatMoney = (v) => `$${Number(v || 0).toFixed(2)}`;

      doc.font("Helvetica-Bold").fontSize(18).text("Spice Malabar Sales Report", 0, 30, { align: "center" });
      doc.font("Helvetica").fontSize(11).text(`Date: ${reportDate}`, 0, 52, { align: "center" });

      const pageHeight = doc.page.height;
      const bottomMargin = 50;

      const drawSection = (title) => {
        if (y + 2 * rowHeight > pageHeight - bottomMargin) { doc.addPage(); y = 40; }
        doc.rect(startX, y, tableWidth, rowHeight).fillAndStroke("#eeeeee", "#000");
        doc.fillColor("#000").font("Helvetica-Bold").fontSize(12)
           .text(title, startX, y + 5, { width: tableWidth, align: "center" });
        y += rowHeight;
      };

      const drawRow = (label, value, isMoney = true, bold = false) => {
        if (y + rowHeight > pageHeight - bottomMargin) { doc.addPage(); y = 40; }
        doc.rect(startX, y, col1Width, rowHeight).stroke();
        doc.rect(startX + col1Width, y, col2Width, rowHeight).stroke();
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(11).fillColor("#000")
           .text(label, startX + 6, y + 5, { width: col1Width - 12 });
        const display = isMoney ? formatMoney(value) : `${value || 0}`;
        doc.text(display, startX + col1Width + 6, y + 5, { width: col2Width - 12, align: "right" });
        y += rowHeight;
      };

      drawSection("Guests");
      drawRow("Lunch Guests", data.lunchGuests, false);
      drawRow("Dinner Guests", data.dinnerGuests, false);
      drawRow("Dine In Sales", data.dineInSales);

      drawSection("Cash");
      drawRow("Cash Sale", data.cashSale);
      drawRow("Cash Tip", data.cashTip);
      drawRow("Cash Catering", data.cashCatering);
      drawRow("Total Cash", data.totalCashWithTip, true, true);

      drawSection("Credit Card");
      drawRow("Total Credit Card Settle", data.totalSettle);
      drawRow("Credit Card Tip", data.creditCardTip);
      drawRow("Credit Card Sale", data.creditCardSale, true, true);

      drawSection("Sales Channels");
      drawRow("System Gross Sale", data.systemGross);
      drawRow("Gift Card Redeemed", data.giftCard);
      drawRow("Total In House", data.totalInHouse, true, true);

      drawSection("Online Sales");
      drawRow("Restaurant Online", data.restaurantOnline);
      drawRow("Grubhub", data.grubhub);
      drawRow("DoorDash", data.doordash);
      drawRow("Uber Eats", data.uberEats);
      drawRow("Total Online Sales", data.totalRestaurantOnline, true, true);

      drawSection("Final Totals");
      drawRow("Total Restaurant Sales", data.totalRestaurantSales, true, true);
      drawRow("Cash Catering", data.cashCatering);
      drawRow("Total Sales of the Day", data.totalSalesDay, true, true);

      const cateringNotes = data.cateringNotes;
      const validCatering = Array.isArray(cateringNotes)
        ? cateringNotes.filter(c => c.name || c.cateringDate || c.paymentType || c.amount)
        : [];

      if (validCatering.length > 0) {
        if (y + 2 * rowHeight > pageHeight - bottomMargin) { doc.addPage(); y = 40; }
        doc.rect(startX, y, tableWidth, rowHeight).fillAndStroke("#eeeeee", "#000");
        doc.fillColor("#000").font("Helvetica-Bold").fontSize(12)
           .text("Catering Notes", startX, y + 5, { width: tableWidth, align: "center" });
        y += rowHeight;

        const cColBase = Math.floor(tableWidth / 4);
        const cCols = [cColBase, cColBase, cColBase, tableWidth - cColBase * 3];
        const cHeaders = ["Catering Date", "Name", "Payment Type", "Amount"];
        const getCX = (i) => startX + cCols.slice(0, i).reduce((a, b) => a + b, 0);

        const drawCateringHeaders = () => {
          if (y + rowHeight > pageHeight - bottomMargin) { doc.addPage(); y = 40; }
          cHeaders.forEach((h, i) => {
            const cx = getCX(i);
            doc.rect(cx, y, cCols[i], rowHeight).fillAndStroke("#d5e8d4", "#000");
            doc.fillColor("#000").font("Helvetica-Bold").fontSize(10)
               .text(h, cx + 4, y + 5, { width: cCols[i] - 8, align: "center" });
          });
          y += rowHeight;
        };

        drawCateringHeaders();
        validCatering.forEach((catering) => {
          if (y + rowHeight > pageHeight - 50) { doc.addPage(); y = 40; drawCateringHeaders(); }
          const cells = [
            catering.cateringDate || "—",
            catering.name || "—",
            catering.paymentType || "—",
            catering.amount ? `$${Number(catering.amount).toFixed(2)}` : "—"
          ];
          cells.forEach((val, i) => {
            const cx = getCX(i);
            doc.rect(cx, y, cCols[i], rowHeight).stroke();
            doc.font("Helvetica").fontSize(10).fillColor("#000")
               .text(val, cx + 4, y + 5, { width: cCols[i] - 8, align: "center" });
          });
          y += rowHeight;
        });
      }

      doc.end();
    });

    const fallbackEmails = process.env.OWNER_EMAILS
      ? process.env.OWNER_EMAILS.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const emails = data.ownerEmails
      ? data.ownerEmails.split(",").map((e) => e.trim()).filter(Boolean)
      : [];
    const allEmails = [...new Set([...emails, ...fallbackEmails])];
    console.log("📧 Sending to:", allEmails);

    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: allEmails.join(", "),
      subject: `Daily Report - ${reportDate}`,
      text: "Attached is your daily sales report.",
      attachments: [{ filename: `${reportDate}_daily_report.pdf`, content: pdfBuffer }]
    });

    console.log("✅ Email sent successfully");
    return { statusCode: 200, body: "Report generated + email sent" };

  } catch (err) {
    console.error("❌ ERROR:", err);
    return { statusCode: 500, body: err.message };
  }
};