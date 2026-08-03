import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { db } from "./firebase";
import { collection, addDoc, getDocs, doc as firestoreDoc, updateDoc, query, where } from "firebase/firestore";
import logo from "./assets/logo.png";
import { generateWeeklyPDF, generateMonthlyPDF } from "./reportPdfWeekly";
import { generateAuditPDF } from "./reportPdfAudit";

const emptyCatering = () => ({ cateringDate: "", name: "", paymentType: "", amount: "" });

const getToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const shortDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const WEEKLY_REPORT_TRIGGER_DAY = 0; // Sunday - production

// Business week = Tuesday through Sunday. Given ANY date, find that week's
// Tuesday (start) and Sunday (end) - works no matter which day of the week
// the weekly summary is triggered on, so WEEKLY_REPORT_TRIGGER_DAY above can
// be changed freely without breaking which reports get included.
const getBusinessWeekBounds = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0=Sun,1=Mon,2=Tue,...,6=Sat
  const daysSinceTuesday = (day + 7 - 2) % 7; // Tuesday = day 0 of the business week
  const start = new Date(y, m - 1, d - daysSinceTuesday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 5);
  return { weekStart: toISO(start), weekEnd: toISO(end) };
};

// e.g. "July 2026"
const getMonthLabel = (year, monthIndex) =>
  new Date(year, monthIndex, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Is `dateStr` the last calendar day of its month?
const isLastDayOfMonth = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  return d === daysInMonth;
};

// First day of the month containing `dateStr`, plus the year/month index for convenience.
const getMonthBounds = (dateStr) => {
  const [y, m] = dateStr.split("-").map(Number);
  return {
    year: y,
    monthIndex: m - 1,
    monthStart: toISO(new Date(y, m - 1, 1)),
  };
};


const summarizeWeek = (reports) => {
  const sum = (key) => reports.reduce((s, r) => s + (Number(r[key]) || 0), 0);
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
  const totalSale = sum("totalSalesDay");
  const totalTips = cashTip + creditCardTip;
  const totalAmountIncTip = totalSale + totalTips;
  const totalCashIncTip = cashSale + cashTip + cashCatering;

  return {
    cashSale, cashTip, cashCatering, chequesCatering, creditCardTip, creditCardSale,
    totalSettle, restaurantOnline, grubhub, doordash, uberEats, totalOnline, totalCatering,
    totalGuests, totalSale, totalTips, totalAmountIncTip, totalCashIncTip,
  };
};

const blankForm = () => ({
  date: getToday(),
  ownerEmails: import.meta.env.VITE_OWNER_EMAILS || "",
  lunchGuests: "",
  dinnerGuests: "",
  dineInSales: "",
  cashSale: "",
  cashTip: "",
  cashCatering: "",
  chequesCatering: "",
  totalCatering: "",
  totalSettle: "",
  creditCardTip: "",
  giftCard: "",
  restaurantOnline: "",
  grubhub: "",
  doordash: "",
  uberEats: "",
  totalCashWithTip: "",
  creditCardSale: "",
  systemGross: "",
  totalInHouse: "",
  totalRestaurantOnline: "",
  totalRestaurantSales: "",
  totalSalesDay: "",
});

const OG = {
  primary:  [196, 82,  0],
  dark:     [140, 55,  0],
  light:    [232, 121, 58],
  accent:   [255, 200, 100],
  cash:     [180, 90,  20],
  cc:       [150, 60,  10],
  guests:   [100, 70,  30],
  online:   [196, 110, 30],
  channels: [160, 80,  10],
};

const formatMoney = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const stripFormat = (val) => val.replace(/[^0-9.]/g, "");

function MoneyInput({ name, value, onChange, placeholder = "0.00", required = false }) {
  const [focused, setFocused] = useState(false);
  const rawVal = stripFormat(String(value ?? ""));
  const display = focused ? rawVal : (rawVal ? formatMoney(rawVal) : "");

  const handleInputChange = (evt) => {
    onChange({ target: { name, value: evt.target.value } });
  };

  return (
    <div className="rs-input-money">
      <span>$</span>
      <input
        type={focused ? "number" : "text"}
        name={name}
        value={display}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={handleInputChange}
        inputMode="decimal"
        required={required}
      />
    </div>
  );
}

