import { useState, useMemo, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { generateAuditPDF } from "../reportPdfAudit";
import { buildTaxAudit } from "../salesMath";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPlain = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TaxedValue = ({ value }) => {
  const tax = value * 0.07;
  const net = value - tax;
  return (
    <span className="ad-taxed-value">
      {fmt(value)}
      <span className="ad-tax-badge">-7% tax: {fmt(tax)}</span>
      <span className="ad-tax-badge net">Net: {fmt(net)}</span>
    </span>
  );
};

const ordinalSuffix = (n) => {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
};

// e.g. "Jul 1st, 2026, Wednesday"
const fullDateLabel = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${month} ${d}${ordinalSuffix(d)}, ${y}, ${weekday}`;
};

const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function TaxAuditDashboard({ reports, onBack }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [auditorEmail, setAuditorEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null); // { type: 'success'|'error', message }

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "auditorEmail"));
        if (!cancelled && snap.exists() && snap.data().email) {
          setAuditorEmail(snap.data().email);
        }
      } catch (err) {
        console.error("Failed to load auditor email:", err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const { dayRows, summary } = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const monthReports = reports.filter((r) => (r.date || "").startsWith(monthPrefix));
    return buildTaxAudit(monthReports, year, month, fullDateLabel);
  }, [reports, year, month]);

  const shiftMonth = (delta) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    if (newMonth > 11) { newMonth = 0; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const handleDownload = () => {
    const pdfDoc = generateAuditPDF({ monthLabel: monthLabel(year, month), dayRows, summary });
    pdfDoc.save(`${monthLabel(year, month)} Audit Report.pdf`);
  };

  const handleSendEmail = async () => {
    setSendResult(null);
    const trimmedEmail = auditorEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setSendResult({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    setSending(true);
    try {
      // Save the email for next time
      try {
        await setDoc(doc(db, "settings", "auditorEmail"), { email: trimmedEmail, updatedAt: new Date() });
      } catch (err) {
        console.error("Failed to save auditor email:", err);
      }

      const label = monthLabel(year, month);
      const pdfDoc = generateAuditPDF({ monthLabel: label, dayRows, summary });
      const pdfBase64 = pdfDoc.output("datauristring").split(",")[1];

      // Send to both the auditor and the owner(s) - not just the auditor alone.
      const recipients = [trimmedEmail, import.meta.env.VITE_OWNER_EMAILS]
        .filter(Boolean)
        .join(",");

      const response = await fetch("/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64,
          reportDate: label,
          ownerEmails: recipients,
          emailBody: `Attached is the monthly audit report for ${label}.`,
          isUpdate: false,
          subjectOverride: `Spice Malabar ${label} - Tax Report`,
          attachmentFilename: `${label} Audit Report.pdf`,
        }),
      });

      if (!response.ok) throw new Error("Backend request failed");
      setSendResult({ type: "success", message: `Audit report for ${label} sent to the auditor (${trimmedEmail}) and the owner(s).` });
    } catch (err) {
      console.error(err);
      setSendResult({ type: "error", message: "Failed to send the report. Please try again." });
    }
    setSending(false);
  };

  return (
    <div className="ad-panel ad-overview-panel">
      <div className="ad-panel-title-row">
        <div className="ad-panel-title">Tax Dashboard — Audit</div>
        <button className="ad-back-btn ad-back-btn-solid" onClick={onBack}>← Back to Dashboard</button>
      </div>

      <div className="ad-week-nav" style={{ marginBottom: "1.25rem" }}>
        <button className="ad-week-arrow" onClick={() => shiftMonth(-1)}>‹</button>
        <span className="ad-week-range" style={{ fontSize: "14px" }}>{monthLabel(year, month)}</span>
        <button className="ad-week-arrow" onClick={() => shiftMonth(1)}>›</button>
      </div>

      <div className="ad-summary-grid" style={{ marginBottom: "1.25rem" }}>
        <div className="ad-summary-card">
          <div className="ad-summary-label">Total Taxable Sale</div>
          <div className="ad-summary-value">{fmt(summary.totalTaxableSale)}</div>
        </div>
        <div className="ad-summary-card">
          <div className="ad-summary-label">Total Tax (7%)</div>
          <div className="ad-summary-value">{fmt(summary.totalTax)}</div>
        </div>
        <div className="ad-summary-card primary">
          <div className="ad-summary-label">Net Sale (Tax Removed)</div>
          <div className="ad-summary-value">{fmt(summary.totalNetSale)}</div>
        </div>
      </div>

      <div className="ad-week-detail-grid" style={{ marginBottom: "1.25rem" }}>
        <div className="ad-week-detail-col">
          <div className="ad-detail-section-label">Cash</div>
          <div className="ad-detail-row"><span>Cash Sale</span><TaxedValue value={summary.cashSale} /></div>
          <div className="ad-detail-row"><span>Cash Tip</span><span>{fmt(summary.cashTip)}</span></div>
          <div className="ad-detail-row bold"><span>Total Cash</span><span>{fmt(summary.totalCashExclCatering)}</span></div>
        </div>
        <div className="ad-week-detail-col">
          <div className="ad-detail-section-label">Credit Card</div>
          <div className="ad-detail-row"><span>Total CC Settle</span><span>{fmt(summary.totalCcSettle)}</span></div>
          <div className="ad-detail-row"><span>CC Tip</span><span>{fmt(summary.creditCardTip)}</span></div>
          <div className="ad-detail-row bold"><span>CC Sale</span><TaxedValue value={summary.creditCardSale} /></div>
        </div>
        <div className="ad-week-detail-col">
          <div className="ad-detail-section-label">Online</div>
          <div className="ad-detail-row"><span>Restaurant Online (Net)</span><TaxedValue value={summary.restaurantOnline} /></div>
          <div className="ad-detail-row"><span>Online Tips</span><span>{fmt(summary.restaurantOnlineTips)}</span></div>
          <div className="ad-detail-row"><span>Grubhub</span><TaxedValue value={summary.grubhub} /></div>
          <div className="ad-detail-row"><span>DoorDash</span><TaxedValue value={summary.doordash} /></div>
          <div className="ad-detail-row"><span>Uber Eats</span><TaxedValue value={summary.uberEats} /></div>
        </div>
        <div className="ad-week-detail-col">
          <div className="ad-detail-section-label">Catering</div>
          <div className="ad-detail-row bold"><span>Catering</span><TaxedValue value={summary.chequesCatering} /></div>
        </div>
      </div>

      <button className="ad-btn" style={{ marginBottom: "1.25rem" }} onClick={handleDownload}>
        ⬇ Download Audit Report PDF
      </button>

      <div className="ad-carry-forward" style={{ marginBottom: "1.25rem" }}>
        <div className="ad-detail-section-label">Send to Auditor</div>
        <div className="ad-carry-forward-row">
          <input
            type="email"
            className="ad-load-input"
            style={{ flex: 1 }}
            placeholder="auditor@example.com"
            value={auditorEmail}
            onChange={(e) => { setAuditorEmail(e.target.value); setSendResult(null); }}
          />
          <button className="ad-download-btn" onClick={handleSendEmail} disabled={sending}>
            {sending ? "Sending..." : "📧 Send Report"}
          </button>
        </div>
        {sendResult && (
          <div className={sendResult.type === "success" ? "ad-settings-success" : "ad-lock-error"} style={{ marginTop: "10px" }}>
            {sendResult.type === "success" ? "✅ " : "⚠️ "}{sendResult.message}
          </div>
        )}
      </div>

      <div className="ad-audit-table-wrap">
        <table className="ad-audit-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Cash Sale</th>
              <th>CC Sale</th>
              <th>Rest. Online</th>
              <th>Grubhub</th>
              <th>DoorDash</th>
              <th>Uber Eats</th>
              <th>Catering</th>
              <th>Net Total</th>
              <th>Tax</th>
              <th>Cash Tip</th>
              <th>Credit Tip</th>
              <th>Online Tip</th>
              <th>Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {dayRows.map((r) => (
              <tr key={r.dateStr} className={r.hasData ? "" : "ad-audit-empty-row"}>
                <td className="ad-audit-day">{r.dayLabel}</td>
                <td>{fmtPlain(r.cashSale)}</td>
                <td>{fmtPlain(r.creditCardSale)}</td>
                <td>{fmtPlain(r.restaurantOnline)}</td>
                <td>{fmtPlain(r.grubhub)}</td>
                <td>{fmtPlain(r.doordash)}</td>
                <td>{fmtPlain(r.uberEats)}</td>
                <td>{fmtPlain(r.chequesCatering)}</td>
                <td>{fmtPlain(r.totalWithoutTip)}</td>
                <td>{fmtPlain(r.tax)}</td>
                <td>{fmtPlain(r.cashTip)}</td>
                <td>{fmtPlain(r.creditCardTip)}</td>
                <td>{fmtPlain(r.restaurantOnlineTips)}</td>
                <td className="ad-audit-total-cell">{fmtPlain(r.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}