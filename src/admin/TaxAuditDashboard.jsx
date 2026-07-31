import { useState, useMemo, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { generateAuditPDF } from "../reportPdfAudit";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtPlain = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

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

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fullDateLabel = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function TaxAuditDashboard({ reports, onBack }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [auditorEmail, setAuditorEmail] = useState("");
  const [savedAuditorEmail, setSavedAuditorEmail] = useState(false);
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

  const reportsByDate = useMemo(() => {
    const map = {};
    reports.forEach((r) => { map[r.date] = r; });
    return map;
  }, [reports]);

  const dayRows = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toISO(new Date(year, month, d));
      const r = reportsByDate[dateStr];
      const hasData = Boolean(r);
      const cashSale = Number(r?.cashSale) || 0;
      const creditCardSale = Number(r?.creditCardSale) || 0;
      const restaurantOnline = Number(r?.restaurantOnline) || 0;
      const grubhub = Number(r?.grubhub) || 0;
      const doordash = Number(r?.doordash) || 0;
      const uberEats = Number(r?.uberEats) || 0;
      const chequesCatering = Number(r?.chequesCatering) || 0;
      const cashTip = Number(r?.cashTip) || 0;
      const creditCardTip = Number(r?.creditCardTip) || 0;

      const taxableBase = cashSale + creditCardSale + restaurantOnline + grubhub + doordash + uberEats + chequesCatering;
      const tax = taxableBase * 0.07;
      const totalWithoutTip = taxableBase - tax;
      // Sale amounts already include tax, so Grand Total = the recorded total itself (no add/subtract)
      const grandTotal = taxableBase;

      rows.push({
        dayLabel: fullDateLabel(dateStr),
        dateStr,
        hasData,
        cashSale, creditCardSale, restaurantOnline, grubhub, doordash, uberEats,
        chequesCatering, cashTip, creditCardTip, tax, totalWithoutTip, grandTotal,
      });
    }
    return rows;
  }, [reportsByDate, year, month]);

  const summary = useMemo(() => {
    const totalTaxableSale = dayRows.reduce((s, r) => s + r.cashSale + r.creditCardSale + r.restaurantOnline + r.grubhub + r.doordash + r.uberEats + r.chequesCatering, 0);
    const totalTax = dayRows.reduce((s, r) => s + r.tax, 0);
    const totalNetSale = totalTaxableSale - totalTax;

    const cashSale = dayRows.reduce((s, r) => s + r.cashSale, 0);
    const creditCardSale = dayRows.reduce((s, r) => s + r.creditCardSale, 0);
    const restaurantOnline = dayRows.reduce((s, r) => s + r.restaurantOnline, 0);
    const grubhub = dayRows.reduce((s, r) => s + r.grubhub, 0);
    const doordash = dayRows.reduce((s, r) => s + r.doordash, 0);
    const uberEats = dayRows.reduce((s, r) => s + r.uberEats, 0);
    const chequesCatering = dayRows.reduce((s, r) => s + r.chequesCatering, 0);
    const cashTip = dayRows.reduce((s, r) => s + r.cashTip, 0);
    const creditCardTip = dayRows.reduce((s, r) => s + r.creditCardTip, 0);
    const totalOnline = restaurantOnline + grubhub + doordash + uberEats;
    const totalCashExclCatering = cashSale + cashTip; // Cash Catering excluded per audit rules
    const totalCcSettle = creditCardSale + creditCardTip;

    return {
      totalTaxableSale, totalTax, totalNetSale,
      cashSale, creditCardSale, restaurantOnline, grubhub, doordash, uberEats, chequesCatering,
      cashTip, creditCardTip, totalOnline, totalCashExclCatering, totalCcSettle,
    };
  }, [dayRows]);

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
        setSavedAuditorEmail(true);
      } catch (err) {
        console.error("Failed to save auditor email:", err);
      }

      const label = monthLabel(year, month);
      const pdfDoc = generateAuditPDF({ monthLabel: label, dayRows, summary });
      const pdfBase64 = pdfDoc.output("datauristring").split(",")[1];

      const response = await fetch("/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64,
          reportDate: label,
          ownerEmails: trimmedEmail,
          emailBody: `Attached is the monthly audit report for ${label}.`,
          isUpdate: false,
          subjectOverride: `Monthly Audit Report - ${label}`,
          attachmentFilename: `${label} Audit Report.pdf`,
        }),
      });

      if (!response.ok) throw new Error("Backend request failed");
      setSendResult({ type: "success", message: `Audit report for ${label} sent to ${trimmedEmail}.` });
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
        <button className="ad-back-btn" onClick={onBack}>← Back to Dashboard</button>
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
          <div className="ad-detail-row"><span>Restaurant Online</span><TaxedValue value={summary.restaurantOnline} /></div>
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
                <td className="ad-audit-total-cell">{fmtPlain(r.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}