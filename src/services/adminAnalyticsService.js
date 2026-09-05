import { supabase } from '../lib/supabase.js';
import { getPackages } from './packageService.js';
import { isStapleIngredient } from '../utils/pantryStaples.js';
import { CATEGORY_META, CATEGORY_FALLBACK, formatAmount, formatRupiah } from '../utils/buildShoppingList.js';

// Nama bulan dalam Bahasa Indonesia
const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Format string tanggal ISO ke label bulan (contoh: "2026-08" -> "Agustus 2026")
 */
export function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey === 'all') return 'Semua Periode';
  const [yearStr, monthStr] = monthKey.split('-');
  const mIndex = parseInt(monthStr, 10) - 1;
  const monthName = BULAN_NAMES[mIndex] || monthStr;
  return `${monthName} ${yearStr}`;
}

/**
 * Parse nama paket dari catatan order (mis. "Paket: Hemat 3 Hari (2 porsi/menu...)")
 */
export function parsePackageNote(notes) {
  if (!notes) return null;
  const m = /^Paket:\s*(.+?)(?:\s*\(([^)]*)\))?(?:\s*\(Catatan:.*)?$/i.exec(notes.trim());
  if (!m) return null;
  return { name: m[1].trim(), detail: (m[2] || '').trim() };
}

/**
 * Format estimasi harga satuan per kg, per liter, atau per satuan hitung
 */
export function formatUnitPrice(totalPrice, totalAmount, unit) {
  const price = Number(totalPrice) || 0;
  const amount = Number(totalAmount) || 0;
  if (price <= 0 || amount <= 0) return null;

  const u = String(unit || '').trim().toLowerCase();

  // Konversi gram -> harga per kg atau per 100g
  if (u === 'g' || u === 'gr' || u === 'gram') {
    const perGram = price / amount;
    const perKg = perGram * 1000;
    if (perKg >= 1000) {
      return `~${formatRupiah(Math.round(perKg))}/kg`;
    }
    return `~${formatRupiah(Math.round(perGram * 100))}/100g`;
  }

  // Konversi kg -> harga per kg
  if (u === 'kg' || u === 'kilo') {
    const perKg = price / amount;
    return `~${formatRupiah(Math.round(perKg))}/kg`;
  }

  // Konversi ml -> harga per liter atau per 100ml
  if (u === 'ml') {
    const perMl = price / amount;
    const perLiter = perMl * 1000;
    if (perLiter >= 1000) {
      return `~${formatRupiah(Math.round(perLiter))}/L`;
    }
    return `~${formatRupiah(Math.round(perMl * 100))}/100ml`;
  }

  // Konversi liter -> harga per liter
  if (u === 'l' || u === 'liter' || u === 'ltr') {
    const perLiter = price / amount;
    return `~${formatRupiah(Math.round(perLiter))}/L`;
  }

  // Satuan lepas (pcs, butir, lembar, buah, ikat, pack, porsi, dsb)
  const perUnit = price / amount;
  return `~${formatRupiah(Math.round(perUnit))}/${unit || 'item'}`;
}

/**
 * Format jumlah bahan yang ramah dibaca:
 * Konversi gram ke kg bila >= 1000 g, dan ml ke liter bila >= 1000 ml.
 */
export function formatReadableAmount(amount, unit) {
  const num = Number(amount) || 0;
  const u = String(unit || '').trim().toLowerCase();

  if (u === 'g' && num >= 1000) {
    const kg = num / 1000;
    const formatted = Math.round((kg + Number.EPSILON) * 100) / 100;
    return `${formatted} kg (${formatAmount(num)} g)`;
  }
  if (u === 'ml' && num >= 1000) {
    const liter = num / 1000;
    const formatted = Math.round((liter + Number.EPSILON) * 100) / 100;
    return `${formatted} L (${formatAmount(num)} ml)`;
  }
  return `${formatAmount(num)} ${unit || ''}`.trim();
}

/**
 * Mengambil analitik penjualan dan akumulasi bahan terjual.
 * Data dihitung secara deterministik dari orders yang berstatus non-draft.
 */
