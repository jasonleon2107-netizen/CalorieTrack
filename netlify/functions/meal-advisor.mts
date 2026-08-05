// Grounded "eat out" meal-recommendation chatbot.
//
// Given a request like "Chick-fil-A, low carb", it pulls that restaurant's REAL
// menu items from our food-search proxy and asks Claude to assemble the best 2-3
// COMPLETE MEALS (entree plus sides/drink) from only those items. The model only
// chooses which items group into a meal; every calorie and macro number is summed
// server-side from the database, never produced by the model, so advice stays accurate.
//
// Two cheap Haiku calls: (1) classify the request into a DB search query and
// whether it names a specific restaurant, (2) assemble meals from the real items.
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
type Meal = {
  title: string;
  reason: string;
  items: FoodProduct[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
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
    // 1. Classify the request: what to search for, and is it a specific brand?
    const { query, restaurant } = await classify(key, message);
    // 2. Pull the real menu items. Restaurant queries use FatSecret only.
    const items = await lookupFoods(new URL(req.url).origin, query, restaurant);
    if (items.length === 0) {
      return json({
        query,
        restaurant,
        meals: [],
        note: `I couldn't find menu data for "${query}". Try naming the restaurant or dish more directly.`,
      });
    }
    // 3. Assemble the best 2-3 complete meals from ONLY those items.
    const meals = await recommendMeals(key, message, items);
    if (meals.length === 0) {
      return json({
        query,
        restaurant,
        meals: [],
        note: `I found items for "${query}" but nothing that clearly fits. Try rephrasing your goal.`,
      });
    }
    return json({ query, restaurant, meals });
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

// Turn a possibly-fenced, possibly-chatty model reply into a parsed object by
// grabbing the first {...} block. Returns null when there's nothing usable.
function parseJsonObject(raw: string): any {
  if (!raw) return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Strip markdown so model reasons render as clean plain text in the app.
function stripMd(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function classify(key: string, message: string): Promise<{ query: string; restaurant: boolean }> {
  const system =
    'Identify what to look up in a nutrition database from the user message. ' +
    'The query must name ONLY the restaurant or food, never the goal or diet words ' +
    '(drop "low carb", "high protein", "under 500 cal", "post-workout", etc.). ' +
    'Reply ONLY with compact JSON, no prose and no code fence: ' +
    '{"query":"<1-3 word restaurant or food name>","restaurant":<true|false>}. ' +
    'Set restaurant to true only when the user named a specific restaurant or brand chain ' +
    '(e.g. Chick-fil-A, Chipotle, Starbucks, McDonald\'s). ' +
    'Examples: "Chick-fil-A low carb" -> {"query":"Chick-fil-A","restaurant":true}; ' +
    '"Chipotle bowl, high protein" -> {"query":"Chipotle bowl","restaurant":true}.';
  const raw = await callClaude(key, system, message, 60);
  const parsed = parseJsonObject(raw);
  const query =
    parsed && typeof parsed.query === 'string' && parsed.query.trim()
      ? parsed.query.trim().slice(0, 60)
      : message.slice(0, 60);
  const restaurant = parsed?.restaurant === true;
  return { query, restaurant };
}

// ---- Food lookup (reuses our own food-search proxy) -----------------------

async function lookupFoods(origin: string, query: string, restaurant: boolean): Promise<FoodProduct[]> {
  const src = restaurant ? '&source=fatsecret' : '';
  const res = await fetch(`${origin}/.netlify/functions/food-search?q=${encodeURIComponent(query)}${src}`);
  if (!res.ok) return [];
  const data: any = await res.json();
  const results: FoodProduct[] = Array.isArray(data?.results) ? data.results : [];
  return results.slice(0, 25);
}

// ---- Meal assembly --------------------------------------------------------

// Sum the real per-serving (or per-100 fallback) numbers for the chosen items.
// This is the only source of a meal's totals; the model never supplies numbers.
function mealNutrition(items: FoodProduct[]): Nutrition {
  let kcal = 0,
    protein = 0,
    carbs = 0,
    fat = 0;
  for (const p of items) {
    const n = p.serving ?? p.per100g;
    if (!n) continue;
    kcal += n.kcal;
    protein += n.protein;
    carbs += n.carbs;
    fat += n.fat;
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
}

// One line per item for the model, indexed so it can reference items by number
// (far more reliable than echoing long names back exactly).
function itemLine(p: FoodProduct, i: number): string | null {
  const n = p.serving ?? p.per100g;
  if (!n) return null;
  const basis = p.serving ? p.serving.label : `100${p.basisUnit}`;
  return `[${i}] ${p.name} (${basis}): ${Math.round(n.kcal)} cal, ${Math.round(n.protein)}g protein, ${Math.round(
    n.carbs
  )}g carbs, ${Math.round(n.fat)}g fat`;
}

async function recommendMeals(key: string, message: string, items: FoodProduct[]): Promise<Meal[]> {
  const menu = items
    .map((p, i) => itemLine(p, i))
    .filter(Boolean)
    .join('\n');

  const system =
    'You help someone decide what to order while eating out. From ONLY the numbered menu items provided, ' +
    "assemble the best 2 to 3 COMPLETE MEAL options for the user's goal. Build a full meal (typically an " +
    'entree plus a side and/or a drink when suitable items exist), not a single item, unless only single ' +
    'items are available. Do not list the whole menu; pick only the best meals. Never invent items. ' +
    'Reference items by their [index] number. ' +
    'Reply ONLY with compact JSON, no prose and no code fence: ' +
    '{"meals":[{"title":"<short meal name>","reason":"<one short plain-text sentence, no markdown>","items":[<indices>]}]}.';
  const user = `Goal: ${message}\n\nMenu items (choose only from these indices):\n${menu}`;
  const raw = await callClaude(key, system, user, 500);

  const parsed = parseJsonObject(raw);
  const rawMeals: any[] = Array.isArray(parsed?.meals) ? parsed.meals : [];

  const meals: Meal[] = [];
  for (const rm of rawMeals.slice(0, 3)) {
    const idxs: any[] = Array.isArray(rm?.items) ? rm.items : [];
    const seen = new Set<number>();
    const chosen: FoodProduct[] = [];
    for (const ix of idxs) {
      const i = typeof ix === 'number' ? ix : parseInt(String(ix), 10);
      if (Number.isInteger(i) && i >= 0 && i < items.length && !seen.has(i)) {
        seen.add(i);
        chosen.push(items[i]);
      }
    }
    if (chosen.length === 0) continue;
    const totals = mealNutrition(chosen);
    const title =
      typeof rm?.title === 'string' && rm.title.trim() ? stripMd(rm.title).slice(0, 80) : chosen[0].name;
    const reason = typeof rm?.reason === 'string' ? stripMd(rm.reason).slice(0, 160) : '';
    meals.push({ title, reason, items: chosen, ...totals });
  }
  return meals;
}
