// Reads back whatever the Email Worker has stored for a given date, so the
// daily report form can offer it as an auto-fill. Requires the same
// EMAIL_IMPORTS KV namespace to also be bound to this Pages project
// (Settings -> Functions -> KV namespace bindings).
export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const date = searchParams.get("date");

  if (!date) {
    return new Response(JSON.stringify({ error: "date query param is required (YYYY-MM-DD)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!context.env.EMAIL_IMPORTS) {
    return new Response(
      JSON.stringify({ error: "EMAIL_IMPORTS KV namespace is not bound to this Pages project" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const raw = await context.env.EMAIL_IMPORTS.get(`import:${date}`);

  if (!raw) {
    return new Response(JSON.stringify({ found: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ found: true, data: JSON.parse(raw) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
