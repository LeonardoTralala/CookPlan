// Hitung ulang daftar belanja + total dari plan.days secara CLIENT-SIDE.
// Cerminan supabase/functions/_shared/shoppingList.ts (+ subtractPantry dari
// validate.ts), tapi memakai data resep yang SUDAH dimuat di klien (recipeIndex,
// shape camelCase dari recipeService: baseServings, ingredients[].priceIdr).
//
// Dipakai GenerateResult agar "Ganti Menu" (regenerate satu hari) langsung
// memperbarui bahan & estimasi harga di layar, tanpa menunggu Edge Function
// regenerate-day menghitung ulang (mis. saat fungsi belum di-redeploy).
// Logika & pembulatan dijaga identik dengan versi server supaya hasilnya konsisten.

// Bulatkan ke 2 desimal supaya akumulasi float tidak menumpuk jadi angka jelek.
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Kunci agregasi: nama + unit + kategori (unit berbeda sengaja tidak digabung).
function aggKey(name, unit, category) {
  return `${name.toLowerCase().trim()}|${unit.toLowerCase().trim()}|${category.toLowerCase().trim()}`;
}

// Port dari validate.ts subtractPantry: pencocokan berbasis token (>=3 huruf)
// supaya "ayam" tidak menghapus "bayam". Bahan dengan jumlah dikurangi; tanpa
// jumlah dianggap cukup & dibuang. Harga diskala proporsional terhadap sisa.
function subtractPantry(shoppingList, pantry) {
  if (!Array.isArray(shoppingList) || !pantry || pantry.length === 0) {
    const total = (shoppingList ?? []).reduce((s, it) => s + Number(it.estimated_price_idr ?? 0), 0);
    return { shopping_list: shoppingList ?? [], total_estimated_cost: total };
  }

  const tokenize = (s) =>
    new Set(String(s).toLowerCase().split(/[^a-z0-9]+/i).filter((t) => t.length >= 3));

  const pantryEntries = pantry
    .map((p) => ({ tokens: tokenize(p.name), amount: p.amount, name: String(p.name).toLowerCase().trim() }))
    .filter((p) => p.name.length > 0);

  const filtered = [];
  for (const item of shoppingList) {
    const rawName = String(item.ingredient ?? "").trim();
    if (!rawName) { filtered.push(item); continue; }
    const itemTokens = tokenize(rawName);
    let matchedAmount;
    let matched = false;

    for (const p of pantryEntries) {
      const shared = [...p.tokens].some((t) => itemTokens.has(t));
      if (shared || p.name === rawName.toLowerCase()) {
        matched = true;
        matchedAmount = p.amount;
        break;
      }
    }

    if (!matched) { filtered.push(item); continue; }
    if (matchedAmount == null) continue; // sudah punya di rumah → buang

    const need = Number(item.total_amount ?? 0);
    const remaining = need - matchedAmount;
    if (remaining > 0) {
      const price = Number(item.estimated_price_idr ?? 0);
      const newPrice = need > 0 ? price * (remaining / need) : price;
      filtered.push({
        ...item,
        total_amount: remaining,
        estimated_price_idr: Math.round(newPrice),
        _note: "dikurangi stok rumah",
      });
    }
  }

  const total = filtered.reduce((sum, it) => sum + Number(it.estimated_price_idr ?? 0), 0);
  return { shopping_list: filtered, total_estimated_cost: total };
}

// Susun shopping_list + total_estimated_cost dari semua meal di plan.days.
// - recipeIndex: Map<recipe_id, recipe> (shape recipeService — punya .ingredients & .baseServings).
// - pantry: [{ name, amount?, unit? }] dari input generate (opsional).
// Skala amount & harga per (servings / baseServings); baseServings default 2.
export function buildShoppingList(days, recipeIndex, pantry = []) {
  const agg = new Map();

  for (const day of days ?? []) {
    for (const meal of day.meals ?? []) {
      const recipe = recipeIndex.get(meal.recipe_id);
      if (!recipe) continue;

      const baseServings = recipe.baseServings && recipe.baseServings > 0 ? recipe.baseServings : 2;
      const wanted = Number(meal.servings);
      const factor = Number.isFinite(wanted) && wanted > 0 ? wanted / baseServings : 1;

      for (const ing of recipe.ingredients ?? []) {
        const name = String(ing.name ?? "").trim();
        if (!name) continue;
        const unit = String(ing.unit ?? "").trim();
        const category = String(ing.category ?? "dry_goods").trim();
        const amount = (Number(ing.amount) || 0) * factor;
        const price = (Number(ing.priceIdr) || 0) * factor;

        const key = aggKey(name, unit, category);
        const existing = agg.get(key);
        if (existing) {
          existing.total_amount = existing.total_amount + amount;
          existing.estimated_price_idr = existing.estimated_price_idr + price;
        } else {
          agg.set(key, {
            ingredient: name,
            total_amount: amount,
            unit,
            category,
            estimated_price_idr: price,
          });
        }
      }
    }
  }

  const shopping_list = [...agg.values()].map((item) => ({
    ...item,
    total_amount: round2(item.total_amount),
    estimated_price_idr: Math.round(item.estimated_price_idr),
  }));

  return subtractPantry(shopping_list, pantry);
}
