const express = require("express");
const { chromium } = require("playwright");
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
  let browser;

  try {
    console.log("🔥 Request received");

    const data = req.body;
    console.log("📦 Data:", data);

    const reportDate =
      data.date || new Date().toISOString().split("T")[0];

    // ✅ Validate emails
    if (!data.ownerEmails) {
      return res.status(400).send("Owner emails are required");
    }

    const emails = data.ownerEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      return res.status(400).send("Valid email required");
    }

    // ✅ Launch browser (Railway-safe)
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();

    // ✅ HTML Template
    const html = `
      <style>
        body { font-family: Arial; padding: 20px; }
        h1 { text-align: center; margin-bottom: 5px; }
        h2 { text-align: center; margin-top: 0; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        td, th { border: 1px solid #000; padding: 8px; font-size: 14px; }
        .section { background: #ddd; font-weight: bold; text-align: center; }
      </style>

      <h1>Spice Malabar Daily Report</h1>
      <h2>Date: ${reportDate}</h2>

      <table>
        <tr class="section"><td colspan="2">Cash</td></tr>
        <tr><td>Cash Sale</td><td>${data.cashSale || 0}</td></tr>
        <tr><td>Cash Tip</td><td>${data.cashTip || 0}</td></tr>
        <tr><td>Total Cash w/ Tip</td><td>${data.totalCashWithTip || 0}</td></tr>
        <tr><td>Cash Catering</td><td>${data.cashCatering || 0}</td></tr>

        <tr class="section"><td colspan="2">Guests</td></tr>
        <tr><td>Lunch Guests</td><td>${data.lunchGuests || 0}</td></tr>
        <tr><td>Dinner Guests</td><td>${data.dinnerGuests || 0}</td></tr>
        <tr><td>Dine In Sales</td><td>${data.dineInSales || 0}</td></tr>

        <tr class="section"><td colspan="2">Credit Card</td></tr>
        <tr><td>Credit Card Sale</td><td>${data.creditCardSale || 0}</td></tr>

        <tr class="section"><td colspan="2">Sales Channels</td></tr>
        <tr><td>System Gross Sale</td><td>${data.systemGross || 0}</td></tr>
        <tr><td>Gift Card Redeemed</td><td>${data.giftCard || 0}</td></tr>
        <tr><td>Total In House</td><td>${data.totalInHouse || 0}</td></tr>
        <tr><td>Restaurant Online</td><td>${data.restaurantOnline || 0}</td></tr>
        <tr><td>Grubhub</td><td>${data.grubhub || 0}</td></tr>
        <tr><td>DoorDash</td><td>${data.doordash || 0}</td></tr>
        <tr><td>Uber Eats</td><td>${data.uberEats || 0}</td></tr>

        <tr class="section"><td colspan="2">Final Totals</td></tr>
        <tr><td>Total Restaurant Sales</td><td><b>${data.totalRestaurantSales || 0}</b></td></tr>
        <tr><td>Total Sales of the Day</td><td><b>${data.totalSalesDay || 0}</b></td></tr>
      </table>
    `;

    await page.setContent(html);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true
    });

    console.log("📄 PDF generated");

    // ✅ Email setup
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
    console.error("❌ ERROR:", err);
    res.status(500).send(err.message);

  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Port (Railway compatible)
const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});