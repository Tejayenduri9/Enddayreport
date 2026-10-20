import { useState, useEffect, useRef } from "react";
import { db, kioskAuth } from "./kioskFirebase";
import useDeviceAccess from "./useDeviceAccess";
import KioskConnect from "./KioskConnect";
import { AuthScreen } from "./authUi";
import { Icons } from "./icons";
import { authedFetch } from "./authedFetch";
import { collection, addDoc, getDoc, getDocs, doc as firestoreDoc, setDoc, runTransaction, query, where } from "firebase/firestore";
import logo from "./assets/logo.png";
import { generateWeeklyPDF, generateMonthlyPDF } from "./reportPdfWeekly";
import { generateAuditPDF } from "./reportPdfAudit";
import { generatePDF } from "./reportPdf";
import { summarizeReports, buildTaxAudit } from "./salesMath";

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

// How often the page re-checks the date and whether a new version has been
// deployed, so a tab that's left open at the restaurant all day can't drift
// onto a stale date or keep running old code. 2 minutes is frequent enough to
// catch a midnight rollover or a fresh deploy quickly, without hammering the
// server.
const STALE_CHECK_INTERVAL_MS = 2 * 60 * 1000;

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
  restaurantOnlineTips: "",
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
  const [emailImportPreview, setEmailImportPreview] = useState(null);
  const [pagePin, setPagePin] = useState("");
  const [pagePinError, setPagePinError] = useState(false);

  // This device's connection to the restaurant (approved from the admin
  // dashboard's Team & devices). Reports and server calls require it - see
  // firestore.rules and /server.
  const device = useDeviceAccess();
  const deviceApproved = device.status === "approved";

  const handlePageUnlock = () => {
    const correct = import.meta.env.VITE_PAGE_PIN || "0000";
    if (pagePin === correct) {
      setUnlocked(true);
      setPagePinError(false);
    } else {
      setPagePinError(true);
      setPagePin("");
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

  // --- Kiosk-safety: self-correct a stale tab left open all day ---
  // A device that's never backgrounded (always foreground, no tab switch) can
  // sit for hours with (a) a date that's drifted to "yesterday" after
  // midnight and (b) old JS still running even after a new version has been
  // deployed. The `focus` listener above only catches (a), and only when the
  // tab is actually blurred/refocused. These refs mirror the latest state
  // into a periodic setInterval closure so it can check both, without being
  // torn down and recreated on every render.
  const formRef = useRef(form);
  const loadingRef = useRef(loading);
  const isEditModeRef = useRef(isEditMode);
  const modalOpenRef = useRef(modal.open);
  const loadModalOpenRef = useRef(loadModalOpen);

  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { isEditModeRef.current = isEditMode; }, [isEditMode]);
  useEffect(() => { modalOpenRef.current = modal.open; }, [modal.open]);
  useEffect(() => { loadModalOpenRef.current = loadModalOpen; }, [loadModalOpen]);

  useEffect(() => {
    let cancelled = false;
    let baselineVersionTag = null;

    // Treat the form as "empty" (safe to silently correct or reload) only if
    // nothing but the date/owner-email defaults has been touched.
    const isFormEffectivelyEmpty = () => {
      const f = formRef.current;
      const blank = blankForm();
      return Object.keys(blank).every((key) => {
        if (key === "date" || key === "ownerEmails") return true;
        return !f[key];
      });
    };

    const isSafeToAutoAct = () =>
      !loadingRef.current &&
      !modalOpenRef.current &&
      !loadModalOpenRef.current &&
      !isEditModeRef.current &&
      isFormEffectivelyEmpty();

    // Cache-busted fetch of the page itself, used only to read response
    // headers (ETag / Last-Modified) as a lightweight "build fingerprint" -
    // no need to touch vite.config.js or the CI pipeline for this to work.
    const fetchVersionTag = async () => {
      try {
        const res = await fetch("/?_=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return null;
        return res.headers.get("etag") || res.headers.get("last-modified") || null;
      } catch {
        return null; // offline / blocked - just skip this cycle
      }
    };

    const runCheck = async () => {
      if (cancelled) return;

      // 1) Date drift: only correct it when it's safe (don't yank the date
      // out from under someone mid-entry or mid-edit).
      if (!isEditModeRef.current) {
        const today = getToday();
        if (formRef.current.date !== today && isFormEffectivelyEmpty()) {
          setForm((prev) => ({ ...prev, date: today }));
        }
      }

      // 2) Stale code: compare this load's version tag against a fresh one.
      // Only ever reload automatically when it's safe to do so; otherwise
      // just wait for the next cycle and try again.
      const currentTag = await fetchVersionTag();
      if (cancelled || !currentTag) return;

      if (baselineVersionTag === null) {
        baselineVersionTag = currentTag;
        return;
      }

      if (currentTag !== baselineVersionTag && isSafeToAutoAct()) {
        window.location.reload();
      }
    };

    runCheck();
    const intervalId = setInterval(runCheck, STALE_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // Intentionally mount-only: reads the latest state via refs above so it
    // doesn't need to be torn down and recreated as the form changes.
  }, []);

  const showModal = (type, title, message) => setModal({ open: true, type, title, message });
  const closeModal = () => { setModal({ open: false, type: "", title: "", message: "" }); setFeedback(""); };

  const resetForm = () => {
    setForm(blankForm());
    setCateringNotes([emptyCatering()]);
    setNotesOpen(false);
    setOriginalForm(null);
    setEmailImportPreview(null);
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


  // Recomputes every derived/computed field from whatever raw inputs are
  // currently in `updated`. Used both by handleChange (on every keystroke)
  // and by the Aldelo auto-fill effect below, so the two never fall out of
  // sync with each other.
  const recomputeDerivedFields = (updated) => {
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
    const restaurantOnlineTips = Number(updated.restaurantOnlineTips) || 0;
    const grubhub = Number(updated.grubhub) || 0;
    const doordash = Number(updated.doordash) || 0;
    const uberEats = Number(updated.uberEats) || 0;
    // restaurantOnline (like totalSettle) is the raw settled amount and includes
    // the online tip - net it out here, same as creditCardSale above, so the tip
    // doesn't leak into totalSalesDay.
    const onlineSale = (restaurantOnline - restaurantOnlineTips) + grubhub + doordash + uberEats;
    const totalRestaurantSales = totalInHouse + onlineSale;
    const totalSalesDay = totalRestaurantSales + totalCatering;
    return {
      ...updated,
      cashTip: cashTip >= 0 ? cashTip : 0,
      totalCashWithTip: totalCash,
      creditCardSale,
      systemGross,
      totalInHouse,
      totalRestaurantOnline: onlineSale,
      totalRestaurantSales,
      totalCatering,
      totalSalesDay,
    };
  };

  const handleChange = (evt) => {
    let updated = { ...form, [evt.target.name]: evt.target.value };
    if (!isEditMode && emailImportPreview?.totalGuests) {
      const lunch = Number(updated.lunchGuests) || 0;
      updated.dinnerGuests = Math.max(0, emailImportPreview.totalGuests - lunch);
    }
    updated = recomputeDerivedFields(updated);
    setForm(updated);
  };

  // Whenever the report date changes (and this isn't editing an already-
  // saved report), check whether the Aldelo email-import pipeline has
  // values waiting for that date. Cash Sale, Total Settle Amount, Credit
  // Card Tip, and Dine-in Sales get filled in directly and quietly (only if
  // still empty - never overwriting something already typed). Dinner Guests
  // is computed live from Total Guests minus Lunch Guests instead, handled
  // separately in handleChange above so it stays in sync as you type.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEmailImportPreview(null);
      if (!form.date || !deviceApproved) return;
      try {
        const res = await authedFetch(kioskAuth, `/get-email-import?date=${form.date}`);
        const payload = await res.json();
        if (cancelled || !payload.found) return;
        const imported = payload.data;
        setEmailImportPreview(imported);
        if (isEditMode) return;
        setForm((prev) => {
          const next = { ...prev };
          if (!next.cashSale && imported.cashSale) next.cashSale = imported.cashSale;
          if (!next.totalSettle && imported.totalSettle) next.totalSettle = imported.totalSettle;
          if (!next.creditCardTip && imported.creditCardTip) next.creditCardTip = imported.creditCardTip;
          if (!next.dineInSales && imported.dineInSales) next.dineInSales = imported.dineInSales;
          if (imported.totalGuests) {
            const lunch = Number(next.lunchGuests) || 0;
            next.dinnerGuests = Math.max(0, imported.totalGuests - lunch);
          }
          return recomputeDerivedFields(next);
        });
      } catch (err) {
        console.error("Failed to check for auto-imported values:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.date, isEditMode, deviceApproved]);

  // --- Load an existing report for a date. ---
  // New reports use the date as their Firestore doc ID (see saveData below).
  // Reports saved before that change have random IDs, so fall back to a
  // query on the date field to find those.
  // Returns the saved report for `date` (date-keyed or older random-ID), or null.
  const findReportForDate = async (date) => {
    const snap = await getDoc(firestoreDoc(db, "restaurants", date));
    if (snap.exists()) return snap;
    const legacy = await getDocs(query(collection(db, "restaurants"), where("date", "==", date)));
    return legacy.empty ? null : legacy.docs[0];
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
      const existing = await findReportForDate(loadDate);
      if (!existing) {
        setLoadError("No report found for this date.");
        setLoadLoading(false);
        return;
      }
      const data = existing.data();
      const loadedForm = { ...blankForm(), ...data, date: loadDate };
      setForm(loadedForm);
      setOriginalForm(loadedForm);
      setCateringNotes(data.cateringNotes || [emptyCatering()]);
      setEditDocId(existing.id);
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

  const saveData = async ({ dateConfirmed = false } = {}) => {
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

    // A kiosk tab left open overnight can still show yesterday's date, which
    // used to save the next day's report under the wrong date. Block future
    // dates outright and make any other non-today date an explicit choice.
    const today = getToday();
    if (!isEditMode && form.date > today) {
      showModal("error", "Date Is in the Future", `The report date is ${shortDate(form.date)}, but today is ${shortDate(today)}.\n\nPlease fix the date before submitting.`);
      return;
    }
    if (!isEditMode && form.date !== today && !dateConfirmed) {
      setModal({
        open: true,
        type: "confirm",
        title: "Check the Date",
        message: `You are submitting a report for ${shortDate(form.date)}, but today is ${shortDate(today)}.\n\nIs ${shortDate(form.date)} the correct date?`,
        onConfirm: () => { closeModal(); saveData({ dateConfirmed: true }); },
      });
      return;
    }

    setLoading(true);
    try {
      // One report per date, enforced in three layers:
      //   1. New reports use the date as their Firestore doc ID, and the
      //      create runs in a transaction, so two near-simultaneous
      //      submissions can't both win.
      //   2. Firestore security rules (firestore.rules) only allow creating a
      //      report whose doc ID equals its date, so even an old cached kiosk
      //      tab running pre-fix code can't add a second document for a date.
      //   3. Reports saved before this change have random IDs, which (1) and
      //      (2) can't see - findReportForDate checks for those first.
      if (!isEditMode) {
        const alreadySubmittedModal = () => {
          setLoading(false);
          showModal(
            "error",
            "Already Submitted",
            `A report for ${shortDate(form.date)} has already been submitted.\n\nPlease use "Load Report" to edit it instead, or email enddayreports.com if you need help.`
          );
        };

        if (await findReportForDate(form.date)) {
          alreadySubmittedModal();
          return;
        }

        const docRef = firestoreDoc(db, "restaurants", form.date);
        try {
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef);
            if (snap.exists()) {
              const dupErr = new Error("ALREADY_SUBMITTED");
              dupErr.code = "ALREADY_SUBMITTED";
              throw dupErr;
            }
            tx.set(docRef, { ...form, cateringNotes, createdAt: new Date() });
          });
        } catch (txErr) {
          if (txErr?.code === "ALREADY_SUBMITTED") {
            alreadySubmittedModal();
            return;
          }
          // The security rules refuse a create when the date already has a
          // report, or when the date is outside the kiosk's 14-day window.
          if (txErr?.code === "permission-denied") {
            if (await findReportForDate(form.date).catch(() => null)) {
              alreadySubmittedModal();
            } else {
              setLoading(false);
              showModal(
                "error",
                "Not Allowed",
                `This device can only submit reports dated within the last 14 days.\n\nPlease check the date (${shortDate(form.date)}), or ask the owner to add this report.`
              );
            }
            return;
          }
          throw txErr; // anything else (network, etc.) surfaces as a real error below
        }
      } else {
        // Editing an existing report: always update that same document. The
        // date field is locked in edit mode, so a report can't move dates.
        await setDoc(firestoreDoc(db, "restaurants", editDocId), { ...form, cateringNotes, updatedAt: new Date() }, { merge: true });
      }

      const pdfDoc = generatePDF(form, cateringNotes);
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
            const weekSummary = summarizeReports(weekReports);
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
            const monthSummary = summarizeReports(monthReports); // same shape works for any date range
            const monthlyDoc = generateMonthlyPDF({ monthLabel: label, summary: monthSummary, dailyReports: monthReports });
            monthlyPdfBase64 = monthlyDoc.output("datauristring").split(",")[1];
            monthlyLabel = label;

            // Tax Audit Report - zero-filled day-by-day, matching the Tax Audit
            // dashboard's own calculation exactly, for the owner to review before
            // manually sending it on to the auditor.
            const { dayRows, summary: auditSummary } = buildTaxAudit(monthReports, year, monthIndex, shortDate);

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
          restaurantOnlineTips: { label: "Restaurant Online Tips", money: true },
          grubhub: { label: "Grubhub", money: true },
          doordash: { label: "DoorDash", money: true },
          uberEats: { label: "Uber Eats", money: true },
          totalRestaurantOnline: { label: "Total Online Sales", money: true },
          totalInHouse: { label: "Total In House", money: true },
          totalRestaurantSales: { label: "Total Restaurant Sales", money: true },
          totalSalesDay: { label: "Total Sales of the Day", money: true },
        };
        const fmt2 = (v) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      const response = await authedFetch(kioskAuth, "/generate-report", {
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
        .rs-computed-hint { font-weight: 400; font-style: italic; color: #999; }
        .rs-field input:disabled { background: #f5f0ea; color: #888; cursor: not-allowed; }
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
      `}</style>

      {!deviceApproved ? (
        <KioskConnect device={device} />
      ) : !unlocked ? (
        <AuthScreen subtitle={device.name || "Daily report"}>
          <form onSubmit={(e) => { e.preventDefault(); handlePageUnlock(); }}>
            <div className="au-icon">{Icons.lock}</div>
            <h1 className="au-h">Enter passcode</h1>
            <p className="au-p">Enter the staff passcode to open today&apos;s report.</p>
            <div className="au-stack">
              <input
                className="au-input pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                value={pagePin}
                placeholder="••••"
                aria-label="Passcode"
                aria-invalid={pagePinError}
                autoFocus
                onChange={(e) => { setPagePin(e.target.value); setPagePinError(false); }}
              />
              {pagePinError && <div className="au-alert error" role="alert">That passcode isn&apos;t right. Try again.</div>}
              <button className="au-btn primary" type="submit">Unlock</button>
            </div>
          </form>
        </AuthScreen>
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
                  <input type="date" name="date" value={form.date} onChange={handleChange} readOnly={isEditMode} title={isEditMode ? "The date can't be changed while editing a saved report" : undefined} style={{ background: "#fff8f4" }} />
                </div>
              </div>

              <div className="rs-section">
                <div className="rs-section-label">Guests</div>
                <div className="rs-grid-2">
                  <div className="rs-field"><label>Lunch Guests</label><input name="lunchGuests" value={form.lunchGuests} onChange={handleChange} placeholder="0" type="number" /></div>
                  <div className="rs-field">
                    <label>Dinner Guests{!isEditMode && emailImportPreview?.totalGuests ? <span className="rs-computed-hint"> (auto: Aldelo total − Lunch)</span> : null}</label>
                    <input
                      name="dinnerGuests"
                      value={form.dinnerGuests}
                      onChange={handleChange}
                      placeholder="0"
                      type="number"
                      disabled={!isEditMode && Boolean(emailImportPreview?.totalGuests)}
                    />
                  </div>
                </div>
                <div className="rs-field"><label>Dine-in Sales</label><MoneyInput name="dineInSales" value={form.dineInSales} onChange={handleChange} /></div>
              </div>

              <div className="rs-section">
                <div className="rs-section-label">Cash</div>
                <div className="rs-field"><label>Cash Sale (Cash Paid Total)</label><MoneyInput name="cashSale" value={form.cashSale} onChange={handleChange} /></div>
                <div className="rs-field"><label>Total Cash</label><MoneyInput name="totalCashWithTip" value={form.totalCashWithTip} onChange={handleChange} /></div>
              </div>

              <div className="rs-section">
                <div className="rs-section-label">Credit Card</div>
                <div className="rs-grid-2">
                  <div className="rs-field"><label>Total Settle Amount (Credit & Debit Card Total)</label><MoneyInput name="totalSettle" value={form.totalSettle} onChange={handleChange} /></div>
                  <div className="rs-field"><label>Credit Card Tip (Gratuities Total)</label><MoneyInput name="creditCardTip" value={form.creditCardTip} onChange={handleChange} /></div>
                </div>
              </div>

              <div className="rs-section">
                <div className="rs-section-label">Gift Cards & Online</div>
                <div className="rs-field"><label>Gift Card Redeemed</label><MoneyInput name="giftCard" value={form.giftCard} onChange={handleChange} /></div>
                <div className="rs-grid-2">
                  <div className="rs-field"><label>Restaurant Online</label><MoneyInput name="restaurantOnline" value={form.restaurantOnline} onChange={handleChange} /></div>
                  <div className="rs-field"><label>Restaurant Online Tips</label><MoneyInput name="restaurantOnlineTips" value={form.restaurantOnlineTips} onChange={handleChange} /></div>
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
                            await authedFetch(kioskAuth, "/send-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback, date: getToday() }) });
                          } catch (err) { console.error("Feedback error:", err); }
                        }
                        closeModal();
                      }}>Submit</button>
                    </div>
                  </>
                )}
                {modal.type === "confirm" && (
                  <div className="rs-modal-actions">
                    <button className="rs-modal-btn secondary" onClick={closeModal}>No, go back</button>
                    <button className="rs-modal-btn primary" onClick={modal.onConfirm}>Yes, submit</button>
                  </div>
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