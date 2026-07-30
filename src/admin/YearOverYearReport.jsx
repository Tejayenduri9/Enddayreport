import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { parseCsv } from "./parseCsv";

const fmt = (v) =>
  `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const fmtShort = (v) =>
  `$${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const shiftYears = (dateStr, delta) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toISO(new Date(y + delta, m - 1, d));
};

const shortDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const axisDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const MODE_CHOICES = [
  { key: "day", label: "Day" },
  { key: "7", label: "7 Days" },
  { key: "30", label: "30 Days" },
  { key: "90", label: "90 Days" },
  { key: "custom", label: "Custom" },
];

// Inclusive day count between two ISO date strings (b - a + 1).
const diffDaysInclusive = (aStr, bStr) => {
  const [ay, am, ad] = aStr.split("-").map(Number);
  const [by, bm, bd] = bStr.split("-").map(Number);
  const a = new Date(ay, am - 1, ad);
  const b = new Date(by, bm - 1, bd);
  return Math.round((b - a) / 86400000) + 1;
};

const CHANNEL_FIELDS = [
  { key: "totalInHouse", label: "In-House", color: "#C45200" },
  { key: "totalRestaurantOnline", label: "Online", color: "#F0A202" },
  { key: "totalCatering", label: "Catering", color: "#2F6F62" },
];

const PAYMENT_FIELDS = [
  { key: "cashSale", label: "Cash", color: "#8C3700" },
  { key: "creditCardSale", label: "Credit Card", color: "#C45200" },
];

// Historical (pre-launch) data lives in /public/historical-sales.csv, exported
// from the Standardized Daily Sales Excel template. Field names match the
// Firestore "restaurants" document schema exactly (see ReportDetail.jsx /
// WeeklyReport.jsx) so the two sources merge without any translation.
const HISTORICAL_CSV_PATH = "/historical-sales.csv";

