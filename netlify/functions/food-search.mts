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
type Scored = { product: FoodProduct; generic: boolean };

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'cache-control': 'public, max-age=300',
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS });

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (!q) return json({ results: [] });

  // Run both sources in parallel; a failure in one must not sink the other.
  const [usda, fatsecret] = await Promise.allSettled([searchUSDA(q), searchFatSecret(q)]);
  const scored: Scored[] = [];
  if (usda.status === 'fulfilled') scored.push(...usda.value);
  if (fatsecret.status === 'fulfilled') scored.push(...fatsecret.value);

  const results = rankAndDedupe(scored, q);
  return json({ results });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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

function rankAndDedupe(scored: Scored[], query: string): FoodProduct[] {
  const q = query.toLowerCase();
  const seen = new Set<string>();
  const withScore = scored.map((s) => {
    const name = s.product.name.toLowerCase();
    let score = 0;
    if (name === q) score += 200;
    else if (name.startsWith(q)) score += 100;
    else if (name.includes(q)) score += 40;
    if (s.generic) score += 25; // surface whole/generic foods above branded noise
    // Shorter names for the same match tend to be the "plain" food (e.g.
    // "Apple" over "Apple cinnamon breakfast bar").
    score -= Math.min(name.length, 40) * 0.2;
    return { product: s.product, score };
  });
  withScore.sort((a, b) => b.score - a.score);

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
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(q)}&pageSize=25` +
    `&dataType=${encodeURIComponent('Foundation,SR Legacy,Survey (FNDDS),Branded')}`;
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

    const generic = f?.dataType !== 'Branded';
    const brand = typeof f?.brandName === 'string' ? f.brandName : f?.brandOwner;
    const base = String(f?.description ?? '').trim();
    if (!base) continue;
    const name = titleCase(base) + (brand && !generic ? ` (${titleCase(String(brand))})` : '');

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

    out.push({ product: { name, serving, per100g, basisUnit }, generic });
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
  const raw = data?.foods?.food;
  const foods: any[] = Array.isArray(raw) ? raw : raw ? [raw] : []; // single result isn't an array

  const out: Scored[] = [];
  for (const f of foods) {
    const parsed = parseFatSecretDescription(String(f?.food_description ?? ''));
    if (!parsed) continue;
    const generic = String(f?.food_type ?? '') === 'Generic';
    const base = String(f?.food_name ?? '').trim();
    if (!base) continue;
    const brand = typeof f?.brand_name === 'string' ? f.brand_name.trim() : '';
    const name = brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${base} (${brand})` : base;
    out.push({ product: { name, ...parsed }, generic });
  }
  return out;
}
