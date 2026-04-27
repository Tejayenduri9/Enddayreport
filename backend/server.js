const express = require("express");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Backend is working!");
});

app.post("/generate-report", async (req, res) => {
  try {
    console.log("🔥 Request received");

    const data = req.body;
    const reportDate =
      data.date || new Date().toISOString().split("T")[0];

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 30, bottom: 30, left: 40, right: 40 }
    });

    const buffers = [];
    doc.on("data", (b) => buffers.push(b));

    doc.on("end", async () => {
      try {
        const pdfBuffer = Buffer.concat(buffers);

        console.log("📄 PDF generated");

        const emails = data.ownerEmails
          ? data.ownerEmails.split(",").map((e) => e.trim())
          : [];

        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        console.log("📧 Sending email...");

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: emails,
          subject: `Daily Report - ${reportDate}`,
          text: "Attached is your report",
          attachments: [
            {
              filename: `${reportDate}_daily_report.pdf`,
              content: pdfBuffer
            }
          ]
        });

        console.log("✅ Email sent successfully");
        res.send("Report generated + email sent");

      } catch (err) {
        console.error("❌ EMAIL ERROR:", err);
        res.status(500).send(err.message);
      }
    });

    // ===== LAYOUT =====
    const pageWidth = doc.page.width;
    const startX = 40;
    const tableWidth = pageWidth - 80;
    const col1Width = Math.floor(tableWidth * 0.6);
    const col2Width = tableWidth - col1Width;
    const rowHeight = 20;

    let y = 80;

    const formatMoney = (v) => `$${Number(v || 0).toFixed(2)}`;

    // Title
    doc.font("Helvetica-Bold").fontSize(18).text("Spice Malabar Sales Report", 0, 30, { align: "center" });
    doc.font("Helvetica").fontSize(11).text(`Date: ${reportDate}`, 0, 52, { align: "center" });

    const ensureSpace = (rows = 1) => {
      if (y + rows * rowHeight > doc.page.height - 30) {
        doc.addPage();
        y = 40;
      }
    };

    const drawSection = (title) => {
      ensureSpace(2);

      doc.rect(startX, y, tableWidth, rowHeight)
         .fillAndStroke("#eeeeee", "#000");

      doc.fillColor("#000")
         .font("Helvetica-Bold")
         .fontSize(12)
         .text(title, startX, y + 5, {
           width: tableWidth,
           align: "center"
         });

      y += rowHeight;
    };

    const drawRow = (label, value, isMoney = true, bold = false) => {
      ensureSpace(1);

      doc.rect(startX, y, col1Width, rowHeight).stroke();
      doc.rect(startX + col1Width, y, col2Width, rowHeight).stroke();

      doc.font(bold ? "Helvetica-Bold" : "Helvetica")
         .fontSize(11)
         .text(label, startX + 6, y + 5, {
           width: col1Width - 12
         });

      const display = isMoney ? formatMoney(value) : `${value || 0}`;

      doc.text(display, startX + col1Width + 6, y + 5, {
        width: col2Width - 12,
        align: "right"
      });

      y += rowHeight;
    };

    // ===== DATA =====

    // CASH
    drawSection("Cash");
    drawRow("Cash Sale", data.cashSale);
    drawRow("Cash Tip", data.cashTip);
    drawRow("Total Cash", data.totalCashWithTip, true, true);

    // GUESTS
    drawSection("Guests");
    drawRow("Lunch Guests", data.lunchGuests, false);
    drawRow("Dinner Guests", data.dinnerGuests, false);
    drawRow("Dine In Sales", data.dineInSales);

    // CREDIT CARD (UPDATED)
    drawSection("Credit Card");
    drawRow("Total Credit Card Settle", data.totalSettle);
    drawRow("Credit Card Tip", data.creditCardTip);
    drawRow("Credit Card Sale", data.creditCardSale, true, true);

    // SALES CHANNEL
    drawSection("Sales Channels");
    drawRow("System Gross Sale", data.systemGross);
    drawRow("Gift Card Redeemed", data.giftCard);
    drawRow("Total In House", data.totalInHouse, true, true);

    // ONLINE SALES
    drawSection("Online Sales");
    drawRow("Restaurant Online", data.restaurantOnline);
    drawRow("Grubhub", data.grubhub);
    drawRow("DoorDash", data.doordash);
    drawRow("Uber Eats", data.uberEats);
    drawRow("Total Online Sales", data.totalRestaurantOnline, true, true);

    // FINAL TOTALS (UPDATED)
    drawSection("Final Totals");
    drawRow("Total Restaurant Sales", data.totalRestaurantSales, true, true);
    drawRow("Cash Catering", data.cashCatering);
    drawRow("Total Sales of the Day", data.totalSalesDay, true, true);

    doc.end();

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).send(err.message);
  }
});

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});