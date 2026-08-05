// Food search proxy. Queries USDA FoodData Central and FatSecret in parallel
// (whichever have credentials configured), normalizes both into the app's
// FoodProduct shape, then merges, dedupes and ranks the results.
//
// Why a proxy at all: FatSecret credentials must stay server-side, and its API
// only accepts requests from whitelisted IPs. Routing USDA through here too
// gives the client one endpoint and one result shape, and avoids CORS.
//
// Env vars (set in the Netlify site, all optional — missing ones are skipped):
//   USDA_API_KEY              USDA FoodData Central key
//   FATSECRET_CLIENT_ID       FatSecret OAuth2 client id
//   FATSECRET_CLIENT_SECRET   FatSecret OAuth2 client secret

type Nutrition = { kcal: number; protein: number; carbs: number; fat: number };
type FoodProduct = {
  name: string;
  code?: string;
  serving: (Nutrition & { label: string }) | null;
  per100g: Nutrition | null;
  basisUnit: 'g' | 'ml';
};

// Internal wrapper so we can rank before handing back bare FoodProducts.
// `priority` is a per-dataset base score (clean everyday-food datasets rank
// above scientific cuts and packaged noise).
type Scored = { product: FoodProduct; priority: number };

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS });

  const params = new URL(req.url).searchParams;
  const q = (params.get('q') ?? '').trim();
  if (!q) return json({ results: [] });

  // Optional source filter. Restaurant/brand queries pass source=fatsecret so
  // USDA's generic whole foods (e.g. "Chicken Fillets" for a Chick-fil-A search)
  // don't outrank the actual branded menu items. Default runs both.
  const source = (params.get('source') ?? '').toLowerCase();
  const useUsda = source !== 'fatsecret';
  const useFatsecret = source !== 'usda';

  // Run the selected sources in parallel; a failure in one must not sink the other.
  const [usda, fatsecret] = await Promise.allSettled([
    useUsda ? searchUSDA(q) : Promise.resolve<Scored[]>([]),
    useFatsecret ? searchFatSecret(q) : Promise.resolve<Scored[]>([]),
  ]);
  const scored: Scored[] = [];
  if (usda.status === 'fulfilled') scored.push(...usda.value);
  if (fatsecret.status === 'fulfilled') scored.push(...fatsecret.value);

  // Don't CDN-cache a response where a source we actually ran errored (e.g.
  // FatSecret throttle or a not-yet-propagated IP allowance) — otherwise a
  // transient failure gets served empty for the full cache window.
  const degraded = (useUsda && usda.status === 'rejected') || (useFatsecret && fatsecret.status === 'rejected');
  const results = rankAndDedupe(scored, q);
  return json({ results }, 200, degraded ? 'no-store' : 'public, max-age=300');
};

function json(body: unknown, status = 200, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, 'cache-control': cache } });
}

// USDA and FatSecret occasionally throttle (429) or blip (5xx). One quick retry
// keeps a transient hiccup from blanking an otherwise-good search.
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
async function fetchRetry(url: string, opts?: RequestInit, tries = 2): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok || !RETRYABLE.has(res.status)) return res;
      last = new Error(`${res.status}`);
    } catch (e) {
      last = e;
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 400));
  }
  throw last instanceof Error ? last : new Error('request failed');
}

// ---- ranking -------------------------------------------------------------

// Odd cuts / offal that flood searches for common meats. Pushed down hard
// unless the user actually typed one of these words.
const OFFAL = ['feet', 'paws', 'giblets', 'gizzard', 'cartilage', 'tripe', 'snout', 'spleen', 'lungs'];

const STOPWORDS = new Set(['and', 'with', 'the', 'for', 'of', 'in', 'an', 'or', 'on', 'to', 'a']);

