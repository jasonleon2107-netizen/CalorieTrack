export type Nutrition = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type FoodProduct = {
  name: string;
  // Per-serving nutrition (with a human label like "325 ml"), when available.
  serving: (Nutrition & { label: string }) | null;
  // Per-100g nutrition, when available. Enables the "grams" input mode.
  per100g: Nutrition | null;
};

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

  const kcalServing = n['energy-kcal_serving'];
  const serving =
    typeof kcalServing === 'number'
      ? {
          label: raw.serving_size || '1 serving',
          kcal: kcalServing,
          protein: n['proteins_serving'] ?? 0,
          carbs: n['carbohydrates_serving'] ?? 0,
          fat: n['fat_serving'] ?? 0,
        }
      : null;

  const kcal100 = n['energy-kcal_100g'];
  const per100g =
    typeof kcal100 === 'number'
      ? {
          kcal: kcal100,
          protein: n['proteins_100g'] ?? 0,
          carbs: n['carbohydrates_100g'] ?? 0,
          fat: n['fat_100g'] ?? 0,
        }
      : null;

  if (!serving && !per100g) return null;
  return { name, serving, per100g };
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

// Full-text food search via Open Food Facts' search-a-licious service.
// No API key required. Returns best matches with usable nutrition data.
export async function searchFoods(query: string, signal?: AbortSignal): Promise<FoodProduct[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}` +
    `&page_size=25&fields=product_name,generic_name,brands,nutriments,serving_size`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
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
