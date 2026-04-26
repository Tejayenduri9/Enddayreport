const functions = require("firebase-functions");
const admin = require("firebase-admin");
const puppeteer = require("puppeteer");

admin.initializeApp();

exports.generatePDF = functions.firestore
  .document("restaurants/{id}")
  .onCreate(async (snap) => {
    const data = snap.data();

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    const html = `
      <h1>Restaurant Report</h1>
      <hr/>
      <p><b>Email:</b> ${data.ownerEmail}</p>
      <p><b>Revenue:</b> $${data.revenue}</p>
      <p><b>Orders:</b> ${data.orders}</p>
    `;

    await page.setContent(html);

    // Write to /tmp (only writable dir in Cloud Functions)
    const path = `/tmp/report-${Date.now()}.pdf`;
    await page.pdf({ path, format: "A4" });

    console.log("PDF Generated at:", path);

    await browser.close();
    return null;
  });