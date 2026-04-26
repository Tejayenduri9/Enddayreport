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

    // ===== PDF DESIGN (GRID TABLE) =====

    const col1 = 50;
    const col2 = 400;
    const rowHeight = 20;

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

    // Table row with borders
    const drawTableRow = (label, value, isMoney = true, bold = false) => {
      const y = doc.y;

      const displayValue = isMoney
        ? formatMoney(value)
        : `${value || 0}`;

      // Border
      doc.rect(col1, y, 500, rowHeight).stroke();

      // Label
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(11)
        .text(label, col1 + 5, y + 5, {
          width: 250,
          align: "left"
        });

      // Value
      doc.text(displayValue, col2, y + 5, {
        width: 120,
        align: "right"
      });

      doc.moveDown();
    };

    // Section header
    const sectionHeader = (title) => {
      doc.moveDown(1);

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(title);

      doc.moveDown(0.3);
    };

    // ===== DATA =====

    sectionHeader("Cash");
    drawTableRow("Cash Sale", data.cashSale);
    drawTableRow("Cash Tip", data.cashTip);
    drawTableRow("Total Cash w/ Tip", data.totalCashWithTip, true, true);
    drawTableRow("Cash Catering", data.cashCatering);

    sectionHeader("Guests");
    drawTableRow("Lunch Guests", data.lunchGuests, false);
    drawTableRow("Dinner Guests", data.dinnerGuests, false);
    drawTableRow("Dine In Sales", data.dineInSales);

    sectionHeader("Credit Card");
    drawTableRow("Credit Card Sale", data.creditCardSale);

    sectionHeader("Sales Channels");
    drawTableRow("System Gross", data.systemGross);
    drawTableRow("Gift Card", data.giftCard);
    drawTableRow("Total In House", data.totalInHouse);
    drawTableRow("Restaurant Online", data.restaurantOnline);
    drawTableRow("Grubhub", data.grubhub);
    drawTableRow("DoorDash", data.doordash);
    drawTableRow("Uber Eats", data.uberEats);

    sectionHeader("Final Totals");
    drawTableRow("Total Restaurant Sales", data.totalRestaurantSales, true, true);
    drawTableRow("Total Sales of the Day", data.totalSalesDay, true, true);

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