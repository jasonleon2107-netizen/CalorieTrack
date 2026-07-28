// Grounded "eat out" meal-recommendation chatbot.
//
// Given a request like "Chick-fil-A, low cal high protein", it pulls that
// restaurant's REAL menu items from our food-search proxy (USDA + FatSecret)
// and asks Claude to recommend from ONLY those items. Nutrition numbers come
// from the database, never from the model, so the advice stays accurate.
//
// Two cheap Haiku calls: (1) turn the free-text request into a short DB search
// query, (2) recommend from the real items that search returns.
//
// Env var: ANTHROPIC_API_KEY (set in the Netlify site).

const MODEL = 'claude-haiku-4-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

type Nutrition = { kcal: number; protein: number; carbs: number; fat: number };
type FoodProduct = {
  name: string;
  serving: (Nutrition & { label: string }) | null;
  per100g: Nutrition | null;
  basisUnit: 'g' | 'ml';
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'The assistant is not configured yet.' }, 503);

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  const message = (body.message ?? '').trim();
  if (!message) return json({ error: 'Say what you feel like eating.' }, 400);

  try {
    // 1. Reduce the free-text request to a food-database search query.
    const query = await extractQuery(key, message);
    // 2. Pull the real menu / food items for that query.
    const items = await lookupFoods(new URL(req.url).origin, query);
    if (items.length === 0) {
      return json({
        reply: `I couldn't find menu data for "${query}". Try naming the restaurant or dish more directly.`,
        items: [],
      });
    }
    // 3. Recommend from ONLY those real items.
    const reply = await recommend(key, message, items);
    return json({ reply, query, items: items.slice(0, 12) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'The assistant is busy. Try again shortly.' }, 502);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ---- Claude calls ---------------------------------------------------------

async function callClaude(key: string, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`assistant error (${res.status})`);
  const data: any = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('')
    : '';
  return String(text).trim();
}

async function extractQuery(key: string, message: string): Promise<string> {
  const system =
    'Extract the restaurant or food to look up in a nutrition database from the user message. ' +
    'Reply with ONLY a short search query of 1-4 words (e.g. "Chick-fil-A", "Chipotle bowl", "grilled chicken"). ' +
    'No punctuation beyond what the name needs, no explanation.';
  const q = await callClaude(key, system, message, 32);
  // Guard against a chatty reply; keep it to the first line, capped.
  return q.split('\n')[0].slice(0, 60).trim() || message.slice(0, 60);
}

// Render an item's nutrition compactly for the model, preferring a per-serving
// figure (what a user actually orders) and falling back to per-100.
function itemLine(p: FoodProduct): string | null {
  const n = p.serving ?? p.per100g;
  if (!n) return null;
  const basis = p.serving ? p.serving.label : `100${p.basisUnit}`;
  return `- ${p.name} (${basis}): ${Math.round(n.kcal)} cal, ${Math.round(n.protein)}g protein, ${Math.round(
    n.carbs
  )}g carbs, ${Math.round(n.fat)}g fat`;
}

async function recommend(key: string, message: string, items: FoodProduct[]): Promise<string> {
  const menu = items.map(itemLine).filter(Boolean).join('\n');
  const system =
    'You are a concise nutrition assistant helping someone order while eating out. ' +
    'Recommend ONLY from the menu items listed in the user message. Never invent items or nutrition numbers, ' +
    'and never state a number that is not in the list. Pick the 1-3 best matches for their goal, give each ' +
    "item's calories and protein, and add one short sentence of reasoning. If nothing fits their goal, say so " +
    'plainly and suggest the closest option. Keep it under 120 words. Use "cal", not "kcal".';
  const user = `My request: ${message}\n\nAvailable menu items (the only ones you may recommend):\n${menu}`;
  return callClaude(key, system, user, 400);
}

// ---- Food lookup (reuses our own food-search proxy) -----------------------

async function lookupFoods(origin: string, query: string): Promise<FoodProduct[]> {
  const res = await fetch(`${origin}/.netlify/functions/food-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data: any = await res.json();
  const results: FoodProduct[] = Array.isArray(data?.results) ? data.results : [];
  return results.slice(0, 25);
}
