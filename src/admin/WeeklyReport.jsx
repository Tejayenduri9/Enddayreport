import { useState, useMemo, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { generateWeeklyPDF } from "../reportPdfWeekly";

const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const shortDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Monday of the week containing `d`
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

export default function WeeklyReport({ reports }) {
  const [weekStart, setWeekStart] = useState(() => toISO(getMonday(new Date())));
  const [carryForward, setCarryForward] = useState("");
  const [savedCarryForward, setSavedCarryForward] = useState(null);
  const [saving, setSaving] = useState(false);

  const weekEnd = useMemo(() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const end = new Date(y, m - 1, d + 6);
    return toISO(end);
  }, [weekStart]);

  const weekReports = useMemo(() => {
    return reports
      .filter((r) => r.date >= weekStart && r.date <= weekEnd)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [reports, weekStart, weekEnd]);

  // Load any previously saved carry-forward value for this week
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCarryForward("");
      setSavedCarryForward(null);
      try {
        const snap = await getDoc(doc(db, "weeklyCarryForward", weekStart));
        if (!cancelled && snap.exists()) {
          setCarryForward(String(snap.data().amount ?? ""));
          setSavedCarryForward(snap.data().amount ?? null);
        }
      } catch (err) {
        console.error("Failed to load carry-forward value:", err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [weekStart]);

  const summary = useMemo(() => {
    const sum = (key) => weekReports.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const cashSale = sum("cashSale");
    const cashTip = sum("cashTip");
    const cashCatering = sum("cashCatering");
    const chequesCatering = sum("chequesCatering");
    const creditCardTip = sum("creditCardTip");
    const creditCardSale = sum("creditCardSale");
    const totalSettle = sum("totalSettle");
    const restaurantOnline = sum("restaurantOnline");
    const grubhub = sum("grubhub");
    const doordash = sum("doordash");
    const uberEats = sum("uberEats");
    const totalOnline = sum("totalRestaurantOnline");
    const totalCatering = sum("totalCatering");
    const totalGuests = sum("lunchGuests") + sum("dinnerGuests");
    const totalSale = sum("totalSalesDay"); // excludes tips, per daily calc
    const totalTips = cashTip + creditCardTip;
    const totalAmountIncTip = totalSale + totalTips;
    const totalCashIncTip = cashSale + cashTip + cashCatering;

    return {
      cashSale, cashTip, cashCatering, chequesCatering, creditCardTip, creditCardSale,
      totalSettle, restaurantOnline, grubhub, doordash, uberEats, totalOnline, totalCatering,
      totalGuests, totalSale, totalTips, totalAmountIncTip, totalCashIncTip,
    };
  }, [weekReports]);

  const handleSaveCarryForward = async () => {
    setSaving(true);
    try {
      const amount = carryForward === "" ? null : Number(carryForward);
      await setDoc(doc(db, "weeklyCarryForward", weekStart), { amount, updatedAt: new Date() });
      setSavedCarryForward(amount);
    } catch (err) {
      console.error("Failed to save carry-forward value:", err);
    }
    setSaving(false);
  };

  const handleDownload = () => {
    const pdfDoc = generateWeeklyPDF({
      weekStart, weekEnd, summary, dailyReports: weekReports,
      carryForward: carryForward === "" ? null : Number(carryForward),
    });
    pdfDoc.save(`Week of ${shortDate(weekStart)} Sales Report.pdf`);
  };

  const shiftWeek = (delta) => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const next = new Date(y, m - 1, d + delta * 7);
    setWeekStart(toISO(next));
  };

  return (
    <div className="ad-panel">
      <div className="ad-panel-title-row">
        <div className="ad-panel-title">Weekly Report</div>
        <div className="ad-week-nav">
          <button className="ad-week-arrow" onClick={() => shiftWeek(-1)}>‹</button>
          <span className="ad-week-range">{shortDate(weekStart)} – {shortDate(weekEnd)}</span>
          <button className="ad-week-arrow" onClick={() => shiftWeek(1)}>›</button>
        </div>
      </div>

      {weekReports.length === 0 ? (
        <div className="ad-empty-state">No daily reports found for this week.</div>
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
            ⬇ Download Weekly PDF
          </button>
        </>
      )}
    </div>
  );
}