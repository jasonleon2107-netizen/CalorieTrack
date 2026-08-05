// Grounded "what should I eat" meal-recommendation chatbot.
//
// Flow (three cheap Haiku calls, all grounded in the real food database):
//   1. plan()  - decide how to look up food. A named restaurant/brand becomes a
//                single branded search; anything else (homemade / generic) becomes
//                a set of whole-food INGREDIENT searches chosen to fit the goal.
//   2. lookup  - run those searches through our food-search proxy and pool the
//                real items.
//   3. compose - the model assembles the best 2-3 COMPLETE meals from ONLY those
//                items, choosing a portion (qty) for each. Every calorie/macro
//                number is computed server-side from the real items scaled by qty;
//                the model never supplies a number.
//
// This lets the bot invent reasonable homemade recipes ("grilled chicken + rice +
// broccoli") from real ingredients, instead of only finding foods literally named
// after the words the user typed.
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
type MealItem = Nutrition & { name: string; amount: string };
type Meal = Nutrition & { title: string; reason: string; items: MealItem[] };

const MAX_SEARCHES = 8;

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
    // 1. Decide what to search for.
    const p = await plan(key, message);
    // 2. Pull the real items for every planned search.
    const items = await lookupFoods(new URL(req.url).origin, p.searches, p.restaurant);
    if (items.length === 0) {
      return json({
        restaurant: p.restaurant,
        meals: [],
        note: `I couldn't find food data for that. Try naming the restaurant, dish, or main ingredient more directly.`,
      });
    }
    // 3. Compose complete meals from ONLY those items.
    const meals = await composeMeals(key, message, items);
    if (meals.length === 0) {
      return json({
        restaurant: p.restaurant,
        meals: [],
        note: `I found ingredients but couldn't build a meal that fits. Try rephrasing your goal.`,
      });
    }
    return json({ restaurant: p.restaurant, meals });
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

// Strip markdown so model text renders clean in the app.
function stripMd(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Plan the lookup: a restaurant name (one branded search) or a set of whole-food
// ingredient searches chosen to fit the request.
async function plan(key: string, message: string): Promise<{ restaurant: boolean; searches: string[] }> {
  const system =
    'You plan how to look up foods in a nutrition database for a meal request. ' +
    'If the user named a specific restaurant or brand chain (Chick-fil-A, Chipotle, Starbucks, McDonald\'s, etc.), ' +
    'reply {"restaurant":true,"searches":["<restaurant name only>"]}. ' +
    'Otherwise the user wants a homemade or generic meal: propose 4 to 8 common WHOLE-FOOD INGREDIENT ' +
    'search terms (single foods, not dishes) that could be combined into meals fitting their goal, and ' +
    'reply {"restaurant":false,"searches":["chicken breast","brown rice",...]}. ' +
    'Drop diet/goal words from the search terms. Reply ONLY with compact JSON, no prose, no code fence. ' +
    'Example: "something homemade, low cal high protein" -> ' +
    '{"restaurant":false,"searches":["chicken breast","egg whites","greek yogurt","broccoli","cottage cheese","tuna","black beans","spinach"]}.';
  const raw = await callClaude(key, system, message, 200);
  const parsed = parseJsonObject(raw);
  const restaurant = parsed?.restaurant === true;
  let searches: string[] = Array.isArray(parsed?.searches)
    ? parsed.searches.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).map((s: string) => s.trim().slice(0, 40))
    : [];
  if (searches.length === 0) searches = [message.slice(0, 60)];
  searches = searches.slice(0, restaurant ? 1 : MAX_SEARCHES);
  return { restaurant, searches };
}

// ---- Food lookup (reuses our own food-search proxy) -----------------------

async function lookupFoods(origin: string, searches: string[], restaurant: boolean): Promise<FoodProduct[]> {
  // Restaurant queries use FatSecret only (skip USDA generics). Ingredient
  // searches keep both sources; take fewer per term so the pool stays relevant.
  const src = restaurant ? '&source=fatsecret' : '';
  const perTerm = restaurant ? 25 : 6;

  const lists = await Promise.all(
    searches.map(async (term) => {
      try {
        const res = await fetch(`${origin}/.netlify/functions/food-search?q=${encodeURIComponent(term)}${src}`);
        if (!res.ok) return [] as FoodProduct[];
        const data: any = await res.json();
        const results: FoodProduct[] = Array.isArray(data?.results) ? data.results : [];
        return results.slice(0, perTerm);
      } catch {
        return [] as FoodProduct[];
      }
    })
  );

  const seen = new Set<string>();
  const pooled: FoodProduct[] = [];
  for (const list of lists) {
    for (const p of list) {
      const k = p.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      pooled.push(p);
    }
  }
  return pooled.slice(0, 30);
}