export async function getAdminSalesAnalytics() {
  // 1. Ambil data pesanan non-draft beserta rincian itemnya
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select(`
      id, customer_name, customer_phone, delivery_address, delivery_fee, total_price,
      output_type, order_status, payment_status, payment_method, notes, created_at,
      items:order_items ( id, name, amount, unit, category, price_idr )
    `)
    .neq('order_status', 'draft')
    .order('created_at', { ascending: false });

  if (ordersErr) throw ordersErr;

  // 2. Ambil master paket (lengkap dengan recipe dan recipe_ingredients)
  let packages = [];
  try {
    packages = await getPackages();
  } catch (e) {
    console.warn('Gagal memuat paket untuk ekspansi bahan:', e);
  }

  // Peta paket by lower-case name untuk pencarian cepat
  const packageMap = new Map();
  for (const pkg of packages) {
    if (pkg?.name) {
      packageMap.set(pkg.name.trim().toLowerCase(), pkg);
    }
  }

  // 3. Ambil master bahan sebagai sumber fallback harga bila ada item berharga 0
  const ingredientMasterMap = new Map();
  try {
    const { data: masterIngs } = await supabase
      .from('ingredients')
      .select('id, name, base_unit, price_per_base');
    for (const mi of masterIngs ?? []) {
      if (mi?.name) {
        ingredientMasterMap.set(mi.name.trim().toLowerCase(), mi);
      }
    }
  } catch (e) {
    console.warn('Gagal memuat master bahan untuk fallback harga analitik:', e);
  }

  // 4. Kelompokkan order per bulan
  const monthsMap = new Map(); // key: '2026-08' -> { monthKey, orders: [] }

  for (const o of orders ?? []) {
    const dateObj = o.created_at ? new Date(o.created_at) : new Date();
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const monthKey = `${y}-${m}`;

    if (!monthsMap.has(monthKey)) {
      monthsMap.set(monthKey, {
        monthKey,
        label: formatMonthLabel(monthKey),
        orders: []
      });
    }
    monthsMap.get(monthKey).orders.push(o);
  }

  // Daftar bulan yang terurut dari terbaru ke terlama
  const availableMonths = Array.from(monthsMap.keys()).sort().reverse();

  /**
   * Helper untuk menghitung statistik dari sekumpulan orders
   */
  function computeStats(targetOrders) {
    let subtotalRevenue = 0;
    let totalDeliveryFee = 0;
    let orderCount = targetOrders.length;
    const pkgCounts = new Map(); // pkgName -> { name, count, revenue }
    const ingredientsMap = new Map(); // key: nameNorm__unitNorm -> { name, category, unit, totalAmount, totalPrice, isStaple }

    for (const order of targetOrders) {
      const orderSubtotal = Number(order.total_price) || 0;
      const orderDelivery = Number(order.delivery_fee) || 0;
      subtotalRevenue += orderSubtotal;
      totalDeliveryFee += orderDelivery;

      const items = order.items ?? [];
      const parsedNote = parsePackageNote(order.notes);
      const notePkg = parsedNote ? packageMap.get(parsedNote.name.toLowerCase()) : null;
      let hasDirectPkgItem = false;

      for (const it of items) {
        const itemName = String(it.name || '').trim();
        const itemNameLower = itemName.toLowerCase();
        const itemAmount = Number(it.amount) || 1;
        const itemPrice = Number(it.price_idr ?? it.priceIdr) || 0;

        // Cek apakah item ini merupakan paket
        const matchedPkg = packageMap.get(itemNameLower);

        if (matchedPkg) {
          hasDirectPkgItem = true;
          // Update hitungan paket terjual
          const pkgKey = matchedPkg.name;
          if (!pkgCounts.has(pkgKey)) {
            pkgCounts.set(pkgKey, { name: pkgKey, count: 0, revenue: 0 });
          }
          const pStat = pkgCounts.get(pkgKey);
          pStat.count += itemAmount;
          pStat.revenue += itemPrice || (matchedPkg.priceIdr * itemAmount);

          // Ekspansi bahan-bahan dari menu paket
          const pkgServings = matchedPkg.baseServings && matchedPkg.baseServings > 0 ? matchedPkg.baseServings : 2;

          for (const meal of matchedPkg.meals ?? []) {
            const recipe = meal?.recipe;
            if (!recipe) continue;
            const rServings = recipe.baseServings && recipe.baseServings > 0 ? recipe.baseServings : 2;
            const scaleFactor = (pkgServings / rServings) * itemAmount;

            for (const ing of recipe.ingredients ?? []) {
              const ingName = String(ing.name || '').trim();
              if (!ingName) continue;

              const ingNameLower = ingName.toLowerCase();
              const ingUnit = String(ing.unit || '').trim();
              const ingUnitLower = ingUnit.toLowerCase();
              const mapKey = `${ingNameLower}__${ingUnitLower}`;

              const scaledAmount = (Number(ing.amount) || 0) * scaleFactor;
              const scaledPrice = (Number(ing.priceIdr ?? ing.price_idr) || 0) * scaleFactor;
              const staple = isStapleIngredient(ing);

              if (ingredientsMap.has(mapKey)) {
                const target = ingredientsMap.get(mapKey);
                target.totalAmount += scaledAmount;
                target.totalPrice += scaledPrice;
              } else {
                // Judul rapi (kapital huruf pertama)
                const titleCased = ingName.charAt(0).toUpperCase() + ingName.slice(1);
                ingredientsMap.set(mapKey, {
                  name: titleCased,
                  category: ing.category || 'other',
                  unit: ingUnit,
                  totalAmount: scaledAmount,
                  totalPrice: scaledPrice,
                  isStaple: staple,
                });
              }
            }
          }
        } else {
          // Item langsung (bahan mentah lepasan atau add-on belanja)
          const ingUnit = String(it.unit || '').trim();
          const ingUnitLower = ingUnit.toLowerCase();
          const mapKey = `${itemNameLower}__${ingUnitLower}`;
          const staple = isStapleIngredient(it);

          if (ingredientsMap.has(mapKey)) {
            const target = ingredientsMap.get(mapKey);
            target.totalAmount += itemAmount;
            target.totalPrice += itemPrice;
          } else {
            const titleCased = itemName.charAt(0).toUpperCase() + itemName.slice(1);
            ingredientsMap.set(mapKey, {
              name: titleCased,
              category: it.category || 'other',
              unit: ingUnit,
              totalAmount: itemAmount,
              totalPrice: itemPrice,
              isStaple: staple,
            });
          }
        }
      }

      // Bila item-itemnya adalah rincian bahan langsung (bukan paket) tapi notes mencatat paket,
      // tambahkan ke hitungan distribusi paket
      if (!hasDirectPkgItem && notePkg) {
        const pkgKey = notePkg.name;
        if (!pkgCounts.has(pkgKey)) {
          pkgCounts.set(pkgKey, { name: pkgKey, count: 0, revenue: 0 });
        }
        const pStat = pkgCounts.get(pkgKey);
        pStat.count += 1;
        pStat.revenue += orderSubtotal || (notePkg.priceIdr || 0);
      }
    }

    // Susun array paket
    const packagesBreakdown = Array.from(pkgCounts.values()).map((p) => ({
      ...p,
      percent: subtotalRevenue > 0 ? Math.round((p.revenue / subtotalRevenue) * 100) : 0
    })).sort((a, b) => b.count - a.count || b.revenue - a.revenue);

    // Susun array akumulasi bahan dan lengkapi harga asli (modal), harga jual (dinaikkan), serta margin
    const accumulatedIngredients = Array.from(ingredientsMap.values()).map((item) => {
      let finalPrice = item.totalPrice;
      const master = ingredientMasterMap.get(item.name.toLowerCase());

      // Fallback jika totalPrice 0 tapi bukan bumbu dapur dasar dan terdaftar di master bahan
      if (finalPrice <= 0 && !item.isStaple) {
        if (master?.price_per_base && master.price_per_base > 0) {
          const u = (item.unit || '').toLowerCase();
          const b = (master.base_unit || '').toLowerCase();
          if (u === b) {
            finalPrice = item.totalAmount * master.price_per_base;
          } else if ((u === 'kg' || u === 'kilo') && b === 'g') {
            finalPrice = item.totalAmount * 1000 * master.price_per_base;
          } else if (u === 'g' && (b === 'kg' || b === 'kilo')) {
            finalPrice = (item.totalAmount / 1000) * master.price_per_base;
          } else if ((u === 'l' || u === 'liter') && b === 'ml') {
            finalPrice = item.totalAmount * 1000 * master.price_per_base;
          } else if (u === 'ml' && (b === 'l' || b === 'liter')) {
            finalPrice = (item.totalAmount / 1000) * master.price_per_base;
          }
        }
      }

      // Hitung harga asli (modal dasar / HPP beli)
      let finalCost = 0;
      if (!item.isStaple) {
        if (master?.cost_price_per_base != null && Number(master.cost_price_per_base) > 0) {
          const costBase = Number(master.cost_price_per_base);
          const priceBase = Number(master.price_per_base) || 0;

          if (priceBase > 0 && finalPrice > 0) {
            // Rasio modal vs jual untuk akurasi porsi paket
            finalCost = finalPrice * (costBase / priceBase);
          } else {
            // Hitung proporsional terhadap satuan dasar
            const u = (item.unit || '').toLowerCase();
            const b = (master.base_unit || '').toLowerCase();
            if (u === b) {
              finalCost = item.totalAmount * costBase;
            } else if ((u === 'kg' || u === 'kilo') && b === 'g') {
              finalCost = item.totalAmount * 1000 * costBase;
            } else if (u === 'g' && (b === 'kg' || b === 'kilo')) {
              finalCost = (item.totalAmount / 1000) * costBase;
            } else if ((u === 'l' || u === 'liter') && b === 'ml') {
              finalCost = item.totalAmount * 1000 * costBase;
            } else if (u === 'ml' && (b === 'l' || b === 'liter')) {
              finalCost = (item.totalAmount / 1000) * costBase;
            } else {
              finalCost = item.totalAmount * costBase;
            }
          }
        } else if (finalPrice > 0) {
          // Baseline modal CookPlan: harga jual / 1.3 (markup 30%)
          finalCost = finalPrice / 1.3;
        }
      }

      const roundedAmount = Math.round((item.totalAmount + Number.EPSILON) * 100) / 100;
      const roundedPrice = Math.round(finalPrice || 0);
      const roundedCost = Math.round(finalCost || 0);
      const margin = Math.max(0, roundedPrice - roundedCost);
      const markupPct = roundedCost > 0 ? ((roundedPrice - roundedCost) / roundedCost) * 100 : 0;
      const marginPct = roundedPrice > 0 ? ((roundedPrice - roundedCost) / roundedPrice) * 100 : 0;

      return {
        ...item,
        totalAmount: roundedAmount,
        totalCost: roundedCost,       // Harga Asli (Modal / HPP)
        totalPrice: roundedPrice,     // Harga yang Sudah Dinaikkan (Harga Jual / Retail)
        margin,                       // Selisih Laba Nominal
        markupPct: Math.round(markupPct * 10) / 10,
        marginPct: Math.round(marginPct * 10) / 10,
        readableAmount: formatReadableAmount(roundedAmount, item.unit),
        unitCostLabel: formatUnitPrice(roundedCost, roundedAmount, item.unit),
        unitPriceLabel: formatUnitPrice(roundedPrice, roundedAmount, item.unit),
        categoryMeta: CATEGORY_META[item.category] || CATEGORY_FALLBACK,
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);

    const totalIngredientsValue = accumulatedIngredients.reduce(
      (sum, it) => sum + (it.totalPrice || 0),
      0
    );
    const totalIngredientsCost = accumulatedIngredients.reduce(
      (sum, it) => sum + (it.totalCost || 0),
      0
    );
    const totalIngredientsMargin = Math.max(0, totalIngredientsValue - totalIngredientsCost);

    return {
      subtotalRevenue,
      totalDeliveryFee,
      grandTotal: subtotalRevenue + totalDeliveryFee,
      orderCount,
      averageOrderValue: orderCount > 0 ? Math.round(subtotalRevenue / orderCount) : 0,
      packagesBreakdown,
      accumulatedIngredients,
      totalIngredientsValue,
      totalIngredientsCost,
      totalIngredientsMargin,
    };
  }

  // Hitung untuk 'all' (semua periode)
  const allStats = computeStats(orders ?? []);

  // Hitung untuk masing-masing bulan
  const byMonth = {};
  for (const [monthKey, mData] of monthsMap.entries()) {
    byMonth[monthKey] = {
      monthKey,
      label: mData.label,
      ...computeStats(mData.orders),
    };
  }

  return {
    availableMonths,
    allStats,
    byMonth,
  };
}
