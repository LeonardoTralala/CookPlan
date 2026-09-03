import { supabase } from '../lib/supabase.js';
import { getPackages } from './packageService.js';
import { isStapleIngredient } from '../utils/pantryStaples.js';
import { CATEGORY_META, CATEGORY_FALLBACK, formatAmount } from '../utils/buildShoppingList.js';

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

  // 3. Kelompokkan order per bulan
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
    const ingredientsMap = new Map(); // key: nameNorm__unitNorm -> { name, category, unit, totalAmount, isStaple }

    for (const order of targetOrders) {
      const orderSubtotal = Number(order.total_price) || 0;
      const orderDelivery = Number(order.delivery_fee) || 0;
      subtotalRevenue += orderSubtotal;
      totalDeliveryFee += orderDelivery;

      const items = order.items ?? [];
      for (const it of items) {
        const itemName = String(it.name || '').trim();
        const itemNameLower = itemName.toLowerCase();
        const itemAmount = Number(it.amount) || 1;
        const itemPrice = Number(it.price_idr) || 0;

        // Cek apakah item ini merupakan paket
        const matchedPkg = packageMap.get(itemNameLower);

        if (matchedPkg) {
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
              const staple = isStapleIngredient(ing);

              if (ingredientsMap.has(mapKey)) {
                ingredientsMap.get(mapKey).totalAmount += scaledAmount;
              } else {
                // Judul rapi (kapital huruf pertama)
                const titleCased = ingName.charAt(0).toUpperCase() + ingName.slice(1);
                ingredientsMap.set(mapKey, {
                  name: titleCased,
                  category: ing.category || 'other',
                  unit: ingUnit,
                  totalAmount: scaledAmount,
                  isStaple: staple,
                });
              }
            }
          }
        } else {
          // Item langsung (bahan mentah lepasan)
          const ingUnit = String(it.unit || '').trim();
          const ingUnitLower = ingUnit.toLowerCase();
          const mapKey = `${itemNameLower}__${ingUnitLower}`;
          const staple = isStapleIngredient(it);

          if (ingredientsMap.has(mapKey)) {
            ingredientsMap.get(mapKey).totalAmount += itemAmount;
          } else {
            const titleCased = itemName.charAt(0).toUpperCase() + itemName.slice(1);
            ingredientsMap.set(mapKey, {
              name: titleCased,
              category: it.category || 'other',
              unit: ingUnit,
              totalAmount: itemAmount,
              isStaple: staple,
            });
          }
        }
      }
    }

    // Susun array paket
    const packagesBreakdown = Array.from(pkgCounts.values()).map((p) => ({
      ...p,
      percent: subtotalRevenue > 0 ? Math.round((p.revenue / subtotalRevenue) * 100) : 0
    })).sort((a, b) => b.count - a.count || b.revenue - a.revenue);

    // Susun array akumulasi bahan
    const accumulatedIngredients = Array.from(ingredientsMap.values()).map((item) => ({
      ...item,
      totalAmount: Math.round((item.totalAmount + Number.EPSILON) * 100) / 100,
      readableAmount: formatReadableAmount(item.totalAmount, item.unit),
      categoryMeta: CATEGORY_META[item.category] || CATEGORY_FALLBACK,
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      subtotalRevenue,
      totalDeliveryFee,
      grandTotal: subtotalRevenue + totalDeliveryFee,
      orderCount,
      averageOrderValue: orderCount > 0 ? Math.round(subtotalRevenue / orderCount) : 0,
      packagesBreakdown,
      accumulatedIngredients,
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
