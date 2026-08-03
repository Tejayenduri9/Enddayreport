import PostalMime from "postal-mime";

const ALDELO_ENDOFDAY_API = "https://api.aldelo.express/store/Report/RichEmail/EndOfDay";

export default {
  async email(message, env, ctx) {
    // Always forward the original email first, so nothing is ever lost even
    // if the extraction logic below fails for any reason (vendor changes
    // their report format, API is down, etc.) - this Worker only ever adds
    // convenience on top, it never replaces the email itself.
    if (env.FORWARD_TO) {
      try {
        await message.forward(env.FORWARD_TO);
      } catch (err) {
        console.error("Failed to forward original email:", err);
      }
    }

    try {
      const email = await PostalMime.parse(message.raw);
      const ticket = extractTicket(email.html || "") || extractTicket(email.text || "");

      if (!ticket) {
        await recordError(env, "No report ticket found in the email body.");
        return;
      }

      const apiRes = await fetch(ALDELO_ENDOFDAY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Ticket: ticket }),
      });

      if (!apiRes.ok) {
        await recordError(env, `Aldelo report API returned HTTP ${apiRes.status}.`);
        return;
      }

      const data = await apiRes.json();
      const extracted = extractFields(data);

      if (!extracted) {
        await recordError(
          env,
          "Couldn't extract the expected fields from the Aldelo report - the report format may have changed."
        );
        return;
      }

      await env.EMAIL_IMPORTS.put(
        `import:${extracted.date}`,
        JSON.stringify({
          ...extracted,
          importedAt: new Date().toISOString(),
          source: "aldelo",
        })
      );
    } catch (err) {
      console.error("Email processing failed:", err);
      await recordError(env, `Unexpected error: ${err.message || String(err)}`);
    }
  },
};

// Pulls the `ticket` query-string value out of the report link in the email
// body (works whether it's the HTML version or the plain-text fallback).
function extractTicket(content) {
  const match = content.match(/[?&]ticket=([^&"'\s<]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

// Converts a formatted money string like "$2,303.35" or "($941.23)" into a
// plain number. Parenthesized amounts are treated as negative.
function parseMoney(value) {
  if (value === null || value === undefined) return 0;
  const str = String(value);
  const negative = str.includes("(") && str.includes(")");
  const cleaned = str.replace(/[^0-9.]/g, "");
  const num = Number(cleaned) || 0;
  return negative ? -num : num;
}

// Extracts exactly the fields verified against real report data. These are
// the app's true manual-entry fields - Credit Card Sale and System Gross
// Sale are NOT extracted here, since the form already derives both of those
// itself from Total Settle Amount and Credit Card Tip (same as manual entry).
//   - Cash Sale: the day's cash tendered
//   - Total Settle Amount: the report's own combined card settle figure
//     (sale + tip together - the form subtracts tip back out itself)
//   - Credit Card Tip: the combined tips + gratuities figure
//   - Total Guests: informational only, for cross-checking the manual
//     Lunch/Dinner guest split - not written into a single form field
function extractFields(data) {
  try {
    const main = data.mainData;
    const businessDate = main?.SummaryInfo?.BusinessDate;
    if (!businessDate) return null;

    const cashier = main.CashierSummary;
    const gratuity = main.GratuitySummary;
    const stats = main.SalesStatistics;

    const totalSettle = parseMoney(cashier?.CreditDebitCards);
    const creditCardTip = Number(gratuity?.GratuityPayableValue) || 0;
    const totalGuests = Number(stats?.GuestCountValue) || 0;

    // CashTenderedValue is reported as a negative "amount owed out of the
    // drawer" in some sections - the actual cash sale total is the absolute
    // amount tendered by customers that day.
    const cashSale = Math.abs(Number(cashier?.CashTenderedValue) || 0);

    return {
      date: businessDate,
      cashSale,
      totalSettle,
      creditCardTip,
      totalGuests,
    };
  } catch {
    return null;
  }
}

async function recordError(env, message) {
  try {
    await env.EMAIL_IMPORTS.put(`error:${new Date().toISOString()}`, message, {
      expirationTtl: 60 * 60 * 24 * 30, // keep errors visible for 30 days
    });
  } catch (err) {
    console.error("Failed to record error to KV:", err);
  }
}
