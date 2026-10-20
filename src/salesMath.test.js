// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tipsOf, onlineSaleOf, inHouseSaleOf, saleExclTipOf, totalIncTipOf, guestsOf,
  taxableSaleOf, summarizeReports, buildTaxAudit, TAX_RATE,
} from "./salesMath.js";

// A typical day: every field set, so each formula has something to get wrong.
const day = {
  date: "2026-10-06",
  lunchGuests: 40, dinnerGuests: 60,
  cashSale: 500, cashTip: 50, cashCatering: 200, chequesCatering: 300, totalCatering: 500,
  totalSettle: 2200, creditCardTip: 200, creditCardSale: 2000,
  giftCard: 100,
  restaurantOnline: 330, restaurantOnlineTips: 30,
  grubhub: 100, doordash: 150, uberEats: 50,
};

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

test("tips include cash, credit card and online tips", () => {
  assert.equal(tipsOf(day), 50 + 200 + 30);
});

test("online sale nets the online tip out of restaurantOnline", () => {
  assert.equal(onlineSaleOf(day), 300 + 100 + 150 + 50);
});

test("in-house sale subtracts gift card redemptions", () => {
  assert.equal(inHouseSaleOf(day), 500 + 2000 - 100);
});

test("sale excl. tip = in-house + online + catering", () => {
  assert.equal(saleExclTipOf(day), 2400 + 600 + 500);
});

test("total incl. tip = sale excl. tip + all tips", () => {
  assert.equal(totalIncTipOf(day), 3500 + 280);
});

test("guests = lunch + dinner", () => {
  assert.equal(guestsOf(day), 100);
});

test("taxable sale excludes cash catering and does not subtract gift cards", () => {
  assert.equal(taxableSaleOf(day), 500 + 2000 + 600 + 300);
});

test("missing, empty and text fields count as zero", () => {
  const sparse = { date: "2026-10-07", cashSale: "250.50", cashTip: "", grubhub: undefined };
  assert.equal(saleExclTipOf(sparse), 250.5);
  assert.equal(tipsOf(sparse), 0);
  assert.equal(totalIncTipOf(undefined), 0);
});

test("ignores stale stored totals and rebuilds from raw fields", () => {
  // Old reports saved before the online-tip fix stored totals that included tips.
  const stale = { ...day, totalSalesDay: 99999, totalRestaurantOnline: 99999, totalInHouse: 99999 };
  assert.equal(saleExclTipOf(stale), saleExclTipOf(day));
});

test("summary totals equal the sum of the daily totals", () => {
  const other = { ...day, date: "2026-10-07", cashSale: 800, giftCard: 0, creditCardTip: 75 };
  const s = summarizeReports([day, other]);
  close(s.totalSale, saleExclTipOf(day) + saleExclTipOf(other));
  close(s.totalTips, tipsOf(day) + tipsOf(other));
  close(s.totalAmountIncTip, totalIncTipOf(day) + totalIncTipOf(other));
  close(s.totalOnline, onlineSaleOf(day) + onlineSaleOf(other));
  close(s.totalInHouse, inHouseSaleOf(day) + inHouseSaleOf(other));
  assert.equal(s.giftCard, 100);
  assert.equal(s.totalGuests, 200);
  close(s.tax, (taxableSaleOf(day) + taxableSaleOf(other)) * TAX_RATE);
  close(s.netSalesExclTax, s.totalSale - s.tax);
});

test("summary of no reports is all zeros", () => {
  const s = summarizeReports([]);
  assert.equal(s.totalAmountIncTip, 0);
  assert.equal(s.tax, 0);
});

test("tax audit has one row per day of the month, zero-filled", () => {
  const { dayRows, summary } = buildTaxAudit([day], 2026, 9, (d) => d);
  assert.equal(dayRows.length, 31);
  const filled = dayRows.find((r) => r.dateStr === "2026-10-06");
  assert.equal(filled.hasData, true);
  assert.equal(filled.totalWithoutTip, taxableSaleOf(day));
  close(filled.tax, taxableSaleOf(day) * TAX_RATE);
  assert.equal(filled.grandTotal, taxableSaleOf(day) + tipsOf(day));
  const empty = dayRows.find((r) => r.dateStr === "2026-10-07");
  assert.equal(empty.hasData, false);
  assert.equal(empty.grandTotal, 0);
  assert.equal(summary.totalTaxableSale, taxableSaleOf(day));
  close(summary.totalNetSale, summary.totalTaxableSale - summary.totalTax);
});

test("tax audit handles February and leap years", () => {
  assert.equal(buildTaxAudit([], 2026, 1, (d) => d).dayRows.length, 28);
  assert.equal(buildTaxAudit([], 2028, 1, (d) => d).dayRows.length, 29);
});
