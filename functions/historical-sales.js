// Serves the pre-launch historical sales (server/historical-sales.csv.txt) to
// signed-in admins only, for the Year-over-Year report. It used to be a public
// file in /public, readable by anyone.
import { requireUser } from "../server/auth.js";
import csv from "../server/historical-sales.csv.txt";

export async function onRequest(context) {
  const user = await requireUser(context, ["admin"]);
  if (user instanceof Response) return user;

  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
