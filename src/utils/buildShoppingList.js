// Util agregasi daftar belanja (frontend) — dipakai bersama oleh halaman Belanja
// (dari Weekly Planner) dan halaman Paket. Menggabungkan bahan dari sekumpulan
// "slot" (tiap slot punya recipe + servings), skala per (servings/base_servings),
// lalu kelompokkan per kategori.
//
// Resep dipakai dalam bentuk camelCase dari recipeService (ingredients: [{name,
// amount, unit, category, priceIdr}], baseServings).
//
// Bahan pokok dapur (air, garam, dll) dikecualikan otomatis dari daftar belanja
// — lihat utils/pantryStaples.js.

import { isStapleIngredient, pantryStapleKey } from './pantryStaples.js';

// Metadata tampilan tiap kategori bahan: label, ikon, toko lokal penyedia.
// Urutan menentukan urutan section.
export const CATEGORY_META = {
  vegetables: { label: 'Sayuran', icon: 'eco', store: 'Lembang Organic Farm' },
  meat: { label: 'Protein', icon: 'set_meal', store: 'Pasar Segar Lokal' },
  dairy: { label: 'Telur & Susu', icon: 'egg', store: 'Toko Tani Sejahtera' },
  dry_goods: { label: 'Bahan Pokok', icon: 'grocery', store: 'Toko Sembako Makmur' },
  spices: { label: 'Bumbu & Rempah', icon: 'restaurant', store: 'Pasar Modern BSD' },
};

export const CATEGORY_FALLBACK = { label: 'Lainnya', icon: 'shopping_basket', store: 'Toko Serba Ada' };

const DEFAULT_BASE_SERVINGS = 2;

export function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(num || 0);
}

// Bulatkan jumlah bahan agar rapi (max 1 desimal).
export function formatAmount(amount) {
  const rounded = Math.round((amount + Number.EPSILON) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// Agregasi daftar belanja dari kumpulan slot.
// slots: [{ recipe, servings }] — recipe shape camelCase (punya ingredients[] & baseServings).
// Return { sections, totalItems, estimatedCost, pantryItems }.
//
// pantryItems: daftar NAMA bahan pokok dapur (garam, minyak, dll) yang dikecualikan
// dari belanja & biaya — dikumpulkan terpisah sebagai reminder "cek stok di rumah".
// Tanpa jumlah/harga (staple = "secukupnya"); dedup lintas resep via pantryStapleKey.
export function buildShoppingListFromSlots(slots) {
  const itemMap = new Map(); // key: `${name}__${unit}` -> { name, unit, amount, priceIdr, category }
  const pantryMap = new Map(); // key kanonik -> nama tampil (bentuk asli pertama yang ketemu)

  for (const slot of slots ?? []) {
    const recipe = slot?.recipe;
    if (!recipe) continue;
    const base = recipe.baseServings && recipe.baseServings > 0 ? recipe.baseServings : DEFAULT_BASE_SERVINGS;
    const factor = (slot.servings || base) / base;

    for (const ing of recipe.ingredients ?? []) {
      if (isStapleIngredient(ing)) {
        // Bahan pokok dapur — tak masuk belanja/biaya, hanya dikumpulkan jadi reminder.
        const pk = pantryStapleKey(ing.name);
        if (!pantryMap.has(pk)) pantryMap.set(pk, String(ing.name ?? '').trim());
        continue;
      }
      const nameNorm = String(ing.name ?? '').trim().toLowerCase();
      const unitNorm = String(ing.unit ?? '').trim().toLowerCase();
      const key = `${nameNorm}__${unitNorm}`;
      const existing = itemMap.get(key);
      if (existing) {
        existing.amount += (Number(ing.amount) || 0) * factor;
        existing.priceIdr += (Number(ing.priceIdr) || 0) * factor;
      } else {
        itemMap.set(key, {
          name: String(ing.name ?? '').trim(),
          unit: ing.unit,
          amount: (Number(ing.amount) || 0) * factor,
          priceIdr: (Number(ing.priceIdr) || 0) * factor,
          category: ing.category,
        });
      }
    }
  }

  let estimatedCost = 0;
  itemMap.forEach((item) => {
    item.priceIdr = Math.round(item.priceIdr);
    estimatedCost += item.priceIdr;
  });

  const order = Object.keys(CATEGORY_META);
  const grouped = {};
  itemMap.forEach((item, key) => {
    const cat = order.includes(item.category) ? item.category : 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...item, id: key });
  });

  const sections = [];
  [...order, 'other'].forEach((cat) => {
    const items = grouped[cat];
    if (!items || items.length === 0) return;
    items.sort((a, b) => a.name.localeCompare(b.name, 'id'));
    sections.push({ key: cat, meta: CATEGORY_META[cat] || CATEGORY_FALLBACK, items });
  });

  const pantryItems = [...pantryMap.values()].sort((a, b) => a.localeCompare(b, 'id'));

  return { sections, totalItems: itemMap.size, estimatedCost: Math.round(estimatedCost), pantryItems };
}