function App() {
  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  };

  const [form, setForm] = useState(blankForm());
  const [cateringNotes, setCateringNotes] = useState([emptyCatering()]);
  const cateringRequired =
    (Number(form.cashCatering) || 0) > 0 || (Number(form.chequesCatering) || 0) > 0;
  const [notesOpen, setNotesOpen] = useState(false);
  const [modal, setModal] = useState({ open: false, type: "", title: "", message: "" });
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editDocId, setEditDocId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [loadDate, setLoadDate] = useState(getToday());
  const [loadPin, setLoadPin] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadLoading, setLoadLoading] = useState(false);
  const [originalForm, setOriginalForm] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState({});

  // Whenever the report date changes (and this isn't editing an already-
  // saved report), check whether the Aldelo email-import pipeline has
  // values waiting for that date, and fill in only the fields that are
  // still empty - never overwrite something already typed in.
  useEffect(() => {
    if (isEditMode || !form.date) return;
    let cancelled = false;
    (async () => {
      setAutoFilledFields({});
      try {
        const res = await fetch(`/get-email-import?date=${form.date}`);
        const payload = await res.json();
        if (cancelled || !payload.found) return;
        const imported = payload.data;
        const filledKeys = [];
        setForm((prev) => {
          const next = { ...prev };
          if (!prev.cashSale && imported.cashSale) {
            next.cashSale = imported.cashSale;
            filledKeys.push("cashSale");
          }
          if (!prev.totalSettle && imported.totalSettle) {
            next.totalSettle = imported.totalSettle;
            filledKeys.push("totalSettle");
          }
          if (!prev.creditCardTip && imported.creditCardTip) {
            next.creditCardTip = imported.creditCardTip;
            filledKeys.push("creditCardTip");
          }
          return next;
        });
        if (filledKeys.length > 0) {
          setAutoFilledFields(
            filledKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {})
          );
        }
      } catch (err) {
        console.error("Failed to check for auto-imported values:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.date, isEditMode]);
  const [pagePin, setPagePin] = useState("");
  const [pagePinError, setPagePinError] = useState(false);

  // Multi-step gate after the PIN: pick which staff member is submitting,
  // then verify their identity with a TOTP code from their authenticator app.
  const [lockStep, setLockStep] = useState("pin"); // "pin" | "name" | "mfa"
  const [staffOptions, setStaffOptions] = useState([]);
  const [staffLoadError, setStaffLoadError] = useState("");
  const [selectedStaff, setSelectedStaff] = useState(null); // { id, name }
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const handlePageUnlock = async () => {
    const correct = import.meta.env.VITE_PAGE_PIN || "0000";
    if (pagePin !== correct) {
      setPagePinError(true);
      setPagePin("");
      return;
    }
    setPagePinError(false);
    setStaffLoadError("");
    try {
      const snap = await getDocs(query(collection(db, "staff"), where("enrolled", "==", true)));
      const names = snap.docs
        .map((d) => ({ id: d.id, name: d.data().name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (names.length === 0) {
        setStaffLoadError("No enrolled staff found. Ask the owner to add and enroll staff in Manage Staff first.");
      }
      setStaffOptions(names);
      setLockStep("name");
    } catch (err) {
      console.error("Failed to load staff list:", err);
      setStaffLoadError("Couldn't load the staff list. Please try again.");
      setLockStep("name");
    }
  };

  const handleSelectStaff = (staffMember) => {
    setSelectedStaff(staffMember);
    setMfaCode("");
    setMfaError("");
    setLockStep("mfa");
  };

  const handleVerifyMfa = async () => {
    if (!selectedStaff || mfaCode.trim().length < 6) return;
    setMfaVerifying(true);
    setMfaError("");
    try {
      const res = await fetch("/staff-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selectedStaff.id, code: mfaCode.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setUnlocked(true);
      } else if (data.locked) {
        setMfaError("Too many incorrect codes. Wait 15 minutes and try again.");
      } else {
        setMfaError("That code didn't match. Check your authenticator app and try again.");
      }
    } catch (err) {
      console.error("MFA verification failed:", err);
      setMfaError("Couldn't verify the code. Please try again.");
    } finally {
      setMfaVerifying(false);
      setMfaCode("");
    }
  };

  useEffect(() => {
    const handleFocus = () => {
      if (!isEditMode) {
        setForm(prev => ({ ...prev, date: getToday() }));
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isEditMode]);

  const showModal = (type, title, message) => setModal({ open: true, type, title, message });
  const closeModal = () => { setModal({ open: false, type: "", title: "", message: "" }); setFeedback(""); };

  const resetForm = () => {
    setForm(blankForm());
    setCateringNotes([emptyCatering()]);
    setNotesOpen(false);
    setOriginalForm(null);
    setAutoFilledFields({});
  };

  const handleCateringChange = (index, evt) => {
    const updated = [...cateringNotes];
    updated[index] = { ...updated[index], [evt.target.name]: evt.target.value };
    setCateringNotes(updated);
  };

  const addCateringEntry = () => setCateringNotes([...cateringNotes, emptyCatering()]);
  const removeCateringEntry = (index) => {
    if (cateringNotes.length === 1) return;
    setCateringNotes(cateringNotes.filter((_, i) => i !== index));
  };

  const handleChange = (evt) => {
    const updated = { ...form, [evt.target.name]: evt.target.value };
    const cashSale = Number(updated.cashSale) || 0;
    const cashCatering = Number(updated.cashCatering) || 0;
    const chequesCatering = Number(updated.chequesCatering) || 0;
    const totalCatering = cashCatering + chequesCatering;
    const totalCash = Number(updated.totalCashWithTip) || 0;
    const cashTip = totalCash - cashSale;
    const totalSettle = Number(updated.totalSettle) || 0;
    const creditCardTip = Number(updated.creditCardTip) || 0;
    const creditCardSale = totalSettle - creditCardTip;
    const systemGross = cashSale + creditCardSale;
    const giftCard = Number(updated.giftCard) || 0;
    const totalInHouse = systemGross - giftCard;
    const restaurantOnline = Number(updated.restaurantOnline) || 0;
    const grubhub = Number(updated.grubhub) || 0;
    const doordash = Number(updated.doordash) || 0;
    const uberEats = Number(updated.uberEats) || 0;
    const onlineSale = restaurantOnline + grubhub + doordash + uberEats;
    const totalRestaurantSales = totalInHouse + onlineSale;
    const totalSalesDay = totalRestaurantSales + totalCatering;
    updated.cashTip = cashTip >= 0 ? cashTip : 0;
    updated.totalCashWithTip = totalCash;
    updated.creditCardSale = creditCardSale;
    updated.systemGross = systemGross;
    updated.totalInHouse = totalInHouse;
    updated.totalRestaurantOnline = onlineSale;
    updated.totalRestaurantSales = totalRestaurantSales;
    updated.totalCatering = totalCatering;
    updated.totalSalesDay = totalSalesDay;
    setForm(updated);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const fmt = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const margin = 14;
    const cw = pageWidth - margin * 2;

    doc.setFillColor(...OG.primary);
    doc.rect(0, 0, pageWidth, 36, "F");
    try { doc.addImage(logo, "PNG", pageWidth / 2 - 14, 3, 28, 14); } catch(e) {}
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("DAILY SALES REPORT", pageWidth / 2, 23, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    const [dYear, dMonth, dDay] = form.date.split("-").map(Number);
    const dateText = new Date(dYear, dMonth - 1, dDay).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    doc.text(dateText, pageWidth / 2, 31, { align: "center" });

    let y = 42;

    const col5Base = Math.floor(cw / 5);
    const col5s = [col5Base, col5Base, col5Base, col5Base, cw - col5Base * 4];
    const summaryColors = [[26, 61, 43], [35, 75, 52], [44, 88, 62], [32, 68, 50], [26, 61, 43]];
    const summaryLabels = ["TOTAL SALES", "TOTAL CASH", "IN-HOUSE SALES", "ONLINE ORDERS", "TOTAL CATERING"];
    const summaryValues = [
      fmt(form.totalSalesDay),
      fmt((Number(form.totalCashWithTip) || 0) + (Number(form.cashCatering) || 0)),
      fmt(form.totalInHouse),
      fmt(form.totalRestaurantOnline),
      fmt(form.totalCatering),
    ];
    let sumX = margin;
    summaryColors.forEach(([r, g, b], i) => {
      const sw = col5s[i];
      doc.setFillColor(r, g, b);
      doc.setDrawColor(255, 200, 100);
      doc.rect(sumX, y, sw, 18, "FD");
      doc.setTextColor(...OG.accent);
      doc.setFont("helvetica", "normal").setFontSize(4.8);
      doc.text(summaryLabels[i], sumX + sw / 2, y + 6, { align: "center" });
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold").setFontSize(8);
      doc.text(summaryValues[i], sumX + sw / 2, y + 14, { align: "center" });
      sumX += sw;
    });
    y += 24;

    const secHeader = (title, color, x, w) => {
      doc.setFillColor(...color);
      doc.rect(x, y, w, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold").setFontSize(8);
      doc.text(title, x + w / 2, y + 5, { align: "center" });
      y += 7;
    };

    const row = (label, value, x, w, bold = false) => {
      doc.setDrawColor(200, 150, 100);
      doc.setFillColor(bold ? 235 : 255, bold ? 245 : 255, bold ? 235 : 255);
      doc.rect(x, y, w, 6, bold ? "FD" : "D");
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8);
      if (bold) { doc.setTextColor(26, 61, 43); } else { doc.setTextColor(60, 60, 60); }
      doc.text(String(label), x + 2, y + 4.5);
      doc.text(String(value), x + w - 2, y + 4.5, { align: "right" });
      y += 6;
    };

    secHeader("GUESTS & DINE-IN", [26, 61, 43], margin, cw);
    const gcb = Math.floor(cw / 3);
    const gcs = [gcb, gcb, cw - gcb * 2];
    doc.setDrawColor(180, 180, 180);
    doc.rect(margin, y, gcs[0], 6, "D");
    doc.rect(margin + gcs[0], y, gcs[1], 6, "D");
    doc.rect(margin + gcs[0] + gcs[1], y, gcs[2], 6, "D");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(60, 60, 60);
    doc.text(`Lunch: ${form.lunchGuests || 0}`, margin + gcs[0] / 2, y + 4.5, { align: "center" });
    doc.text(`Dinner: ${form.dinnerGuests || 0}`, margin + gcs[0] + gcs[1] / 2, y + 4.5, { align: "center" });
    doc.setFont("helvetica", "bold").setTextColor(26, 61, 43);
    doc.text(`Dine-in: ${fmt(form.dineInSales)}`, margin + gcs[0] + gcs[1] + gcs[2] / 2, y + 4.5, { align: "center" });
    y += 8;

    const hw = cw / 2;
    const rx = margin + hw;
    const hy = y;
    doc.setFillColor(26, 61, 43);
    doc.rect(margin, hy, hw, 7, "F");
    doc.setFillColor(26, 61, 43);
    doc.rect(rx, hy, hw, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("CASH", margin + hw / 2, hy + 5, { align: "center" });
    doc.text("CREDIT CARD", rx + hw / 2, hy + 5, { align: "center" });
    y = hy + 7;

    const cy0 = y;
    row("Cash Sale", fmt(form.cashSale), margin, hw);
    row("Cash Tip", fmt(form.cashTip), margin, hw);
    row("Cash Catering", fmt(form.cashCatering), margin, hw);
    row("Total Cash", fmt((Number(form.totalCashWithTip) || 0) + (Number(form.cashCatering) || 0)), margin, hw, true);
    const cyEnd = y;

    y = cy0;
    row("Total CC Settle", fmt(form.totalSettle), rx, hw);
    row("CC Tip", fmt(form.creditCardTip), rx, hw);
    row("CC Sale", fmt(form.creditCardSale), rx, hw, true);
    if (y < cyEnd) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(200, 150, 100);
      doc.rect(rx, y, hw, cyEnd - y, "FD");
    }
    y = Math.max(cyEnd, y);
    doc.setDrawColor(150, 150, 150);
    doc.rect(margin, hy, cw, y - hy);
    y += 4;

    secHeader("SALES CHANNELS", [26, 61, 43], margin, cw);
    row("System Gross Sale", fmt(form.systemGross), margin, cw);
    row("Gift Card Redeemed", fmt(form.giftCard), margin, cw);
    row("Total In House", fmt(form.totalInHouse), margin, cw, true);
    y += 2;

    secHeader("ONLINE SALES", [26, 61, 43], margin, cw);
    const ocb = Math.floor(cw / 4);
    const ocs = [ocb, ocb, ocb, cw - ocb * 3];
    const platforms = [
      { label: "Restaurant Online", val: form.restaurantOnline },
      { label: "Grubhub", val: form.grubhub },
      { label: "DoorDash", val: form.doordash },
      { label: "Uber Eats", val: form.uberEats },
    ];
    let ox = margin;
    platforms.forEach((p, i) => {
      const pw = ocs[i];
      doc.setFillColor(240, 248, 240);
      doc.setDrawColor(180, 210, 180);
      doc.rect(ox, y, pw, 14, "FD");
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(60, 80, 60);
      doc.text(p.label, ox + pw / 2, y + 5, { align: "center" });
      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(26, 61, 43);
      doc.text(fmt(p.val), ox + pw / 2, y + 11, { align: "center" });
      ox += pw;
    });
    y += 14;
    doc.setFillColor(220, 240, 220);
    doc.setDrawColor(150, 200, 150);
    doc.rect(margin, y, cw, 6, "FD");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(26, 61, 43);
    doc.text("Total Online Sales", margin + 3, y + 4.5);
    doc.text(fmt(form.totalRestaurantOnline), margin + cw - 2, y + 4.5, { align: "right" });
    y += 8;

    secHeader("FINAL TOTALS", [26, 61, 43], margin, cw);
    row("Total Restaurant Sales", fmt(form.totalRestaurantSales), margin, cw, true);
    row("Cash Catering", fmt(form.cashCatering), margin, cw);
    row("Cheques Catering", fmt(form.chequesCatering), margin, cw);
    row("Total Catering", fmt(form.totalCatering), margin, cw, true);
    y += 2;

    doc.setFillColor(...OG.primary);
    doc.rect(margin, y, cw, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(12);
    doc.text("TOTAL SALES OF THE DAY", margin + 4, y + 8);
    doc.text(fmt(form.totalSalesDay), margin + cw - 3, y + 8, { align: "right" });
    y += 16;

    const validCatering = cateringNotes.filter(c => c.name || c.cateringDate || c.paymentType || c.amount);
    if (validCatering.length > 0) {
      if (y > pageHeight - 40) { doc.addPage(); y = 15; }
      secHeader("CATERING NOTES", [26, 61, 43], margin, cw);
      const ccb = Math.floor(cw / 4);
      const ccs = [ccb, ccb, ccb, cw - ccb * 3];
      const cHeaders = ["Catering Date", "Name", "Payment Type", "Amount"];
      let chx = margin;
      cHeaders.forEach((h, i) => {
        doc.setFillColor(255, 235, 200);
        doc.setDrawColor(200, 150, 100);
        doc.rect(chx, y, ccs[i], 6, "FD");
        doc.setTextColor(...OG.dark);
        doc.setFont("helvetica", "bold").setFontSize(7);
        doc.text(String(h), chx + ccs[i] / 2, y + 4.5, { align: "center" });
        chx += ccs[i];
      });
      y += 6;
      validCatering.forEach((c) => {
        if (y > pageHeight - 20) { doc.addPage(); y = 15; }
        const cells = [c.cateringDate || "—", c.name || "—", c.paymentType || "—", c.amount ? fmt(c.amount) : "—"];
        let cdx = margin;
        cells.forEach((val, i) => {
          doc.setDrawColor(200, 200, 200);
          doc.rect(cdx, y, ccs[i], 6);
          doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(50, 50, 50);
          doc.text(String(val), cdx + ccs[i] / 2, y + 4.5, { align: "center" });
          cdx += ccs[i];
        });
        y += 6;
      });
    }

    doc.setFillColor(...OG.primary);
    doc.rect(0, pageHeight - 10, pageWidth, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal").setFontSize(7);
    const yr = new Date().getFullYear();
    doc.text(`© ${yr} EndDay Reports • enddayreports.com • All Rights Reserved`, pageWidth / 2, pageHeight - 4, { align: "center" });

    return doc;
  };

  const loadReport = async () => {
    setLoadError("");
    const correctPin = import.meta.env.VITE_REPORT_PIN || "1234";
    if (loadPin !== correctPin) {
      setLoadError("Incorrect PIN. Please try again.");
      return;
    }
    setLoadLoading(true);
    try {
      const allDocs = await getDocs(collection(db, "restaurants"));
      const matched = allDocs.docs.filter(d => {
        const data = d.data();
        if (data.date && data.date === loadDate) return true;
        if (data.createdAt) {
          const createdDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000);
          const y = createdDate.getFullYear();
          const m = String(createdDate.getMonth() + 1).padStart(2, "0");
          const dd = String(createdDate.getDate()).padStart(2, "0");
          if (`${y}-${m}-${dd}` === loadDate) return true;
        }
        return false;
      });
      if (matched.length === 0) {
        setLoadError("No report found for this date.");
        setLoadLoading(false);
        return;
      }
      matched.sort((a, b) => {
        const aTime = a.data().createdAt?.seconds || 0;
        const bTime = b.data().createdAt?.seconds || 0;
        return bTime - aTime;
      });
      const docData = matched[0];
      const data = docData.data();
      const loadedForm = { ...blankForm(), ...data, date: loadDate };
      setForm(loadedForm);
      setOriginalForm(loadedForm);
      setCateringNotes(data.cateringNotes || [emptyCatering()]);
      setEditDocId(docData.id);
      setIsEditMode(true);
      setLoadModalOpen(false);
      setLoadPin("");
      setLoadDate(getToday());
    } catch (err) {
      setLoadError("Failed to load report. Please try again.");
      console.error(err);
    }
    setLoadLoading(false);
  };

  const saveData = async () => {
    const requiredFields = {
      lunchGuests: "Lunch Guests", dinnerGuests: "Dinner Guests", dineInSales: "Dine-in Sales",
      cashSale: "Cash Sale",
      totalCashWithTip: "Total Cash", totalSettle: "Total Settle Amount", creditCardTip: "Credit Card Tip",
      giftCard: "Gift Card Redeemed", restaurantOnline: "Restaurant Online",
      grubhub: "Grubhub", doordash: "DoorDash", uberEats: "Uber Eats",
    };
    const missing = Object.entries(requiredFields)
      .filter(([key]) => form[key] === "" || form[key] === null || form[key] === undefined)
      .map(([, label]) => label);

    const cateringIssues = [];
    if (cateringRequired) {
      const cateringFieldLabels = {
        cateringDate: "Catering Date", name: "Name", paymentType: "Payment Type", amount: "Amount",
      };
      cateringNotes.forEach((entry, idx) => {
        const missingFields = Object.entries(cateringFieldLabels)
          .filter(([key]) => !entry[key])
          .map(([, label]) => label);
        if (missingFields.length > 0) {
          cateringIssues.push(`Entry ${idx + 1}: ${missingFields.join(", ")}`);
        }
      });
    }

    if (missing.length > 0 || cateringIssues.length > 0) {
      const lines = [...missing, ...cateringIssues];
      showModal("error", "Missing Fields", `Please fill in the following fields:\n\n• ${lines.join("\n• ")}`);
      return;
    }
    setLoading(true);
    try {
      if (isEditMode && editDocId) {
        await updateDoc(firestoreDoc(db, "restaurants", editDocId), {
          ...form, cateringNotes, updatedAt: new Date(),
          submittedByName: selectedStaff?.name || null,
          submittedByStaffId: selectedStaff?.id || null,
        });
      } else {
        await addDoc(collection(db, "restaurants"), {
          ...form, cateringNotes, createdAt: new Date(),
          submittedByName: selectedStaff?.name || null,
          submittedByStaffId: selectedStaff?.id || null,
        });
      }

      const pdfDoc = generatePDF();
      const pdfBase64 = pdfDoc.output("datauristring").split(",")[1];

      // --- If today matches WEEKLY_REPORT_TRIGGER_DAY, also build the weekly (Tue–Sun) summary PDF ---
      let weeklyPdfBase64 = null;
      let weekLabel = null;
      let weeklyError = null;
      const [checkY, checkM, checkD] = form.date.split("-").map(Number);
      const isWeeklyTriggerDay =
        new Date(checkY, checkM - 1, checkD).getDay() === WEEKLY_REPORT_TRIGGER_DAY;

      if (isWeeklyTriggerDay) {
        try {
          const { weekStart, weekEnd } = getBusinessWeekBounds(form.date);
          const allDocsSnap = await getDocs(collection(db, "restaurants"));
          const weekReports = allDocsSnap.docs
            .map((d) => d.data())
            .filter((r) => r.date >= weekStart && r.date <= weekEnd)
            .sort((a, b) => (a.date > b.date ? 1 : -1));

          if (weekReports.length > 0) {
            const weekSummary = summarizeWeek(weekReports);
            const weeklyDoc = generateWeeklyPDF({ weekStart, weekEnd, summary: weekSummary, dailyReports: weekReports });
            weeklyPdfBase64 = weeklyDoc.output("datauristring").split(",")[1];
            weekLabel = `${shortDate(weekStart)} to ${shortDate(weekEnd)}`;
          } else {
            weeklyError = "No reports found for this week, so the weekly summary was skipped.";
          }
        } catch (weeklyErr) {
          // Don't block the daily report from sending, but don't hide the failure either -
          // it gets surfaced in the success/error modal below instead of only console.error.
          console.error("Weekly report generation failed:", weeklyErr);
          weeklyError = `Weekly summary failed to generate (${weeklyErr.message || "unknown error"}).`;
        }
      }

      // --- If today is the last day of the month, also build & send the Monthly Sales
      // Report AND the Tax Audit Report to the owners, both attached alongside the
      // daily/weekly email. Sending to the auditor stays a separate, manual action from
      // the Tax Audit dashboard - the owner reviews the attached audit report first. ---
      let monthlyPdfBase64 = null;
      let monthlyLabel = null;
      let auditPdfBase64 = null;
      let monthlyError = null;
      const isMonthEndDay = isLastDayOfMonth(form.date);

      if (isMonthEndDay) {
        try {
          const { year, monthIndex, monthStart } = getMonthBounds(form.date);
          const monthEnd = form.date; // today IS the last day of the month
          const label = getMonthLabel(year, monthIndex);

          const monthDocsSnap = await getDocs(collection(db, "restaurants"));
          const monthReports = monthDocsSnap.docs
            .map((d) => d.data())
            .filter((r) => r.date >= monthStart && r.date <= monthEnd)
            .sort((a, b) => (a.date > b.date ? 1 : -1));

          if (monthReports.length > 0) {
            // Monthly Sales Report
            const monthSummary = summarizeWeek(monthReports); // same shape works for any date range
            const monthlyDoc = generateMonthlyPDF({ monthLabel: label, summary: monthSummary, dailyReports: monthReports });
            monthlyPdfBase64 = monthlyDoc.output("datauristring").split(",")[1];
            monthlyLabel = label;

            // Tax Audit Report - zero-filled day-by-day, matching the Tax Audit
            // dashboard's own calculation exactly, for the owner to review before
            // manually sending it on to the auditor.
            const reportsByDate = {};
            monthReports.forEach((r) => { reportsByDate[r.date] = r; });
            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
            const dayRows = [];
            for (let d = 1; d <= daysInMonth; d++) {
              const dateStr = toISO(new Date(year, monthIndex, d));
              const r = reportsByDate[dateStr];
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
              dayRows.push({
                dayLabel: shortDate(dateStr), dateStr, hasData: Boolean(r),
                cashSale, creditCardSale, restaurantOnline, grubhub, doordash, uberEats,
                chequesCatering, cashTip, creditCardTip, tax, totalWithoutTip, grandTotal: taxableBase,
              });
            }
            const sum = (key) => dayRows.reduce((s, r) => s + r[key], 0);
            const totalTaxableSale = sum("cashSale") + sum("creditCardSale") + sum("restaurantOnline") + sum("grubhub") + sum("doordash") + sum("uberEats") + sum("chequesCatering");
            const totalTax = sum("tax");
            const auditSummary = {
              totalTaxableSale, totalTax, totalNetSale: totalTaxableSale - totalTax,
              cashSale: sum("cashSale"), creditCardSale: sum("creditCardSale"),
              restaurantOnline: sum("restaurantOnline"), grubhub: sum("grubhub"),
              doordash: sum("doordash"), uberEats: sum("uberEats"), chequesCatering: sum("chequesCatering"),
              cashTip: sum("cashTip"), creditCardTip: sum("creditCardTip"),
              totalCashExclCatering: sum("cashSale") + sum("cashTip"),
              totalCcSettle: sum("creditCardSale") + sum("creditCardTip"),
            };

            const auditDoc = generateAuditPDF({ monthLabel: label, dayRows, summary: auditSummary });
            auditPdfBase64 = auditDoc.output("datauristring").split(",")[1];
          } else {
            monthlyError = "No reports found for this month, so the monthly summary was skipped.";
          }
        } catch (monthlyErr) {
          console.error("Monthly/Audit report generation failed:", monthlyErr);
          monthlyError = `Monthly summary failed to generate (${monthlyErr.message || "unknown error"}).`;
        }
      }

      const [pYear, pMonth, pDay] = form.date.split("-").map(Number);
      const suffix = pDay % 10 === 1 && pDay !== 11 ? "st" : pDay % 10 === 2 && pDay !== 12 ? "nd" : pDay % 10 === 3 && pDay !== 13 ? "rd" : "th";
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const pdfName = `${pDay}${suffix} ${monthNames[pMonth - 1]} ${String(pYear).slice(2)}`;
      let emailBody = "Attached is your daily sales report.";
      if (isEditMode) {
        const fieldLabels = {
          lunchGuests: { label: "Lunch Guests", money: false },
          dinnerGuests: { label: "Dinner Guests", money: false },
          dineInSales: { label: "Dine-in Sales", money: true },
          cashSale: { label: "Cash Sale", money: true },
          cashTip: { label: "Cash Tip", money: true },
          cashCatering: { label: "Cash Catering", money: true },
          chequesCatering: { label: "Cheques Catering", money: true },
          totalCatering: { label: "Total Catering", money: true },
          totalCashWithTip: { label: "Total Cash", money: true },
          totalSettle: { label: "Total CC Settle", money: true },
          creditCardTip: { label: "CC Tip", money: true },
          creditCardSale: { label: "CC Sale", money: true },
          giftCard: { label: "Gift Card Redeemed", money: true },
          restaurantOnline: { label: "Restaurant Online", money: true },
          grubhub: { label: "Grubhub", money: true },
          doordash: { label: "DoorDash", money: true },
          uberEats: { label: "Uber Eats", money: true },
          totalRestaurantOnline: { label: "Total Online Sales", money: true },
          totalInHouse: { label: "Total In House", money: true },
          totalRestaurantSales: { label: "Total Restaurant Sales", money: true },
          totalSalesDay: { label: "Total Sales of the Day", money: true },
        };
        const fmt2 = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
        const changedLines = [];
        if (originalForm) {
          Object.entries(fieldLabels).forEach(([key, { label, money }]) => {
            const oldV = Number(originalForm[key] || 0);
            const newV = Number(form[key] || 0);
            if (oldV !== newV) {
              const fmtVal = (v) => money ? fmt2(v) : String(v);
              changedLines.push(`• ${label}: ${fmtVal(oldV)} → ${fmtVal(newV)}`);
            }
          });
        }
        const changedSummary = changedLines.length > 0 ? changedLines.join("\n") : "No specific field changes detected.";
        emailBody = `⚠️ UPDATED REPORT - ${form.date}\n\nThis report has been edited. Please discard the previous version.\n\nWhat Changed:\n${changedSummary}\n\nThe updated PDF is attached.`;
      }
      const response = await fetch("/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64, reportDate: pdfName, ownerEmails: form.ownerEmails, emailBody, isUpdate: isEditMode,
          weeklyPdfBase64, weekLabel,
          monthlyPdfBase64, monthlyLabel,
          auditPdfBase64,
        }),
      });
      if (!response.ok) throw new Error("Backend request failed");
      resetForm();
      setEditDocId(null);
      setIsEditMode(false);
      setLoading(false);

      let successMessage = isEditMode
        ? "Your report has been updated and the revised PDF has been emailed."
        : "Your daily sales report has been saved and emailed. Did everything look correct? Leave a note below if anything needs attention.";

      if (isWeeklyTriggerDay) {
        if (weeklyPdfBase64) {
          successMessage += "\n\n✅ This closes out the week — the Weekly Sales Report was also generated and emailed.";
        } else if (weeklyError) {
          successMessage += `\n\n⚠️ Note: the Weekly Sales Report was NOT sent — ${weeklyError}`;
        }
      }

      if (isMonthEndDay) {
        if (monthlyPdfBase64) {
          successMessage += "\n\n✅ This closes out the month — the Monthly Sales Report and the Tax Audit Report were also generated and emailed. Review the audit report, then send it to your auditor from the Tax Audit dashboard whenever you're ready.";
        } else if (monthlyError) {
          successMessage += `\n\n⚠️ Note: the Monthly Sales Report and Tax Audit Report were NOT sent — ${monthlyError}`;
        }
      }

      showModal("success", isEditMode ? "Report Updated! ✅" : "Report Sent! 🎉", successMessage);
    } catch (err) {
      setLoading(false);
      console.error(err);
      showModal("error", "Something went wrong", err.message || "An unexpected error occurred. Please check your entries and try again.");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fdf3ec; font-family: 'DM Sans', sans-serif; }
        .rs-wrapper { min-height: 100vh; display: flex; justify-content: center; padding: 2rem 1rem; }
        .rs-card { width: 100%; max-width: 520px; background: #fff; border-radius: 20px; border: 0.5px solid rgba(0,0,0,0.08); overflow: hidden; height: fit-content; }
        .rs-header { background: #C45200; padding: 2rem 2rem 1.5rem; text-align: center; position: relative; }
        .rs-header::after { content: ''; display: block; width: 40px; height: 3px; background: #ffc864; border-radius: 2px; margin: 1rem auto 0; }
        .rs-brand-name { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 600; color: #fff; letter-spacing: 0.5px; }
        .rs-brand-sub { font-size: 11px; letter-spacing: 3px; color: #ffc864; text-transform: uppercase; margin-top: 4px; }
        .rs-date-pill { display: inline-block; margin-top: 1rem; background: rgba(255,255,255,0.15); border: 0.5px solid rgba(255,255,255,0.3); border-radius: 20px; padding: 5px 16px; font-size: 13px; color: rgba(255,255,255,0.9); }
        .rs-body { padding: 1.5rem 1.75rem 2rem; }
        .rs-section { margin-bottom: 1.25rem; }
        .rs-section-label { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #8C3700; margin-bottom: 0.75rem; padding-bottom: 6px; border-bottom: 1px solid #f5d5b8; }
        .rs-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .rs-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
        .rs-field:last-child { margin-bottom: 0; }
        .rs-field label { font-size: 11px; font-weight: 500; color: #666; }
        .rs-autofill-badge { display: inline-block; margin-left: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #1e7e34; background: #e6f4ea; padding: 1px 6px; border-radius: 10px; }
        .rs-required { color: #c0392b; margin-left: 3px; font-weight: 700; }
        .rs-field input { background: #ffffff; border: 0.5px solid #f5c9a0; border-radius: 8px; padding: 9px 12px; font-size: 14px; color: #111; font-family: 'DM Sans', sans-serif; transition: border-color 0.15s, box-shadow 0.15s; outline: none; width: 100%; }
        .rs-input-money { position: relative; display: flex; align-items: center; }
        .rs-input-money span { position: absolute; left: 10px; color: #C45200; font-weight: 600; font-size: 14px; pointer-events: none; z-index: 1; }
        .rs-input-money input { padding-left: 20px !important; }
        .rs-field input:focus { border-color: #C45200; box-shadow: 0 0 0 2px rgba(196,82,0,0.12); }
        .rs-field select { background: #ffffff; border: 0.5px solid #f5c9a0; border-radius: 8px; padding: 9px 12px; font-size: 14px; color: #111; font-family: 'DM Sans', sans-serif; outline: none; width: 100%; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
        .rs-field select:focus { border-color: #C45200; box-shadow: 0 0 0 2px rgba(196,82,0,0.12); }
        .rs-btn { width: 100%; padding: 14px; background: #C45200; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; letter-spacing: 0.5px; margin-top: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity 0.15s; }
        .rs-btn:hover { opacity: 0.88; }
        .rs-btn:disabled { opacity: 0.75; cursor: not-allowed; }
        .rs-notes-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; background: #fff8f4; border: 0.5px solid #f5c9a0; border-radius: 10px; padding: 12px 16px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; color: #333; letter-spacing: 0.5px; transition: background 0.15s; outline: none; }
        .rs-notes-toggle:hover { background: #fdeede; }
        .rs-notes-arrow { transition: transform 0.25s ease; display: flex; align-items: center; }
        .rs-notes-arrow.open { transform: rotate(180deg); }
        .rs-notes-body { overflow: hidden; max-height: 0; transition: max-height 0.4s ease, opacity 0.25s ease; opacity: 0; pointer-events: none; }
        .rs-notes-body.open { max-height: 2000px; opacity: 1; pointer-events: all; }
        .rs-notes-inner { padding-top: 14px; display: flex; flex-direction: column; gap: 10px; }
        .rs-catering-entry { border: 0.5px solid #f5c9a0; border-radius: 10px; padding: 14px; position: relative; }
        .rs-entry-label { font-size: 10px; font-weight: 700; color: #C45200; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px; }
        .rs-remove-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer; color: #bbb; font-size: 15px; line-height: 1; padding: 2px 5px; border-radius: 4px; transition: color 0.15s; }
        .rs-remove-btn:hover { color: #e05555; }
        .rs-add-btn { width: 100%; padding: 10px; background: none; border: 1px dashed #f5c9a0; border-radius: 8px; cursor: pointer; font-size: 13px; color: #C45200; font-family: 'DM Sans', sans-serif; font-weight: 500; transition: border-color 0.15s; }
        .rs-add-btn:hover { border-color: #C45200; }
        .rs-burger { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.15); border: none; border-radius: 8px; padding: 8px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; z-index: 10; }
        .rs-burger span { display: block; width: 20px; height: 2px; background: #fff; border-radius: 2px; transition: all 0.25s ease; }
        .rs-burger.open span:nth-child(1) { transform: rotate(45deg) translate(4px, 4px); }
        .rs-burger.open span:nth-child(2) { opacity: 0; }
        .rs-burger.open span:nth-child(3) { transform: rotate(-45deg) translate(4px, -4px); }
        .rs-menu { position: absolute; top: 56px; right: 16px; background: #fff; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.15); overflow: hidden; z-index: 100; min-width: 180px; }
        .rs-menu-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; font-size: 13px; font-weight: 500; color: #333; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'DM Sans', sans-serif; transition: background 0.15s; }
        .rs-menu-item:hover { background: #fff8f4; color: #C45200; }
        .rs-edit-banner { background: #fff3e0; border: 1px solid #f5c9a0; border-radius: 10px; padding: 10px 14px; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #8C3700; font-weight: 500; }
        .rs-edit-banner button { background: none; border: none; color: #C45200; font-size: 12px; cursor: pointer; font-weight: 600; text-decoration: underline; }
        .rs-load-input { width: 100%; background: #fff8f4; border: 0.5px solid #f5c9a0; border-radius: 8px; padding: 9px 12px; font-size: 14px; color: #111; font-family: 'DM Sans', sans-serif; outline: none; margin-bottom: 10px; }
        .rs-load-input:focus { border-color: #C45200; box-shadow: 0 0 0 2px rgba(196,82,0,0.1); }
        .rs-load-error { color: #e05555; font-size: 12px; margin-bottom: 10px; }
        .rs-loading-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; gap: 16px; }
        .rs-loading-spinner { width: 52px; height: 52px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #ffc864; border-radius: 50%; animation: rs-spin 0.8s linear infinite; }
        .rs-loading-text { color: #fff; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500; letter-spacing: 0.5px; }
        .rs-loading-sub { color: rgba(255,255,255,0.6); font-family: 'DM Sans', sans-serif; font-size: 12px; margin-top: -8px; }
        @keyframes rs-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .rs-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; animation: rs-fade-in 0.2s ease; }
        @keyframes rs-fade-in { from { opacity: 0; } to { opacity: 1; } }
        .rs-modal { background: #fff; border-radius: 16px; padding: 2rem; width: 100%; max-width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); animation: rs-slide-up 0.25s ease; text-align: center; }
        @keyframes rs-slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .rs-modal-icon { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 22px; }
        .rs-modal-icon.success { background: #fff3e0; }
        .rs-modal-icon.error { background: #fdecea; }
        .rs-modal-title { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; font-weight: 600; color: #111; margin-bottom: 8px; }
        .rs-modal-message { font-size: 13px; color: #666; line-height: 1.6; margin-bottom: 1.5rem; white-space: pre-line; }
        .rs-modal-input { width: 100%; background: #fff8f4; border: 0.5px solid #f5c9a0; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #111; font-family: 'DM Sans', sans-serif; outline: none; resize: vertical; min-height: 80px; margin-bottom: 1rem; transition: border-color 0.15s; }
        .rs-modal-input:focus { border-color: #C45200; box-shadow: 0 0 0 2px rgba(196,82,0,0.1); }
        .rs-modal-actions { display: flex; gap: 8px; }
        .rs-modal-btn { flex: 1; padding: 11px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; border: none; transition: opacity 0.15s; }
        .rs-modal-btn:hover { opacity: 0.85; }
        .rs-modal-btn.primary { background: #C45200; color: #fff; }
        .rs-modal-btn.secondary { background: #f5ece4; color: #333; }
        .rs-lock-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fdf3ec; padding: 1rem; }
        .rs-lock-card { background: #fff; border-radius: 20px; border: 0.5px solid rgba(0,0,0,0.08); overflow: hidden; width: 100%; max-width: 360px; text-align: center; }
        .rs-lock-header { background: #C45200; padding: 2rem 2rem 1.5rem; }
        .rs-lock-header::after { content: ''; display: block; width: 40px; height: 3px; background: #ffc864; border-radius: 2px; margin: 1rem auto 0; }
        .rs-lock-title { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 600; color: #fff; }
        .rs-lock-sub { font-size: 11px; letter-spacing: 3px; color: #ffc864; text-transform: uppercase; margin-top: 4px; }
        .rs-lock-body { padding: 2rem; }
        .rs-lock-icon { font-size: 36px; margin-bottom: 12px; }
        .rs-lock-label { font-size: 12px; color: #666; margin-bottom: 8px; display: block; }
        .rs-lock-input { width: 100%; background: #fff8f4; border: 0.5px solid #f5c9a0; border-radius: 10px; padding: 12px 16px; font-size: 20px; color: #111; font-family: 'DM Sans', sans-serif; outline: none; text-align: center; letter-spacing: 6px; margin-bottom: 12px; transition: border-color 0.15s, box-shadow 0.15s; }
        .rs-lock-input:focus { border-color: #C45200; box-shadow: 0 0 0 2px rgba(196,82,0,0.12); }
        .rs-lock-input.error { border-color: #e05555; box-shadow: 0 0 0 2px rgba(224,85,85,0.12); }
        .rs-lock-error { color: #e05555; font-size: 12px; margin-bottom: 12px; }
        .rs-staff-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; max-height: 260px; overflow-y: auto; }
        .rs-staff-option { padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.1); background: #fff8f4; color: #8C3700; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.15s; }
        .rs-staff-option:hover { background: #fdeede; }
        .rs-btn-secondary { background: transparent; color: #8C3700; margin-top: 8px; }
        .rs-btn-secondary:hover { opacity: 0.75; }
      `}</style>

      {!unlocked ? (
        <div className="rs-lock-screen">
          <div className="rs-lock-card">
            <div className="rs-lock-header">
              {logo && <img src={logo} alt="logo" style={{ width: 100, marginBottom: 10, borderRadius: "10px" }} />}
              <div className="rs-lock-title">Restaurant Sales</div>
              <div className="rs-lock-sub">Daily Report</div>
            </div>

            {lockStep === "pin" && (
              <div className="rs-lock-body">
                <div className="rs-lock-icon">🔐</div>
                <label className="rs-lock-label">Enter passcode to continue</label>
                <input
                  className={`rs-lock-input${pagePinError ? " error" : ""}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={10}
                  value={pagePin}
                  placeholder="••••"
                  onChange={(e) => { setPagePin(e.target.value); setPagePinError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handlePageUnlock()}
                />
                {pagePinError && <div className="rs-lock-error">⚠️ Incorrect passcode. Try again.</div>}
                <button className="rs-btn" onClick={handlePageUnlock}>Unlock</button>
              </div>
            )}

            {lockStep === "name" && (
              <div className="rs-lock-body">
                <div className="rs-lock-icon">👤</div>
                <label className="rs-lock-label">Who's submitting this report?</label>
                {staffLoadError && <div className="rs-lock-error">⚠️ {staffLoadError}</div>}
                <div className="rs-staff-list">
                  {staffOptions.map((s) => (
                    <button
                      key={s.id}
                      className="rs-staff-option"
                      onClick={() => handleSelectStaff(s)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <button
                  className="rs-btn rs-btn-secondary"
                  onClick={() => { setLockStep("pin"); setPagePin(""); }}
                >
                  ← Back
                </button>
              </div>
            )}

            {lockStep === "mfa" && (
              <div className="rs-lock-body">
                <div className="rs-lock-icon">🔑</div>
                <label className="rs-lock-label">
                  Enter the code from {selectedStaff?.name}'s authenticator app
                </label>
                <input
                  className={`rs-lock-input${mfaError ? " error" : ""}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  placeholder="000000"
                  onChange={(e) => { setMfaCode(e.target.value.replace(/\D/g, "")); setMfaError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyMfa()}
                />
                {mfaError && <div className="rs-lock-error">⚠️ {mfaError}</div>}
                <button
                  className="rs-btn"
                  onClick={handleVerifyMfa}
                  disabled={mfaVerifying || mfaCode.length < 6}
                >
                  {mfaVerifying ? "Verifying…" : "Verify & Continue"}
                </button>
                <button
                  className="rs-btn rs-btn-secondary"
                  onClick={() => { setLockStep("name"); setSelectedStaff(null); }}
                >
                  ← Choose a different name
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rs-wrapper">
          <div className="rs-card">
            <div className="rs-header">
              <button className={`rs-burger${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(!menuOpen)}>
                <span /><span /><span />
              </button>
              {menuOpen && (
                <div className="rs-menu">
                  <button className="rs-menu-item" onClick={() => { setMenuOpen(false); setLoadModalOpen(true); }}>📂 Load & Edit Report</button>
                </div>
              )}
              {logo && <img src={logo} alt="logo" style={{ width: 130, marginBottom: 10, borderRadius: "12px" }} />}
              <div className="rs-brand-name">Restaurant Sales</div>
              <div className="rs-brand-sub">Daily Report</div>
              <div className="rs-date-pill">{formatDate(form.date)}</div>
            </div>

            <div className="rs-body">
              {isEditMode && (
                <div className="rs-edit-banner">
                  ✏️ Editing report for {form.date}
                  <button onClick={() => { resetForm(); setIsEditMode(false); setEditDocId(null); }}>Cancel Edit</button>
                </div>
              )}

              <div className="rs-section">
                <div className="rs-section-label">Report Date</div>
                <div className="rs-field">
                  <label>Date</label>
                  <input type="date" name="date" value={form.date} onChange={handleChange} style={{ background: "#fff8f4" }} />
                </div>
              </div>

              <div className="rs-section">
                <div className="rs-section-label">Guests</div>
                <div className="rs-grid-2">
                  <div className="rs-field"><label>Lunch Guests</label><input name="lunchGuests" value={form.lunchGuests} onChange={handleChange} placeholder="0" type="number" /></div>
                  <div className="rs-field"><label>Dinner Guests</label><input name="dinnerGuests" value={form.dinnerGuests} onChange={handleChange} placeholder="0" type="number" /></div>
                </div>
                <div className="rs-field"><label>Dine-in Sales</label><MoneyInput name="dineInSales" value={form.dineInSales} onChange={handleChange} /></div>
              </div>

              <div className="rs-section">
                <div className="rs-section-label">Cash</div>
                <div className="rs-field"><label>Cash Sale (Cash Paid Total){autoFilledFields.cashSale && <span className="rs-autofill-badge">Auto-filled</span>}</label><MoneyInput name="cashSale" value={form.cashSale} onChange={handleChange} /></div>
                <div className="rs-field"><label>Total Cash</label><MoneyInput name="totalCashWithTip" value={form.totalCashWithTip} onChange={handleChange} /></div>
              </div>

              <div className="rs-section">
                <div className="rs-section-label">Credit Card</div>
                <div className="rs-grid-2">
                  <div className="rs-field"><label>Total Settle Amount (Credit & Debit Card Total){autoFilledFields.totalSettle && <span className="rs-autofill-badge">Auto-filled</span>}</label><MoneyInput name="totalSettle" value={form.totalSettle} onChange={handleChange} /></div>
                  <div className="rs-field"><label>Credit Card Tip (Gratuities Total){autoFilledFields.creditCardTip && <span className="rs-autofill-badge">Auto-filled</span>}</label><MoneyInput name="creditCardTip" value={form.creditCardTip} onChange={handleChange} /></div>
                </div>
              </div>

              <div className="rs-section">
                <div className="rs-section-label">Gift Cards & Online</div>
                <div className="rs-field"><label>Gift Card Redeemed</label><MoneyInput name="giftCard" value={form.giftCard} onChange={handleChange} /></div>
                <div className="rs-grid-2">
                  <div className="rs-field"><label>Restaurant Online</label><MoneyInput name="restaurantOnline" value={form.restaurantOnline} onChange={handleChange} /></div>
                  <div className="rs-field"><label>Grubhub</label><MoneyInput name="grubhub" value={form.grubhub} onChange={handleChange} /></div>
                  <div className="rs-field"><label>DoorDash</label><MoneyInput name="doordash" value={form.doordash} onChange={handleChange} /></div>
                  <div className="rs-field"><label>Uber Eats</label><MoneyInput name="uberEats" value={form.uberEats} onChange={handleChange} /></div>
                </div>
              </div>

              <div className="rs-section">
                <button type="button" className="rs-notes-toggle" onClick={() => setNotesOpen(!notesOpen)}>
                  <span>Catering</span>
                  <span className={`rs-notes-arrow${notesOpen ? " open" : ""}`}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5l5 5 5-5" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </button>
                <div className={`rs-notes-body${notesOpen ? " open" : ""}`}>
                  <div className="rs-notes-inner">
                    <div className="rs-grid-2">
                      <div className="rs-field"><label>Cash Catering</label><MoneyInput name="cashCatering" value={form.cashCatering} onChange={handleChange} /></div>
                      <div className="rs-field"><label>Cheques Catering</label><MoneyInput name="chequesCatering" value={form.chequesCatering} onChange={handleChange} /></div>
                    </div>
                    <div style={{ height: "1px", background: "#f5d5b8", margin: "4px 0 8px" }} />
                    {cateringNotes.map((note, index) => (
                      <div key={index} className="rs-catering-entry">
                        {cateringNotes.length > 1 && <button type="button" className="rs-remove-btn" onClick={() => removeCateringEntry(index)}>✕</button>}
                        <div className="rs-entry-label">Entry {index + 1}</div>
                        <div className="rs-field">
                          <label>Catering Date{cateringRequired && <span className="rs-required">*</span>}</label>
                          <input type="date" name="cateringDate" value={note.cateringDate} onChange={(evt) => handleCateringChange(index, evt)} required={cateringRequired} />
                        </div>
                        <div className="rs-field">
                          <label>Name{cateringRequired && <span className="rs-required">*</span>}</label>
                          <input type="text" name="name" value={note.name} onChange={(evt) => handleCateringChange(index, evt)} placeholder="Client name" required={cateringRequired} />
                        </div>
                        <div className="rs-field">
                          <label>Payment Type{cateringRequired && <span className="rs-required">*</span>}</label>
                          <select name="paymentType" value={note.paymentType} onChange={(evt) => handleCateringChange(index, evt)} required={cateringRequired}>
                            <option value="">Select payment type</option>
                            <option value="Cash">Cash</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Check">Check</option>
                          </select>
                        </div>
                        <div className="rs-field">
                          <label>Amount ($){cateringRequired && <span className="rs-required">*</span>}</label>
                          <MoneyInput name="amount" value={note.amount} onChange={(evt) => handleCateringChange(index, evt)} required={cateringRequired} />
                        </div>
                      </div>
                    ))}
                    <button type="button" className="rs-add-btn" onClick={addCateringEntry}>+ Add Another Entry</button>
                  </div>
                </div>
              </div>

              <button className="rs-btn" onClick={saveData} disabled={loading}>
                {loading ? (
                  <><svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "rs-spin 0.8s linear infinite" }}><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/><path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Generating...</>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M9 4l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>{isEditMode ? "Update Report" : "Generate Report"}</>
                )}
              </button>
            </div>
          </div>

          {loadModalOpen && (
            <div className="rs-modal-overlay" onClick={() => { setLoadModalOpen(false); setLoadPin(""); setLoadError(""); }}>
              <div className="rs-modal" onClick={(evt) => evt.stopPropagation()}>
                <div className="rs-modal-icon success">📂</div>
                <div className="rs-modal-title">Load Report</div>
                <div className="rs-modal-message">Enter the date and PIN to load and edit a report.</div>
                <label style={{ fontSize: "11px", color: "#666", display: "block", textAlign: "left", marginBottom: "4px" }}>Report Date</label>
                <input type="date" className="rs-load-input" value={loadDate} onChange={(evt) => setLoadDate(evt.target.value)} />
                <label style={{ fontSize: "11px", color: "#666", display: "block", textAlign: "left", marginBottom: "4px" }}>PIN</label>
                <input type="password" className="rs-load-input" value={loadPin} onChange={(evt) => setLoadPin(evt.target.value)} placeholder="Enter PIN" maxLength={10} />
                {loadError && <div className="rs-load-error">⚠️ {loadError}</div>}
                <div className="rs-modal-actions">
                  <button className="rs-modal-btn secondary" onClick={() => { setLoadModalOpen(false); setLoadPin(""); setLoadError(""); }}>Cancel</button>
                  <button className="rs-modal-btn primary" onClick={loadReport} disabled={loadLoading}>
                    {loadLoading ? "Loading..." : "Load Report"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="rs-loading-overlay">
              <div className="rs-loading-spinner" />
              <div className="rs-loading-text">Generating Report...</div>
              <div className="rs-loading-sub">This may take up to a minute</div>
            </div>
          )}

          {modal.open && (
            <div className="rs-modal-overlay" onClick={closeModal}>
              <div className="rs-modal" onClick={(evt) => evt.stopPropagation()}>
                <div className={`rs-modal-icon ${modal.type}`}>{modal.type === "success" ? "✅" : "⚠️"}</div>
                <div className="rs-modal-title">{modal.title}</div>
                <div className="rs-modal-message">{modal.message}</div>
                {modal.type === "success" && (
                  <>
                    <textarea className="rs-modal-input" value={feedback} onChange={(evt) => setFeedback(evt.target.value)} placeholder="Did anything look wrong? Let us know (optional)..." />
                    <div className="rs-modal-actions">
                      <button className="rs-modal-btn secondary" onClick={closeModal}>Skip</button>
                      <button className="rs-modal-btn primary" onClick={async () => {
                        if (feedback.trim()) {
                          try {
                            await addDoc(collection(db, "feedback"), { feedback, date: getToday(), createdAt: new Date() });
                            await fetch("/send-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback, date: getToday(), ownerEmails: form.ownerEmails || "" }) });
                          } catch (err) { console.error("Feedback error:", err); }
                        }
                        closeModal();
                      }}>Submit</button>
                    </div>
                  </>
                )}
                {modal.type === "error" && (
                  <>
                    <textarea className="rs-modal-input" value={feedback} onChange={(evt) => setFeedback(evt.target.value)} placeholder="Describe what went wrong (optional)..." />
                    <div className="rs-modal-actions">
                      <button className="rs-modal-btn secondary" onClick={closeModal}>Dismiss</button>
                      <button className="rs-modal-btn primary" onClick={closeModal}>Got it</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default App;