function pctChange(current, prior) {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

function ChangeBadge({ pct, size = "md" }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return <span className={`ad-yoy-badge neutral ${size}`}>n/a</span>;
  }
  const up = pct >= 0;
  return (
    <span className={`ad-yoy-badge ${up ? "up" : "down"} ${size}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function InsightIcon({ kind }) {
  if (kind === "up") return <span className="ad-insight-icon up">▲</span>;
  if (kind === "down") return <span className="ad-insight-icon down">▼</span>;
  return <span className="ad-insight-icon neutral">●</span>;
}

export default function YearOverYearReport({ reports }) {
  const [historical, setHistorical] = useState([]);
  const [loadingCsv, setLoadingCsv] = useState(true);
  const [csvError, setCsvError] = useState("");

  const [rangeEnd, setRangeEnd] = useState(() => toISO(new Date()));
  const [rangeMode, setRangeMode] = useState("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const isCustom = rangeMode === "custom";
  const isDay = rangeMode === "day";
  const customRangeInvalid =
    isCustom && customStart && customEnd && customStart > customEnd;
  const customRangeIncomplete = isCustom && (!customStart || !customEnd);

  const rangeDays = useMemo(() => {
    if (isCustom) {
      if (!customStart || !customEnd || customStart > customEnd) return 0;
      return diffDaysInclusive(customStart, customEnd);
    }
    return isDay ? 1 : Number(rangeMode);
  }, [isCustom, isDay, rangeMode, customStart, customEnd]);

  useEffect(() => {
    let cancelled = false;

    fetch(HISTORICAL_CSV_PATH)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          const parsed = parseCsv(text).map((row) => {
            let cateringNotes = [];
            if (row.cateringNotes) {
              try {
                cateringNotes = JSON.parse(row.cateringNotes);
              } catch {
                cateringNotes = [];
              }
            }
            return { ...row, cateringNotes };
          });
          setHistorical(parsed);
        }
      })
      .catch((err) => {
        console.error("Failed to load historical-sales.csv", err);
        if (!cancelled) {
          setCsvError(
            "Couldn't load historical-sales.csv — make sure it's in /public."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCsv(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // date -> record. Live Firestore reports win over the CSV when a date
  // exists in both.
  const byDate = useMemo(() => {
    const map = new Map();
    for (const row of historical) {
      if (row.date) map.set(row.date, row);
    }
    for (const r of reports) {
      if (r.date) map.set(r.date, r);
    }
    return map;
  }, [historical, reports]);

  const rangeStart = useMemo(() => {
    if (isCustom) return customStart || "";
    const [y, m, d] = rangeEnd.split("-").map(Number);
    return toISO(new Date(y, m - 1, d - (rangeDays - 1)));
  }, [isCustom, customStart, rangeEnd, rangeDays]);

  const displayEnd = isCustom ? customEnd : rangeEnd;
  const rangeSelected = !isCustom || (Boolean(customStart) && Boolean(customEnd) && !customRangeInvalid);

  const priorStart = rangeStart ? shiftYears(rangeStart, -1) : "";
  const priorEnd = displayEnd ? shiftYears(displayEnd, -1) : "";

  const comparisonRows = useMemo(() => {
    const [sy, sm, sd] = rangeStart.split("-").map(Number);
    const rows = [];

    for (let i = 0; i < rangeDays; i++) {
      const currentDate = toISO(new Date(sy, sm - 1, sd + i));
      const priorDate = shiftYears(currentDate, -1);

      rows.push({
        currentDate,
        priorDate,
        current: byDate.get(currentDate) || null,
        prior: byDate.get(priorDate) || null,
      });
    }

    return rows;
  }, [rangeStart, rangeDays, byDate]);

  const missingCurrentCount = comparisonRows.filter((r) => !r.current).length;
  const missingPriorCount = comparisonRows.filter((r) => !r.prior).length;
  const priorHasAnyData = missingPriorCount < rangeDays;

  // ---- Core summary numbers (used by KPI cards + insights) ----
  const summary = useMemo(() => {
    const sumField = (side, field) => {
      let total = 0;
      for (const row of comparisonRows) {
        const rec = row[side];
        if (rec) total += Number(rec[field]) || 0;
      }
      return total;
    };

    const build = (field) => {
      const current = sumField("current", field);
      const prior = sumField("prior", field);
      return { current, prior, pctChange: pctChange(current, prior) };
    };

    const guestTotal = (side) =>
      comparisonRows.reduce((s, r) => {
        const rec = r[side];
        if (!rec) return s;
        return s + (Number(rec.lunchGuests) || 0) + (Number(rec.dinnerGuests) || 0);
      }, 0);

    const curGuests = guestTotal("current");
    const priorGuests = guestTotal("prior");

    return {
      totalSalesDay: build("totalSalesDay"),
      totalInHouse: build("totalInHouse"),
      totalRestaurantOnline: build("totalRestaurantOnline"),
      totalCatering: build("totalCatering"),
      guests: {
        current: curGuests,
        prior: priorGuests,
        pctChange: pctChange(curGuests, priorGuests),
      },
    };
  }, [comparisonRows]);

  // ---- Channel + payment-method breakdown (grouped bar chart) ----
  const channelBreakdown = useMemo(() => {
    const sumField = (side, field) =>
      comparisonRows.reduce((s, r) => {
        const rec = r[side];
        return s + (rec ? Number(rec[field]) || 0 : 0);
      }, 0);

    return [...CHANNEL_FIELDS, ...PAYMENT_FIELDS].map(({ key, label, color }) => {
      const current = sumField("current", key);
      const prior = sumField("prior", key);
      return { key, label, color, current, prior, pctChange: pctChange(current, prior) };
    });
  }, [comparisonRows]);

  const channelChartData = channelBreakdown
    .filter((c) => CHANNEL_FIELDS.some((f) => f.key === c.key))
    .map((c) => ({ label: c.label, current: c.current, prior: c.prior }));

  const paymentChartData = channelBreakdown
    .filter((c) => PAYMENT_FIELDS.some((f) => f.key === c.key))
    .map((c) => ({ label: c.label, current: c.current, prior: c.prior }));

  // ---- Sales mix donuts (only meaningful once both periods have data) ----
  const salesMix = useMemo(() => {
    const build = (side) =>
      CHANNEL_FIELDS.map((c) => ({
        name: c.label,
        value: comparisonRows.reduce((s, r) => {
          const rec = r[side];
          return s + (rec ? Number(rec[c.key]) || 0 : 0);
        }, 0),
        color: c.color,
      })).filter((d) => d.value > 0);

    return { current: build("current"), prior: build("prior") };
  }, [comparisonRows]);

  // ---- Trend data, aligned by relative day within the selected range ----
  const trendData = useMemo(
    () =>
      comparisonRows.map((r) => ({
        label: axisDate(r.currentDate),
        current: r.current ? Number(r.current.totalSalesDay) || 0 : null,
        prior: r.prior ? Number(r.prior.totalSalesDay) || 0 : null,
      })),
    [comparisonRows]
  );

  // ---- Auto-generated insights ----
  const insights = useMemo(() => {
    const list = [];
    const totalSummary = summary.totalSalesDay;

    if (totalSummary.prior > 0) {
      const pct = totalSummary.pctChange;
      const diff = totalSummary.current - totalSummary.prior;
      list.push({
        kind: pct >= 0 ? "up" : "down",
        text: (
          <>
            Total sales are <strong>{pct >= 0 ? "up" : "down"} {Math.abs(pct).toFixed(1)}%</strong>{" "}
            ({diff >= 0 ? "+" : "-"}
            {fmt(Math.abs(diff))}) versus the same {rangeDays}-day period last year.
          </>
        ),
      });
    } else {
      list.push({
        kind: "neutral",
        text: (
          <>
            No matching sales data from last year for this window yet — add more rows to{" "}
            <code>historical-sales.csv</code> to unlock full comparisons.
          </>
        ),
      });
    }

    const channelsWithChange = channelBreakdown.filter(
      (c) => c.prior > 0 && CHANNEL_FIELDS.some((f) => f.key === c.key)
    );
    if (channelsWithChange.length > 0) {
      const best = [...channelsWithChange].sort((a, b) => b.pctChange - a.pctChange)[0];
      const worst = [...channelsWithChange].sort((a, b) => a.pctChange - b.pctChange)[0];

      if (best && best.pctChange > 0) {
        list.push({
          kind: "up",
          text: (
            <>
              <strong>{best.label}</strong> is your fastest-growing channel, up{" "}
              <strong>{best.pctChange.toFixed(1)}%</strong> ({fmt(best.prior)} → {fmt(best.current)}).
            </>
          ),
        });
      }
      if (worst && worst.key !== best?.key && worst.pctChange < 0) {
        list.push({
          kind: "down",
          text: (
            <>
              <strong>{worst.label}</strong> is down{" "}
              <strong>{Math.abs(worst.pctChange).toFixed(1)}%</strong> ({fmt(worst.prior)} → {fmt(worst.current)})
              versus last year.
            </>
          ),
        });
      }
    }

    const daysWithCurrent = comparisonRows.filter((r) => r.current);
    if (daysWithCurrent.length > 0) {
      const bestDay = [...daysWithCurrent].sort(
        (a, b) => (Number(b.current.totalSalesDay) || 0) - (Number(a.current.totalSalesDay) || 0)
      )[0];
      list.push({
        kind: "neutral",
        text: (
          <>
            Best day this period: <strong>{shortDate(bestDay.currentDate)}</strong> at{" "}
            <strong>{fmt(bestDay.current.totalSalesDay)}</strong>.
          </>
        ),
      });
    }

    return list;
  }, [summary, channelBreakdown, comparisonRows, rangeDays]);

  const shiftEnd = (deltaDays) => {
    const [y, m, d] = rangeEnd.split("-").map(Number);
    setRangeEnd(toISO(new Date(y, m - 1, d + deltaDays)));
  };

  return (
    <div className="ad-panel">
      <div className="ad-panel-title-row">
        <div className="ad-panel-title">Year-over-Year Comparison</div>
        {!isCustom && (
          <div className="ad-week-nav">
            <button className="ad-week-arrow" onClick={() => shiftEnd(-rangeDays)}>
              ‹
            </button>
            <span className="ad-week-range">
              {isDay ? shortDate(rangeEnd) : `${shortDate(rangeStart)} – ${shortDate(rangeEnd)}`}
            </span>
            <button className="ad-week-arrow" onClick={() => shiftEnd(rangeDays)}>
              ›
            </button>
          </div>
        )}
      </div>

      <div className="ad-yoy-range-toggle">
        {MODE_CHOICES.map((choice) => (
          <button
            key={choice.key}
            className={`ad-yoy-range-btn${rangeMode === choice.key ? " active" : ""}`}
            onClick={() => setRangeMode(choice.key)}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {/* ---------- Separate section: Day / Custom date pickers ---------- */}
      {isDay && (
        <div className="ad-yoy-picker-section">
          <div className="ad-detail-section-label">Pick a Day</div>
          <div className="ad-range-picker-row">
            <input
              type="date"
              className="ad-load-input"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
            />
          </div>
        </div>
      )}

      {isCustom && (
        <div className="ad-yoy-picker-section">
          <div className="ad-detail-section-label">Custom Range</div>
          <div className="ad-range-picker-row">
            <input
              type="date"
              className="ad-load-input"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="ad-range-to">to</span>
            <input
              type="date"
              className="ad-load-input"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
          {customRangeInvalid && (
            <div className="ad-error-banner" style={{ marginTop: "10px" }}>
              ⚠️ Start date must be before end date.
            </div>
          )}
        </div>
      )}

      {!rangeSelected || customRangeIncomplete ? (
        <div className="ad-empty-state">Pick a start and end date to compare.</div>
      ) : (
        <>
          <div className="ad-yoy-compare-label">
            {isDay
              ? <>vs. {shortDate(priorStart)} (same day last year)</>
              : <>vs. {shortDate(priorStart)} – {shortDate(priorEnd)} (same period last year)</>}
          </div>

          {loadingCsv ? (
        <div className="ad-empty-state">Loading historical data…</div>
      ) : (
        <>
          {csvError && <div className="ad-yoy-warning">{csvError}</div>}

          {/* ---------- KPI HERO ROW ---------- */}
          <div className="ad-summary-grid" style={{ marginBottom: "1.5rem" }}>
            <div className="ad-summary-card primary">
              <div className="ad-summary-label">Total Sales</div>
              <div className="ad-summary-value">{fmt(summary.totalSalesDay.current)}</div>
              <div className="ad-yoy-prior">vs {fmt(summary.totalSalesDay.prior)} last year</div>
              <ChangeBadge pct={summary.totalSalesDay.pctChange} />
            </div>

            <div className="ad-summary-card">
              <div className="ad-summary-label">In-House Sales</div>
              <div className="ad-summary-value">{fmt(summary.totalInHouse.current)}</div>
              <div className="ad-yoy-prior">vs {fmt(summary.totalInHouse.prior)} last year</div>
              <ChangeBadge pct={summary.totalInHouse.pctChange} />
            </div>

            <div className="ad-summary-card">
              <div className="ad-summary-label">Online Sales</div>
              <div className="ad-summary-value">
                {fmt(summary.totalRestaurantOnline.current)}
              </div>
              <div className="ad-yoy-prior">
                vs {fmt(summary.totalRestaurantOnline.prior)} last year
              </div>
              <ChangeBadge pct={summary.totalRestaurantOnline.pctChange} />
            </div>

            <div className="ad-summary-card">
              <div className="ad-summary-label">Catering</div>
              <div className="ad-summary-value">{fmt(summary.totalCatering.current)}</div>
              <div className="ad-yoy-prior">vs {fmt(summary.totalCatering.prior)} last year</div>
              <ChangeBadge pct={summary.totalCatering.pctChange} />
            </div>

            <div className="ad-summary-card">
              <div className="ad-summary-label">Total Guests</div>
              <div className="ad-summary-value">{summary.guests.current.toLocaleString()}</div>
              <div className="ad-yoy-prior">
                vs {summary.guests.prior.toLocaleString()} last year
              </div>
              <ChangeBadge pct={summary.guests.pctChange} />
            </div>
          </div>

          {/* ---------- INSIGHTS ---------- */}
          <div className="ad-insight-box">
            <div className="ad-detail-section-label" style={{ marginBottom: "8px" }}>
              Key Insights
            </div>
            {insights.map((ins, i) => (
              <div className="ad-insight-row" key={i}>
                <InsightIcon kind={ins.kind} />
                <span>{ins.text}</span>
              </div>
            ))}
          </div>

          {(missingCurrentCount > 0 || missingPriorCount > 0) && (
            <div className="ad-yoy-warning">
              {missingCurrentCount > 0 && (
                <>Missing {missingCurrentCount} day(s) of current-period data. </>
              )}
              {missingPriorCount > 0 && (
                <>
                  Missing {missingPriorCount} day(s) of same-period-last-year data — add more
                  rows to historical-sales.csv to fill these in.
                </>
              )}
            </div>
          )}

          {/* ---------- CHANNEL PERFORMANCE (grouped bars) ---------- */}
          <div className="ad-overview-section">
            <div className="ad-panel-title">Where Sales Grew or Shrank, by Channel</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={channelChartData}
                margin={{ top: 24, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f5d5b8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8C3700" }} />
                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fontSize: 11, fill: "#8C3700" }}
                  width={60}
                />
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="prior" fill="#ffc864" name="Last Year" radius={[4, 4, 0, 0]} />
                <Bar dataKey="current" fill="#C45200" name="This Period" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="current"
                    position="top"
                    content={(props) => {
                      const { x, y, width, index } = props;
                      const row = channelChartData[index];
                      const prior = row?.prior || 0;
                      const cur = row?.current || 0;
                      const pct = pctChange(cur, prior);
                      if (pct === null) return null;
                      const up = pct >= 0;
                      return (
                        <text
                          x={x + width / 2}
                          y={y - 8}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill={up ? "#1e7e34" : "#c0392b"}
                        >
                          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ---------- PAYMENT METHOD (grouped bars) + SALES MIX (donuts) ---------- */}
          <div className="ad-yoy-split-grid">
            <div className="ad-overview-section">
              <div className="ad-panel-title">Cash vs. Credit Card</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={paymentChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5d5b8" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8C3700" }} />
                  <YAxis
                    tickFormatter={fmtShort}
                    tick={{ fontSize: 11, fill: "#8C3700" }}
                    width={55}
                  />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="prior" fill="#ffc864" name="Last Year" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="current" fill="#C45200" name="This Period" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="ad-overview-section">
              <div className="ad-panel-title">Sales Mix</div>
              {priorHasAnyData && salesMix.prior.length > 0 ? (
                <div className="ad-yoy-donut-row">
                  <div className="ad-yoy-donut-col">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={salesMix.prior}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {salesMix.prior.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="ad-yoy-donut-label">Last Year</div>
                  </div>
                  <div className="ad-yoy-donut-col">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={salesMix.current}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {salesMix.current.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="ad-yoy-donut-label">This Period</div>
                  </div>
                </div>
              ) : (
                <div className="ad-empty-state">
                  Not enough last-year data yet to show a mix comparison.
                </div>
              )}
              <div className="ad-yoy-legend">
                {CHANNEL_FIELDS.map((c) => (
                  <span key={c.key} className="ad-yoy-legend-item">
                    <span className="ad-yoy-legend-dot" style={{ background: c.color }} />
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- TREND ---------- */}
          <div className="ad-overview-section">
            <div className="ad-panel-title">Daily Sales Trend: This Period vs. Last Year</div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5d5b8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8C3700" }} />
                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fontSize: 11, fill: "#8C3700" }}
                  width={60}
                />
                <Tooltip formatter={(v) => (v == null ? "No data" : fmt(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="current"
                  name="This Period"
                  fill="#C45200"
                  stroke="#C45200"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="prior"
                  name="Last Year"
                  stroke="#8C3700"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 2 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}