// Bentuk slot dari weeklyPlan (shape PlanContext: { Senin:{breakfast,lunch,dinner}, ... }).
// recipeIndex: Map<recipeId, recipe>. Slot tanpa resep di-skip.
export function slotsFromWeeklyPlan(weeklyPlan, recipeIndex) {
  const slots = [];
  if (weeklyPlan && typeof weeklyPlan === 'object') {
    for (const daySlots of Object.values(weeklyPlan)) {
      if (!daySlots) continue;
      for (const slot of Object.values(daySlots)) {
        if (!slot) continue;
        const recipe = recipeIndex.get(slot.recipeId);
        if (recipe) slots.push({ recipe, servings: slot.servings });
      }
    }
  }
  return slots;
}

// Bentuk slot dari menu paket (package_meals yang sudah embed recipe).
// meals: [{ recipe, servings }] — biasanya servings = porsi yang di-request user.
export function slotsFromPackageMeals(meals, servings) {
  const slots = [];
  for (const m of meals ?? []) {
    if (m?.recipe) slots.push({ recipe: m.recipe, servings: servings ?? m.servings });
  }
  return slots;
}

// Ratakan sections jadi array item polos (untuk snapshot simpan daftar belanja).
export function flattenSections(sections) {
  const items = [];
  for (const s of sections ?? []) {
    for (const it of s.items ?? []) {
      items.push({
        name: it.name, amount: it.amount, unit: it.unit,
        category: it.category, priceIdr: Math.round(it.priceIdr || 0),
      });
    }
  }
  return items;
}

// Kelompokkan daftar belanja PER MENU (resep), bukan per kategori bahan.
// Resep yang sama muncul beberapa kali di plan → digabung, total porsi dijumlah.
// Return [{ recipeId, title, imageUrl, totalServings, count, items:[{name,amount,unit,priceIdr}], subtotal }].
export function buildMenuListFromSlots(slots) {
  const menuMap = new Map(); // recipeId -> { recipe, totalServings, count }
  for (const slot of slots ?? []) {
    const r = slot?.recipe;
    if (!r) continue;
    const ex = menuMap.get(r.id);
    if (ex) {
      ex.totalServings += slot.servings || (r.baseServings || DEFAULT_BASE_SERVINGS);
      ex.count += 1;
    } else {
      menuMap.set(r.id, {
        recipe: r,
        totalServings: slot.servings || (r.baseServings || DEFAULT_BASE_SERVINGS),
        count: 1,
      });
    }
  }

  const menus = [];
  for (const { recipe, totalServings, count } of menuMap.values()) {
    const base = recipe.baseServings && recipe.baseServings > 0 ? recipe.baseServings : DEFAULT_BASE_SERVINGS;
    const factor = totalServings / base;
    const items = (recipe.ingredients ?? [])
      .filter((ing) => !isStapleIngredient(ing)) // bahan pokok dapur — tak masuk belanja
      .map((ing) => ({
        name: ing.name,
        unit: ing.unit,
        amount: (Number(ing.amount) || 0) * factor,
        priceIdr: (Number(ing.priceIdr) || 0) * factor,
        category: ing.category,
      }));
    const subtotal = Math.round(items.reduce((s, i) => s + (i.priceIdr || 0), 0));
    menus.push({
      recipeId: recipe.id,
      title: recipe.title,
      imageUrl: recipe.imageUrl,
      totalServings,
      count,
      items,
      subtotal,
    });
  }
  menus.sort((a, b) => a.title.localeCompare(b.title, 'id'));
  return menus;
}
