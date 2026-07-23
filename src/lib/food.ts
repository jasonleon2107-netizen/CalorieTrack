export type Nutrition = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type FoodProduct = {
  name: string;
  // Barcode, when known. Search hits carry one so full details (including
  // serving sizes) can be fetched on demand.
  code?: string;
  // Per-serving nutrition (with a human label like "325 ml"), when available.
  serving: (Nutrition & { label: string }) | null;
  // Per-100g nutrition, when available. Enables the grams / mL input modes.
  per100g: Nutrition | null;
  // Whether the per-100 basis is naturally weight or volume. Open Food Facts
  // reports liquids per 100 ml using the same fields it uses for 100 g.
  basisUnit: 'g' | 'ml';
};

const UNIT_TO_BASE: Record<string, { factor: number; unit: 'g' | 'ml' }> = {
  mg: { factor: 0.001, unit: 'g' },
  g: { factor: 1, unit: 'g' },
  kg: { factor: 1000, unit: 'g' },
  oz: { factor: 28.3495, unit: 'g' },
  lb: { factor: 453.592, unit: 'g' },
  ml: { factor: 1, unit: 'ml' },
  cl: { factor: 10, unit: 'ml' },
  dl: { factor: 100, unit: 'ml' },
  l: { factor: 1000, unit: 'ml' },
};

/**
 * Pull a usable amount out of a free-text serving size such as "30 g",
 * "1 cup (240 ml)" or "2 bottles, 330ml". Returns the amount normalized to
 * grams or millilitres.
 */
export function parseServingSize(raw: unknown): { amount: number; unit: 'g' | 'ml' } | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const text = raw.toLowerCase().replace(/,(\d)/g, '.$1');
  const re = /([\d.]+)\s*(mg|kg|g|oz|lb|ml|cl|dl|l)\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const amount = Number(match[1]);
    const spec = UNIT_TO_BASE[match[2]];
    if (spec && Number.isFinite(amount) && amount > 0) {
      return { amount: amount * spec.factor, unit: spec.unit };
    }
  }
  return null;
}

function scale(n: Nutrition, factor: number): Nutrition {
  return {
    kcal: n.kcal * factor,
    protein: n.protein * factor,
    carbs: n.carbs * factor,
    fat: n.fat * factor,
  };
}

export type BarcodeLookupResult =
  | { status: 'found'; product: FoodProduct }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

const USER_AGENT = 'CalorieTracker/1.0 (Expo app)';

// The two Open Food Facts endpoints disagree on this field's shape: the
// product/barcode API returns a comma-separated string ("Nutella, Ferrero"),
// while the search service returns an array (["Tesco"]). Normalize both.
function firstBrand(brands: unknown): string {
  if (Array.isArray(brands)) {
    const first = brands.find((b) => typeof b === 'string' && b.trim());
    return typeof first === 'string' ? first.trim() : '';
  }
  if (typeof brands === 'string') {
    return brands.split(',')[0]?.trim() ?? '';
  }
  return '';
}

// Turn a raw Open Food Facts product record into our FoodProduct shape.
// Returns null when the record has no usable calorie data.
function parseProduct(raw: any): FoodProduct | null {
  const n = raw?.nutriments ?? {};
  const brand = firstBrand(raw?.brands);
  const rawName = raw?.product_name ?? raw?.generic_name;
  const base = typeof rawName === 'string' ? rawName.trim() : '';
  if (!base) return null;
  const name = brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${base} (${brand})` : base;

  // Some records only carry kilojoules, so fall back and convert.
  const kcal100raw = n['energy-kcal_100g'];
  const kj100 = n['energy-kj_100g'];
  const kcal100 =
    typeof kcal100raw === 'number' ? kcal100raw : typeof kj100 === 'number' ? kj100 / 4.184 : undefined;

  const per100g =
    typeof kcal100 === 'number'
      ? {
          kcal: kcal100,
          protein: n['proteins_100g'] ?? 0,
          carbs: n['carbohydrates_100g'] ?? 0,
          fat: n['fat_100g'] ?? 0,
        }
      : null;

  const parsedServing = parseServingSize(raw?.serving_size);

  // Liquids are reported per 100 ml under the same fields as per 100 g.
  const quantityUnit = typeof raw?.product_quantity_unit === 'string' ? raw.product_quantity_unit.toLowerCase() : '';
  const parsedQuantity = parseServingSize(raw?.quantity);
  const basisUnit: 'g' | 'ml' =
    parsedServing?.unit === 'ml' ||
    quantityUnit === 'ml' ||
    quantityUnit === 'l' ||
    parsedQuantity?.unit === 'ml'
      ? 'ml'
      : 'g';

  const kcalServing = n['energy-kcal_serving'];
  let serving: (Nutrition & { label: string }) | null = null;
  if (typeof kcalServing === 'number') {
    serving = {
      label: raw.serving_size || '1 serving',
      kcal: kcalServing,
      protein: n['proteins_serving'] ?? 0,
      carbs: n['carbohydrates_serving'] ?? 0,
      fat: n['fat_serving'] ?? 0,
    };
  } else if (per100g && parsedServing) {
    // Most records have no per-serving fields but do state a serving size,
    // so derive the serving from the per-100 values.
    serving = {
      label: raw.serving_size,
      ...scale(per100g, parsedServing.amount / 100),
    };
  }

  if (!serving && !per100g) return null;
  const code = typeof raw?.code === 'string' ? raw.code : undefined;
  return { name, code, serving, per100g, basisUnit };
}

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      return { status: 'error', message: `Lookup failed (${res.status})` };
    }
    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      return { status: 'not_found' };
    }
    const product = parseProduct(data.product);
    return product ? { status: 'found', product } : { status: 'not_found' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * Fetch the full product record for a search result. The search index omits
 * serving sizes, so this fills them in when the user picks a food. Returns the
 * original product unchanged if the lookup fails or adds nothing.
 */
export async function fetchProductDetails(product: FoodProduct): Promise<FoodProduct> {
  if (!product.code) return product;
  const result = await lookupBarcode(product.code);
  if (result.status !== 'found') return product;
  // Keep the search result's name, which already includes the brand.
  return { ...result.product, name: product.name };
}

// Full-text food search via Open Food Facts' search-a-licious service.
// No API key required. Returns best matches with usable nutrition data.
export async function searchFoods(query: string, signal?: AbortSignal): Promise<FoodProduct[]> {
  const q = query.trim();
  if (!q) return [];
  // The search index only carries per-100 nutrition; serving sizes live on the
  // full product record, fetched on demand by `fetchProductDetails`.
  const url =
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}` +
    `&page_size=25&fields=code,product_name,generic_name,brands,nutriments,quantity`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal });
  if (!res.ok) throw new Error(`the food database returned ${res.status}. Try again shortly.`);
  // A rate-limited or erroring Open Food Facts serves an HTML page, which
  // would otherwise surface as a confusing JSON parse error.
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('the food database is busy. Try again shortly.');
  }
  const hits: any[] = data.hits ?? [];
  const seen = new Set<string>();
  const results: FoodProduct[] = [];
  for (const hit of hits) {
    // One malformed record shouldn't wipe out the whole result set.
    let product: FoodProduct | null = null;
    try {
      product = parseProduct(hit);
    } catch {
      continue;
    }
    if (!product) continue;
    const dedupeKey = product.name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    results.push(product);
  }
  return results;
}
