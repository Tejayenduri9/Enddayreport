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

    // ====== LAYOUT (GRID, CONTROLLED Y) ======
    const pageWidth = doc.page.width;
    const startX = 40;
    const tableWidth = pageWidth - 80; // margins accounted
    const col1Width = Math.floor(tableWidth * 0.6);
    const col2Width = tableWidth - col1Width;
    const rowHeight = 20; // tighter to fit one page

    let y = 80; // start below header

    const formatMoney = (v) => `$${Number(v || 0).toFixed(2)}`;

    // Title
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("Restaurant Daily Report", 0, 30, { align: "center" });

    doc
      .font("Helvetica")
      .fontSize(11)
      .text(`Date: ${reportDate}`, 0, 52, { align: "center" });

    // Ensure we don’t split a section header from its first row
    const ensureSpace = (neededRows = 1) => {
      const needed = neededRows * rowHeight + 10;
      if (y + needed > doc.page.height - 30) {
        doc.addPage();
        y = 40;
      }
    };

    const drawSection = (title) => {
      ensureSpace(2); // header + at least one row

      // header background
      doc
        .rect(startX, y, tableWidth, rowHeight)
        .fillAndStroke("#eeeeee", "#000");

      doc
        .fillColor("#000")
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

      // left cell
      doc.rect(startX, y, col1Width, rowHeight).stroke();

      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(11)
        .fillColor("#000")
        .text(label, startX + 6, y + 5, {
          width: col1Width - 12,
          align: "left"
        });

      // right cell
      doc
        .rect(startX + col1Width, y, col2Width, rowHeight)
        .stroke();

      const display = isMoney ? formatMoney(value) : `${value || 0}`;

      doc.text(display, startX + col1Width + 6, y + 5, {
        width: col2Width - 12,
        align: "right"
      });

      y += rowHeight;
    };

    // ====== DATA ======
    drawSection("Cash");
    drawRow("Cash Sale", data.cashSale);
    drawRow("Cash Tip", data.cashTip);
    drawRow("Total Cash w/ Tip", data.totalCashWithTip, true, true);
    drawRow("Cash Catering", data.cashCatering);

    drawSection("Guests");
    drawRow("Lunch Guests", data.lunchGuests, false);
    drawRow("Dinner Guests", data.dinnerGuests, false);
    drawRow("Dine In Sales", data.dineInSales);

    drawSection("Credit Card");
    drawRow("Credit Card Sale", data.creditCardSale);

    drawSection("Sales Channels");
    drawRow("System Gross Sale", data.systemGross);
    drawRow("Gift Card Redeemed", data.giftCard);
    drawRow("Total In House", data.totalInHouse);
    drawRow("Restaurant Online", data.restaurantOnline);
    drawRow("Grubhub", data.grubhub);
    drawRow("DoorDash", data.doordash);
    drawRow("Uber Eats", data.uberEats);

    drawSection("Final Totals");
    drawRow("Total Restaurant Sales", data.totalRestaurantSales, true, true);
    drawRow("Total Sales of the Day", data.totalSalesDay, true, true);

    // finalize
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