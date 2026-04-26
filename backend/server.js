const express = require("express");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Backend is working!");
});

// Main route
app.post("/generate-report", async (req, res) => {
  try {
    console.log("🔥 Request received");

    const data = req.body;
    const reportDate =
      data.date || new Date().toISOString().split("T")[0];

    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));

    doc.on("end", async () => {
      try {
        const pdfBuffer = Buffer.concat(buffers);

        console.log("📄 PDF generated");

        const emails = data.ownerEmails
          ? data.ownerEmails.split(",").map(e => e.trim())
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

    // ===== PDF DESIGN =====

    const startX = 50;
    const valueX = 500;

    const formatMoney = (val) =>
      `$${Number(val || 0).toFixed(2)}`;

    // Title
    doc.fontSize(18).text("Spice Malabar Daily Report", {
      align: "center"
    });

    doc.moveDown(0.5);
    doc.fontSize(12).text(`Date: ${reportDate}`, {
      align: "center"
    });

    doc.moveDown(2);

    // Section Header
    const sectionHeader = (title) => {
      doc.moveDown(1);
      doc.font("Helvetica-Bold").fontSize(14).text(title);

      doc.moveTo(startX, doc.y)
        .lineTo(550, doc.y)
        .stroke();

      doc.moveDown(0.5);
    };

    // Row
    const drawRow = (label, value, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(11)
        .text(label, startX, doc.y, {
          width: 300,
          align: "left"
        });

      doc.text(formatMoney(value), valueX, doc.y - 12, {
        width: 80,
        align: "right"
      });

      doc.moveDown();
    };

    // ===== DATA =====

    sectionHeader("Cash");
    drawRow("Cash Sale", data.cashSale);
    drawRow("Cash Tip", data.cashTip);
    drawRow("Total Cash w/ Tip", data.totalCashWithTip, true);
    drawRow("Cash Catering", data.cashCatering);

    sectionHeader("Guests");
    drawRow("Lunch Guests", data.lunchGuests);
    drawRow("Dinner Guests", data.dinnerGuests);
    drawRow("Dine In Sales", data.dineInSales);

    sectionHeader("Credit Card");
    drawRow("Credit Card Sale", data.creditCardSale);

    sectionHeader("Sales Channels");
    drawRow("System Gross", data.systemGross);
    drawRow("Gift Card", data.giftCard);
    drawRow("Total In House", data.totalInHouse);
    drawRow("Restaurant Online", data.restaurantOnline);
    drawRow("Grubhub", data.grubhub);
    drawRow("DoorDash", data.doordash);
    drawRow("Uber Eats", data.uberEats);

    sectionHeader("Final Totals");
    drawRow("Total Restaurant Sales", data.totalRestaurantSales, true);
    drawRow("Total Sales of the Day", data.totalSalesDay, true);

    // Finalize PDF
    doc.end();

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).send(err.message);
  }
});

// Start server
const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});