import { useState, useMemo, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { generateCustomRangePDF } from "../reportPdfWeekly";

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

const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CalendarReport({ reports, onSelectReport }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const reportsByDate = useMemo(() => {
    const map = {};
    reports.forEach((r) => { map[r.date] = r; });
    return map;
  }, [reports]);

  // --- Custom range (declared early so calendarCells below can reference it) ---
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [carryForward, setCarryForward] = useState("");
  const [savedCarryForward, setSavedCarryForward] = useState(null);
  const [saving, setSaving] = useState(false);
  const rangeSelected = Boolean(rangeStart && rangeEnd);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(calYear, calMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toISO(new Date(calYear, calMonth, d));
      const inRange = rangeSelected && dateStr >= rangeStart && dateStr <= rangeEnd;
      cells.push({ day: d, dateStr, report: reportsByDate[dateStr] || null, inRange });
    }
    return cells;
  }, [calYear, calMonth, reportsByDate, rangeSelected, rangeStart, rangeEnd]);

  const shiftCalMonth = (delta) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalMonth(m);
    setCalYear(y);
  };

  // Jump the calendar to the month containing the picked range's start date
  useEffect(() => {
    if (rangeStart) {
      const [y, m] = rangeStart.split("-").map(Number);
      setCalYear(y);
      setCalMonth(m - 1);
    }
  }, [rangeStart]);

  const rangeKey = `${rangeStart}_${rangeEnd}`;

  const rangeReports = useMemo(() => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return [];
    return reports
      .filter((r) => r.date >= rangeStart && r.date <= rangeEnd)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [reports, rangeStart, rangeEnd]);

  useEffect(() => {
    let cancelled = false;
    setCarryForward("");
    setSavedCarryForward(null);
    if (!rangeSelected) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "customRangeCarryForward", rangeKey));
        if (!cancelled && snap.exists()) {
          setCarryForward(String(snap.data().amount ?? ""));
          setSavedCarryForward(snap.data().amount ?? null);
        }
      } catch (err) {
        console.error("Failed to load range carry-forward value:", err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [rangeKey, rangeSelected]);

  const summary = useMemo(() => {
    const sum = (k) => rangeReports.reduce((s, r) => s + (Number(r[k]) || 0), 0);
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
    const cashCatering = sum("cashCatering");
    const totalCashIncTip = cashSale + cashTip + cashCatering;

    return {
      cashSale, cashTip, creditCardTip, creditCardSale, totalSettle,
      restaurantOnline, grubhub, doordash, uberEats, totalOnline,
      totalGuests, totalSale, totalTips, totalAmountIncTip, totalCashIncTip,
    };
  }, [rangeReports]);

  const handleSaveCarryForward = async () => {
    setSaving(true);
    try {
      const amount = carryForward === "" ? null : Number(carryForward);
      await setDoc(doc(db, "customRangeCarryForward", rangeKey), { amount, updatedAt: new Date() });
      setSavedCarryForward(amount);
    } catch (err) {
      console.error("Failed to save range carry-forward value:", err);
    }
    setSaving(false);
  };

  const handleDownload = () => {
    const pdfDoc = generateCustomRangePDF({
      rangeStart, rangeEnd, summary, dailyReports: rangeReports,
      carryForward: carryForward === "" ? null : Number(carryForward),
    });
    pdfDoc.save(`${shortDate(rangeStart)} to ${shortDate(rangeEnd)} Sales Report.pdf`);
  };

  const invalidRange = rangeStart && rangeEnd && rangeStart > rangeEnd;

  return (
    <div className="ad-panel">
      <div className="ad-panel-title-row">
        <div className="ad-panel-title">Calendar & Custom Range</div>
        <div className="ad-week-nav">
          <button className="ad-week-arrow" onClick={() => shiftCalMonth(-1)}>‹</button>
          <span className="ad-week-range">{monthLabel(calYear, calMonth)}</span>
          <button className="ad-week-arrow" onClick={() => shiftCalMonth(1)}>›</button>
        </div>
      </div>

      <div className="ad-calendar-grid">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="ad-calendar-weekday">{w}</div>
        ))}
        {calendarCells.map((cell, i) =>
          cell === null ? (
            <div key={`blank-${i}`} className="ad-calendar-cell empty" />
          ) : (
            <div
              key={cell.dateStr}
              className={`ad-calendar-cell${cell.report ? " has-report" : ""}${cell.inRange ? " in-range" : ""}`}
              onClick={() => cell.report && onSelectReport?.(cell.report)}
              title={cell.report ? `Total: ${fmt(cell.report.totalSalesDay)}` : undefined}
            >
              {cell.day}
            </div>
          )
        )}
      </div>

      <div className="ad-settings-divider" style={{ margin: "1.25rem 0" }} />

      <div className="ad-detail-section-label">Custom Range</div>
      <div className="ad-range-picker-row">
        <input type="date" className="ad-load-input" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
        <span className="ad-range-to">to</span>
        <input type="date" className="ad-load-input" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
      </div>

      {!rangeSelected ? (
        <div className="ad-empty-state">Pick a start and end date to generate a report.</div>
      ) : invalidRange ? (
        <div className="ad-error-banner">⚠️ Start date must be before end date.</div>
      ) : rangeReports.length === 0 ? (
        <div className="ad-empty-state">No daily reports found for this range.</div>
      ) : (
        <>
          <div className="ad-summary-grid" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
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
            ⬇ Download Range PDF
          </button>
        </>
      )}
    </div>
  );
}