// ---- Meal composition -----------------------------------------------------

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// Human label for a chosen portion: the serving label (scaled) or grams/ml.
function amountLabel(p: FoodProduct, qty: number): string {
  if (p.serving) {
    return qty === 1 ? p.serving.label : `${trimNum(qty)}× ${p.serving.label}`;
  }
  const unit = p.basisUnit === 'ml' ? 'ml' : 'g';
  return `${Math.round(qty * 100)} ${unit}`;
}

// One indexed line per item for the model, showing the amount one qty unit buys.
function itemLine(p: FoodProduct, i: number): string | null {
  const n = p.serving ?? p.per100g;
  if (!n) return null;
  const basis = p.serving ? p.serving.label : `100${p.basisUnit}`;
  return `[${i}] ${p.name} (${basis}): ${Math.round(n.kcal)} cal, ${Math.round(n.protein)}g protein, ${Math.round(
    n.carbs
  )}g carbs, ${Math.round(n.fat)}g fat`;
}

async function composeMeals(key: string, message: string, items: FoodProduct[]): Promise<Meal[]> {
  const menu = items
    .map((p, i) => itemLine(p, i))
    .filter(Boolean)
    .join('\n');

  const system =
    'You help someone decide what to eat. From ONLY the numbered items provided, assemble the best 2 to 3 ' +
    'COMPLETE meals for their goal. A meal should be balanced and realistic: for a restaurant, an entree plus ' +
    'a side and/or drink; for homemade, a protein plus a carb and/or vegetable (a small recipe). ' +
    'For each item choose a realistic portion "qty" (a multiplier of the amount shown for that item; ' +
    '1 means the shown amount, 1.5 means one and a half, etc.). Keep portions sensible for one person and the goal. ' +
    'Never invent items or numbers. Reference items by their [index]. ' +
    'Reply ONLY with compact JSON, no prose and no code fence: ' +
    '{"meals":[{"title":"<short name>","reason":"<one short plain-text sentence>","items":[{"i":<index>,"qty":<number>}]}]}.';
  const user = `Goal: ${message}\n\nItems (choose only from these indices):\n${menu}`;
  const raw = await callClaude(key, system, user, 700);

  const parsed = parseJsonObject(raw);
  const rawMeals: any[] = Array.isArray(parsed?.meals) ? parsed.meals : [];

  const meals: Meal[] = [];
  for (const rm of rawMeals.slice(0, 3)) {
    const rawItems: any[] = Array.isArray(rm?.items) ? rm.items : [];
    const seen = new Set<number>();
    const mealItems: MealItem[] = [];
    let kcal = 0,
      protein = 0,
      carbs = 0,
      fat = 0;

    for (const ri of rawItems) {
      const i = typeof ri?.i === 'number' ? ri.i : parseInt(String(ri?.i), 10);
      if (!Number.isInteger(i) || i < 0 || i >= items.length || seen.has(i)) continue;
      const p = items[i];
      const n = p.serving ?? p.per100g;
      if (!n) continue;
      seen.add(i);
      // Clamp qty to a sane range so a bad value can't produce an absurd portion.
      const qty = Math.min(Math.max(Number(ri?.qty) || 1, 0.25), 6);
      const ik = n.kcal * qty,
        ip = n.protein * qty,
        ic = n.carbs * qty,
        iff = n.fat * qty;
      kcal += ik;
      protein += ip;
      carbs += ic;
      fat += iff;
      mealItems.push({
        name: p.name,
        amount: amountLabel(p, qty),
        kcal: Math.round(ik),
        protein: Math.round(ip),
        carbs: Math.round(ic),
        fat: Math.round(iff),
      });
    }

    if (mealItems.length === 0) continue;
    const title = typeof rm?.title === 'string' && rm.title.trim() ? stripMd(rm.title).slice(0, 80) : mealItems[0].name;
    const reason = typeof rm?.reason === 'string' ? stripMd(rm.reason).slice(0, 160) : '';
    meals.push({
      title,
      reason,
      items: mealItems,
      kcal: Math.round(kcal),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
    });
  }
  return meals;
}