// Collapse punctuation to spaces so "McDonald's" matches "mcdonalds" and
// "Chick-fil-A" matches "chick fil a".
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(q: string): string[] {
  return norm(q)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function rankAndDedupe(scored: Scored[], query: string): FoodProduct[] {
  const qn = norm(query);
  const tokens = tokenize(query);

  const withScore = scored
    .map((s) => {
      const name = norm(s.product.name);
      let matched = 0;
      for (const t of tokens) if (name.includes(t)) matched++;

      // Drop rows that match none of the query words — USDA relevance can be
      // very loose, and these are the "why is this even here" results.
      if (matched === 0 && !name.includes(qn)) return null;

      let score = s.priority;
      if (name === qn) score += 500; // exact name
      if (name.startsWith(qn)) score += 220; // "chicken breast, grilled"
      // USDA inverts names ("Rice, white, cooked"), so the canonical food starts
      // with one of the query words, while combo dishes start with another
      // ingredient ("Beans and white rice"). Reward the canonical form.
      if (tokens.some((t) => name.startsWith(t))) score += 160;
      if (tokens.length > 1 && name.includes(qn)) score += 110; // whole phrase present
      if (tokens.length) score += (matched / tokens.length) * 200; // share of words matched
      if (tokens.length && matched === tokens.length) score += 90; // all words present
      score -= Math.min(s.product.name.length, 90) * 0.6; // prefer the plain, concise entry
      if (OFFAL.some((w) => name.includes(w) && !qn.includes(w))) score -= 250;

      return { product: s.product, score };
    })
    .filter((x): x is { product: FoodProduct; score: number } => x !== null);

  withScore.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: FoodProduct[] = [];
  for (const { product } of withScore) {
    const key = product.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
    if (out.length >= 30) break;
  }
  return out;
}

// ---- USDA FoodData Central ----------------------------------------------

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// Pull a nutrient value (per 100 g) out of a USDA foodNutrients array by its
// standard nutrient number. Falls back to matching by unit for energy, since
// some records label kcal energy under different numbers (208 / 957 / 958).
function usdaNutrient(nutrients: any[], numbers: string[], kcal = false): number {
  for (const n of nutrients) {
    const number = String(n?.nutrientNumber ?? n?.nutrient?.number ?? '');
    const unit = String(n?.unitName ?? n?.nutrient?.unitName ?? '').toUpperCase();
    if (kcal && unit === 'KCAL') return num(n?.value ?? n?.amount);
    if (numbers.includes(number) && !kcal) return num(n?.value ?? n?.amount);
  }
  return 0;
}

async function searchUSDA(q: string): Promise<Scored[]> {
  const key = process.env.USDA_API_KEY;
  if (!key) return [];
  // Only the whole-food datasets. "Branded" floods results with packaged
  // products and buries staples; FatSecret covers branded + restaurant instead.
  // FNDDS ("Survey") has the cleanest everyday-food names, so it's queried and
  // ranked first.
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(q)}&pageSize=50` +
    `&dataType=${encodeURIComponent('Survey (FNDDS),Foundation,SR Legacy')}`;
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const data: any = await res.json();
  const foods: any[] = Array.isArray(data?.foods) ? data.foods : [];

  const out: Scored[] = [];
  for (const f of foods) {
    const nutrients: any[] = Array.isArray(f?.foodNutrients) ? f.foodNutrients : [];
    const kcal = usdaNutrient(nutrients, [], true);
    if (!kcal) continue; // no energy = unusable
    const per100g: Nutrition = {
      kcal,
      protein: usdaNutrient(nutrients, ['203']),
      carbs: usdaNutrient(nutrients, ['205']),
      fat: usdaNutrient(nutrients, ['204']),
    };

    const dataType = String(f?.dataType ?? '');
    const priority = dataType === 'Survey (FNDDS)' ? 130 : dataType === 'Foundation' ? 110 : 60;
    const base = String(f?.description ?? '').trim();
    if (!base) continue;
    const name = titleCase(base);

    // Branded/some Survey foods state a serving; derive it from per-100 when the
    // unit is weight or volume.
    const sizeUnit = String(f?.servingSizeUnit ?? '').toLowerCase();
    const size = num(f?.servingSize);
    const basisUnit: 'g' | 'ml' = sizeUnit === 'ml' || sizeUnit === 'l' ? 'ml' : 'g';
    let serving: (Nutrition & { label: string }) | null = null;
    if (size > 0 && (sizeUnit === 'g' || sizeUnit === 'ml')) {
      const factor = size / 100;
      const label = String(f?.householdServingFullText || `${size} ${sizeUnit}`);
      serving = {
        label,
        kcal: per100g.kcal * factor,
        protein: per100g.protein * factor,
        carbs: per100g.carbs * factor,
        fat: per100g.fat * factor,
      };
    }

    out.push({ product: { name, serving, per100g, basisUnit }, priority });
  }
  return out;
}

function titleCase(s: string): string {
  // USDA descriptions are ALL CAPS or "Apples, raw"; keep it readable.
  if (s === s.toUpperCase()) {
    return s
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/,\s*/g, ', ');
  }
  return s;
}

// ---- FatSecret -----------------------------------------------------------

let fsToken: { value: string; expires: number } | null = null;

async function fatSecretToken(id: string, secret: string): Promise<string> {
  if (fsToken && fsToken.expires > Date.now() + 60_000) return fsToken.value;
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetchRetry('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });
  if (!res.ok) throw new Error(`FatSecret token ${res.status}`);
  const data: any = await res.json();
  const value = String(data?.access_token ?? '');
  if (!value) throw new Error('FatSecret token empty');
  fsToken = { value, expires: Date.now() + num(data?.expires_in) * 1000 };
  return value;
}

// FatSecret search returns a single description line per food, e.g.
// "Per 100g - Calories: 52kcal | Fat: 0.17g | Carbs: 13.81g | Protein: 0.26g"
// or "Per 1 serving - Calories: 95kcal | ...". Parse it into a FoodProduct.
function parseFatSecretDescription(desc: string): {
  serving: (Nutrition & { label: string }) | null;
  per100g: Nutrition | null;
  basisUnit: 'g' | 'ml';
} | null {
  const m = desc.match(
    /Per\s+(.+?)\s*-\s*Calories:\s*([\d.]+)\s*kcal.*?Fat:\s*([\d.]+)\s*g.*?Carbs:\s*([\d.]+)\s*g.*?Protein:\s*([\d.]+)\s*g/i
  );
  if (!m) return null;
  const per = m[1].trim();
  const nutr: Nutrition = { kcal: num(+m[2]), protein: num(+m[5]), carbs: num(+m[4]), fat: num(+m[3]) };
  const per100 = /^100\s*g$/i.test(per);
  const per100ml = /^100\s*ml$/i.test(per);
  if (per100 || per100ml) {
    return { serving: null, per100g: nutr, basisUnit: per100ml ? 'ml' : 'g' };
  }
  // A named serving ("1 serving", "1 cup (240g)"). Keep it as a serving entry.
  const basisUnit: 'g' | 'ml' = /\bml\b|\bfl\b|\bcup\b/i.test(per) ? 'ml' : 'g';
  return { serving: { label: per, ...nutr }, per100g: null, basisUnit };
}

async function searchFatSecret(q: string): Promise<Scored[]> {
  const id = process.env.FATSECRET_CLIENT_ID;
  const secret = process.env.FATSECRET_CLIENT_SECRET;
  if (!id || !secret) return [];
  const token = await fatSecretToken(id, secret);
  const url =
    'https://platform.fatsecret.com/rest/server.api?method=foods.search&format=json' +
    `&max_results=20&search_expression=${encodeURIComponent(q)}`;
  const res = await fetchRetry(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`FatSecret ${res.status}`);
  const data: any = await res.json();
  // FatSecret reports errors (invalid IP, throttling) as HTTP 200 with an error
  // body. Surface it as a failure so it isn't mistaken for "no results" or cached.
  if (data?.error) throw new Error(`FatSecret error ${data.error.code}: ${data.error.message ?? ''}`);
  const raw = data?.foods?.food;
  const foods: any[] = Array.isArray(raw) ? raw : raw ? [raw] : []; // single result isn't an array

  const out: Scored[] = [];
  for (const f of foods) {
    const parsed = parseFatSecretDescription(String(f?.food_description ?? ''));
    if (!parsed) continue;
    const priority = String(f?.food_type ?? '') === 'Generic' ? 120 : 70;
    const base = String(f?.food_name ?? '').trim();
    if (!base) continue;
    const brand = typeof f?.brand_name === 'string' ? f.brand_name.trim() : '';
    const name = brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${base} (${brand})` : base;
    out.push({ product: { name, ...parsed }, priority });
  }
  return out;
}
