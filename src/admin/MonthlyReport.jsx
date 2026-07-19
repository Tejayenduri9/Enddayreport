import { useState, useMemo, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { generateMonthlyPDF } from "../reportPdfWeekly";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`;

const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function MonthlyReport({ reports }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const [carryForward, setCarryForward] = useState("");
  const [savedCarryForward, setSavedCarryForward] = useState(null);
  const [saving, setSaving] = useState(false);

  const key = monthKey(year, month);
  const monthStart = `${key}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${key}-${String(daysInMonth).padStart(2, "0")}`;

  const monthReports = useMemo(() => {
    return reports
      .filter((r) => r.date >= monthStart && r.date <= monthEnd)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [reports, monthStart, monthEnd]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCarryForward("");
      setSavedCarryForward(null);
      try {
        const snap = await getDoc(doc(db, "monthlyCarryForward", key));
        if (!cancelled && snap.exists()) {
          setCarryForward(String(snap.data().amount ?? ""));
          setSavedCarryForward(snap.data().amount ?? null);
        }
      } catch (err) {
        console.error("Failed to load monthly carry-forward value:", err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [key]);

  const summary = useMemo(() => {
    const sum = (k) => monthReports.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const cashSale = sum("cashSale");
    const cashTip = sum("cashTip");
    const creditCardTip = sum("creditCardTip");
    const creditCardSale = sum("creditCardSale");
    const totalSettle = sum("totalSettle");
    const restaurantOnline = sum("restaurantOnline");
    const grubhub = sum("grubhub");
    const doordash = sum("doordash");
    const uberEats = sum("uberEats");
    const totalOnline = sum("totalRestaurantOnline");
    const totalGuests = sum("lunchGuests") + sum("dinnerGuests");
    const totalSale = sum("totalSalesDay");
    const totalTips = cashTip + creditCardTip;
    const totalAmountIncTip = totalSale + totalTips;
    const cashCatering = sum("cashCatering"); // kept for the cash total formula only, not displayed
    const totalCashIncTip = cashSale + cashTip + cashCatering;

    return {
      cashSale, cashTip, creditCardTip, creditCardSale, totalSettle,
      restaurantOnline, grubhub, doordash, uberEats, totalOnline,
      totalGuests, totalSale, totalTips, totalAmountIncTip, totalCashIncTip,
    };
  }, [monthReports]);

  const handleSaveCarryForward = async () => {
    setSaving(true);
    try {
      const amount = carryForward === "" ? null : Number(carryForward);
      await setDoc(doc(db, "monthlyCarryForward", key), { amount, updatedAt: new Date() });
      setSavedCarryForward(amount);
    } catch (err) {
      console.error("Failed to save monthly carry-forward value:", err);
    }
    setSaving(false);
  };

  const handleDownload = () => {
    const pdfDoc = generateMonthlyPDF({
      monthLabel: monthLabel(year, month), summary, dailyReports: monthReports,
      carryForward: carryForward === "" ? null : Number(carryForward),
    });
    pdfDoc.save(`${monthLabel(year, month)} Sales Report.pdf`);
  };

  const shiftMonth = (delta) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    if (newMonth > 11) { newMonth = 0; newYear += 1; }
    setMonth(newMonth);
    setYear(newYear);
  };

  return (
    <div className="ad-panel">
      <div className="ad-panel-title-row">
        <div className="ad-panel-title">Monthly Report</div>
        <div className="ad-week-nav">
          <button className="ad-week-arrow" onClick={() => shiftMonth(-1)}>‹</button>
          <span className="ad-week-range">{monthLabel(year, month)}</span>
          <button className="ad-week-arrow" onClick={() => shiftMonth(1)}>›</button>
        </div>
      </div>

      {monthReports.length === 0 ? (
        <div className="ad-empty-state">No daily reports found for this month.</div>
      ) : (
        <>
          <div className="ad-summary-grid" style={{ marginBottom: "1rem" }}>
            <div className="ad-summary-card primary">
              <div className="ad-summary-label">Total Sale (excl. Tip)</div>
              <div className="ad-summary-value">{fmt(summary.totalSale)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Tips</div>
              <div className="ad-summary-value">{fmt(summary.totalTips)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Amount (incl. Tip)</div>
              <div className="ad-summary-value">{fmt(summary.totalAmountIncTip)}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Guests</div>
              <div className="ad-summary-value">{summary.totalGuests.toLocaleString()}</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Catering</div>
              <div className="ad-summary-value">—</div>
            </div>
            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Online</div>
              <div className="ad-summary-value">{fmt(summary.totalOnline)}</div>
            </div>
          </div>

          <div className="ad-week-detail-grid">
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Cash</div>
              <div className="ad-detail-row"><span>Cash Sale</span><span>{fmt(summary.cashSale)}</span></div>
              <div className="ad-detail-row"><span>Cash Tip</span><span>{fmt(summary.cashTip)}</span></div>
              <div className="ad-detail-row"><span>Cash Catering</span><span>—</span></div>
              <div className="ad-detail-row bold"><span>Total Cash (incl. Tip)</span><span>{fmt(summary.totalCashIncTip)}</span></div>
            </div>
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Credit Card</div>
              <div className="ad-detail-row"><span>Total CC Settle</span><span>{fmt(summary.totalSettle)}</span></div>
              <div className="ad-detail-row"><span>CC Tip</span><span>{fmt(summary.creditCardTip)}</span></div>
              <div className="ad-detail-row bold"><span>CC Sale</span><span>{fmt(summary.creditCardSale)}</span></div>
            </div>
            <div className="ad-week-detail-col">
              <div className="ad-detail-section-label">Online</div>
              <div className="ad-detail-row"><span>Restaurant Online</span><span>{fmt(summary.restaurantOnline)}</span></div>
              <div className="ad-detail-row"><span>Grubhub</span><span>{fmt(summary.grubhub)}</span></div>
              <div className="ad-detail-row"><span>DoorDash</span><span>{fmt(summary.doordash)}</span></div>
              <div className="ad-detail-row"><span>Uber Eats</span><span>{fmt(summary.uberEats)}</span></div>
            </div>
          </div>

          <div className="ad-carry-forward">
            <div className="ad-detail-section-label">Cash Carry Forward <span className="ad-carry-forward-note">(enter manually)</span></div>
            <div className="ad-carry-forward-row">
              <div className="ad-input-money">
                <span>$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={carryForward}
                  onChange={(e) => setCarryForward(e.target.value)}
                />
              </div>
              <button className="ad-download-btn" onClick={handleSaveCarryForward} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            {savedCarryForward !== null && <div className="ad-carry-forward-saved">Saved: {fmt(savedCarryForward)}</div>}
          </div>

          <button className="ad-btn" style={{ marginTop: "1rem" }} onClick={handleDownload}>
            ⬇ Download Monthly PDF
          </button>
        </>
      )}
    </div>
  );
}