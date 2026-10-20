// Single source of truth for how sales, tips and tax are calculated.
// Every screen, PDF and email uses these helpers, so all totals agree.
//
// Totals are always rebuilt from the raw channel fields (never the stored
// totalSalesDay / totalRestaurantOnline), so reports saved before a formula
// fix are still counted correctly.

export const TAX_RATE = 0.07;

const num = (r, key) => Number(r?.[key]) || 0;

// ---- Per-day helpers ----

export const tipsOf = (r) =>
  num(r, "cashTip") + num(r, "creditCardTip") + num(r, "restaurantOnlineTips");

// restaurantOnline is the settled amount and includes the online tip - net it out.
export const restaurantOnlineNetOf = (r) =>
  num(r, "restaurantOnline") - num(r, "restaurantOnlineTips");

export const onlineSaleOf = (r) =>
  restaurantOnlineNetOf(r) + num(r, "grubhub") + num(r, "doordash") + num(r, "uberEats");

// Gift card redemptions were already counted when the card was sold, so they
// are removed from in-house sales.
export const inHouseSaleOf = (r) =>
  num(r, "cashSale") + num(r, "creditCardSale") - num(r, "giftCard");

export const saleExclTipOf = (r) =>
  inHouseSaleOf(r) + onlineSaleOf(r) + num(r, "totalCatering");

export const totalIncTipOf = (r) => saleExclTipOf(r) + tipsOf(r);

export const guestsOf = (r) => num(r, "lunchGuests") + num(r, "dinnerGuests");

// Recorded sale amounts already include 7% tax. Cash catering is not taxed.
// Gift cards are NOT subtracted here - the taxable base is unchanged from the
// original tax/audit reports.
export const taxableSaleOf = (r) =>
  num(r, "cashSale") + num(r, "creditCardSale") + onlineSaleOf(r) + num(r, "chequesCatering");

// ---- Multi-day summary (weekly / monthly / custom range / daily tax) ----

export function summarizeReports(reports) {
  const sum = (fn) => reports.reduce((s, r) => s + fn(r), 0);
  const field = (key) => sum((r) => num(r, key));

  const cashSale = field("cashSale");
  const cashTip = field("cashTip");
  const cashCatering = field("cashCatering");
  const creditCardSale = field("creditCardSale");
  const creditCardTip = field("creditCardTip");
  const totalCatering = field("totalCatering");
  const totalSale = sum(saleExclTipOf);
  const totalTips = sum(tipsOf);
  const taxableAmount = sum(taxableSaleOf);
  const tax = taxableAmount * TAX_RATE;

  return {
    cashSale, cashTip, cashCatering, creditCardSale, creditCardTip, totalCatering,
    chequesCatering: field("chequesCatering"),
    totalSettle: field("totalSettle"),
    giftCard: field("giftCard"),
    restaurantOnline: field("restaurantOnline"),
    restaurantOnlineNet: sum(restaurantOnlineNetOf),
    restaurantOnlineTips: field("restaurantOnlineTips"),
    grubhub: field("grubhub"),
    doordash: field("doordash"),
    uberEats: field("uberEats"),
    totalInHouse: sum(inHouseSaleOf),
    totalOnline: sum(onlineSaleOf),
    totalGuests: sum(guestsOf),
    totalSale,
    totalTips,
    totalAmountIncTip: totalSale + totalTips,
    totalCashIncTip: cashSale + cashTip + cashCatering,
    taxableAmount,
    tax,
    netSalesExclTax: totalSale - tax,
  };
}

// ---- Monthly tax audit (Tax Audit dashboard + the month-end email) ----

// One row per calendar day (zero-filled for days without a report), plus totals.
// `labelFor(dateStr)` formats the day label shown in the table/PDF.
export function buildTaxAudit(reports, year, monthIndex, labelFor) {
  const reportsByDate = {};
  reports.forEach((r) => { reportsByDate[r.date] = r; });

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dayRows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const r = reportsByDate[dateStr];
    const taxableBase = taxableSaleOf(r);
    dayRows.push({
      dayLabel: labelFor(dateStr),
      dateStr,
      hasData: Boolean(r),
      cashSale: num(r, "cashSale"),
      creditCardSale: num(r, "creditCardSale"),
      restaurantOnline: restaurantOnlineNetOf(r),
      grubhub: num(r, "grubhub"),
      doordash: num(r, "doordash"),
      uberEats: num(r, "uberEats"),
      chequesCatering: num(r, "chequesCatering"),
      cashTip: num(r, "cashTip"),
      creditCardTip: num(r, "creditCardTip"),
      restaurantOnlineTips: num(r, "restaurantOnlineTips"),
      tax: taxableBase * TAX_RATE,
      // Net Total is the plain sum of the sale channels (Tax is shown alongside for
      // reference only, not subtracted here) - tips get added on top for Grand Total.
      totalWithoutTip: taxableBase,
      grandTotal: taxableBase + tipsOf(r),
    });
  }

  const sum = (key) => dayRows.reduce((s, row) => s + row[key], 0);
  const totalTaxableSale = sum("totalWithoutTip");
  const totalTax = sum("tax");
  const restaurantOnline = sum("restaurantOnline");
  const grubhub = sum("grubhub");
  const doordash = sum("doordash");
  const uberEats = sum("uberEats");

  const summary = {
    totalTaxableSale, totalTax, totalNetSale: totalTaxableSale - totalTax,
    cashSale: sum("cashSale"), creditCardSale: sum("creditCardSale"),
    restaurantOnline, grubhub, doordash, uberEats,
    chequesCatering: sum("chequesCatering"),
    cashTip: sum("cashTip"), creditCardTip: sum("creditCardTip"), restaurantOnlineTips: sum("restaurantOnlineTips"),
    totalOnline: restaurantOnline + grubhub + doordash + uberEats,
    // Cash Catering excluded per audit rules
    totalCashExclCatering: sum("cashSale") + sum("cashTip"),
    totalCcSettle: sum("creditCardSale") + sum("creditCardTip"),
    totalTips: sum("cashTip") + sum("creditCardTip") + sum("restaurantOnlineTips"),
  };

  return { dayRows, summary };
}
