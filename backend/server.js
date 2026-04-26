const express = require("express");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend is working!");
});

app.post("/generate-report", async (req, res) => {
  try {
    console.log("🔥 Request received");

    const data = req.body;
    const reportDate =
      data.date || new Date().toISOString().split("T")[0];

    // ✅ Create PDF
    const doc = new PDFDocument({ margin: 30 });
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
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
    });

    // ===== PDF CONTENT =====

    doc.fontSize(18).text("Spice Malabar Daily Report", {
      align: "center"
    });

    doc.moveDown();
    doc.fontSize(12).text(`Date: ${reportDate}`);

    const addSection = (title, rows) => {
      doc.moveDown();
      doc.fontSize(14).text(title, { underline: true });

      rows.forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value || 0}`);
      });
    };

    addSection("Cash", [
      ["Cash Sale", data.cashSale],
      ["Cash Tip", data.cashTip],
      ["Total Cash w/ Tip", data.totalCashWithTip],
      ["Cash Catering", data.cashCatering]
    ]);

    addSection("Guests", [
      ["Lunch Guests", data.lunchGuests],
      ["Dinner Guests", data.dinnerGuests],
      ["Dine In Sales", data.dineInSales]
    ]);

    addSection("Credit Card", [
      ["Credit Card Sale", data.creditCardSale]
    ]);

    addSection("Sales Channels", [
      ["System Gross", data.systemGross],
      ["Gift Card", data.giftCard],
      ["Total In House", data.totalInHouse],
      ["Restaurant Online", data.restaurantOnline],
      ["Grubhub", data.grubhub],
      ["DoorDash", data.doordash],
      ["Uber Eats", data.uberEats]
    ]);

    addSection("Final Totals", [
      ["Total Restaurant Sales", data.totalRestaurantSales],
      ["Total Sales of the Day", data.totalSalesDay]
    ]);

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