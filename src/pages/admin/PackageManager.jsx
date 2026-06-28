import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkIsAdmin } from '../../services/adminService.js';
import * as packageAdmin from '../../services/adminPackageService.js';
import { slugify } from '../../services/adminPackageService.js';
import { usePlan } from '../../hooks/usePlan.js';
import {
  buildShoppingListFromSlots, slotsFromPackageMeals, formatRupiah,
} from '../../utils/buildShoppingList.js';

// Slot waktu makan: urutan menentukan slot mana yang tampil saat meals_per_day < 3.
const MEAL_TYPES = [
  { value: 'breakfast', label: 'Sarapan' },
  { value: 'lunch', label: 'Makan Siang' },
  { value: 'dinner', label: 'Makan Malam' },
];

const EMPTY_PACKAGE = {
  slug: '', name: '', description: '',
  periodeDays: 3, mealsPerDay: 3, baseServings: 2,
  priceIdr: 0, imageUrl: '', badges: [], sortOrder: 0, isActive: true,
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || min));
const numOrZero = (v) => (v === '' || v == null ? 0 : Number(v));

// Hitung perkiraan harga paket (agregasi recipe_ingredients menu × base_servings).
function packageCost(pkg) {
  const slots = slotsFromPackageMeals(pkg.meals, pkg.baseServings);
  return buildShoppingListFromSlots(slots).estimatedCost;
}

// Admin UI: kelola Paket "Belanja di Kami" (metadata + menu fiks per hari).
// Tulis langsung lewat RLS admin (adminPackageService) — tanpa Edge Function.
export function PackageManager() {
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [allowed, setAllowed] = useState(null); // null=checking
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [recipeOptions, setRecipeOptions] = useState([]);
  const recipeIndex = useMemo(() => {
    const m = new Map();
    for (const r of recipeOptions) m.set(r.id, r);
    return m;
  }, [recipeOptions]);

  const [editing, setEditing] = useState(null); // package camelCase | null
  const [menu, setMenu] = useState({}); // key `${day}-${mealType}` -> recipeId (string)
  const [saving, setSaving] = useState(false);
  // Teks mentah badge yang sedang diketik (STRING) — biar koma/spasi tetap utuh saat
  // mengetik; konversi ke array baru saat Simpan (lihat handleSave), bukan tiap keystroke.
  const [badgesRaw, setBadgesRaw] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPackages(await packageAdmin.listAllPackages());
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => {
      if (!active) return;
      setAllowed(ok);
      if (ok) {
        refresh();
        packageAdmin.listRecipeOptions()
          .then((d) => { if (active) setRecipeOptions(d); })
          .catch((e) => { if (active) showToast(e.message, { variant: 'error' }); });
      }
    });
    return () => { active = false; };
  }, [refresh, showToast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter((p) => p.name?.toLowerCase().includes(q));
  }, [packages, query]);

  const openCreate = () => {
    setEditing({ ...EMPTY_PACKAGE });
    setMenu({});
    setBadgesRaw('');
  };

  const openEdit = (p) => {
    setEditing({ ...EMPTY_PACKAGE, ...p });
    setBadgesRaw((p.badges ?? []).join(', '));
    const next = {};
    for (const m of p.meals ?? []) {
      if (m.recipe?.id) next[`${m.dayIndex}-${m.mealType}`] = String(m.recipe.id);
    }
    setMenu(next);
  };

  const closeForm = () => { setEditing(null); setMenu({}); };

  const setField = (key, val) => setEditing((p) => ({ ...p, [key]: val }));
  const setMenuCell = (day, mealType, recipeId) =>
    setMenu((prev) => ({ ...prev, [`${day}-${mealType}`]: recipeId }));

  // Slot menu yang aktif (dalam periode & jumlah makan/hari). Sumber kebenaran
  // saat render grid, hitung harga, dan simpan — sel di luar ini diabaikan.
  const visibleMealTypes = useMemo(
    () => MEAL_TYPES.slice(0, clamp(editing?.mealsPerDay ?? 3, 1, 3)),
    [editing?.mealsPerDay]
  );
  const days = useMemo(
    () => Array.from({ length: clamp(editing?.periodeDays ?? 1, 1, 7) }, (_, i) => i),
    [editing?.periodeDays]
  );

  // Kumpulkan menu dari sel yang terlihat → [{ dayIndex, mealType, recipeId }].
  const collectMeals = useCallback(() => {
    const meals = [];
    for (const day of days) {
      for (const mt of visibleMealTypes) {
        const rid = menu[`${day}-${mt.value}`];
        if (rid) meals.push({ dayIndex: day, mealType: mt.value, recipeId: rid });
      }
    }
    return meals;
  }, [days, visibleMealTypes, menu]);

  // Preview harga live: skala harga di base_servings (acuan harga paket).
  const { previewCost, filledSlots, totalSlots } = useMemo(() => {
    if (!editing) return { previewCost: 0, filledSlots: 0, totalSlots: 0 };
    const meals = [];
    let filled = 0;
    for (const day of days) {
      for (const mt of visibleMealTypes) {
        const rid = menu[`${day}-${mt.value}`];
        if (!rid) continue;
        filled += 1;
        const recipe = recipeIndex.get(Number(rid));
        if (recipe) meals.push({ recipe });
      }
    }
    const slots = slotsFromPackageMeals(meals, editing.baseServings);
    return {
      previewCost: buildShoppingListFromSlots(slots).estimatedCost,
      filledSlots: filled,
      totalSlots: days.length * visibleMealTypes.length,
    };
  }, [editing, days, visibleMealTypes, menu, recipeIndex]);

  const handleSave = async () => {
    if (!editing.name?.trim()) {
      showToast('Nama paket wajib diisi.', { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const patch = {
        name: editing.name.trim(),
        description: editing.description?.trim() || null,
        periodeDays: clamp(editing.periodeDays, 1, 7),
        mealsPerDay: clamp(editing.mealsPerDay, 1, 3),
        baseServings: clamp(editing.baseServings, 1, 20),
        priceIdr: Math.round(numOrZero(editing.priceIdr)),
        imageUrl: editing.imageUrl?.trim() || null,
        // Teks mentah → array bersih HANYA saat simpan (jaga bentuk data DB sama spt dulu).
        badges: splitCsv(badgesRaw),
        sortOrder: Math.round(numOrZero(editing.sortOrder)),
        isActive: editing.isActive,
      };

      let id = editing.id;
      if (id) {
        await packageAdmin.updatePackage(id, patch);
      } else {
        // Slug = key permanen; auto dari nama bila kosong.
        patch.slug = (editing.slug?.trim() ? slugify(editing.slug) : slugify(editing.name)) || `paket-${Date.now()}`;
        id = await packageAdmin.createPackage(patch);
      }

      await packageAdmin.setPackageMeals(id, collectMeals());

      showToast(editing.id ? 'Paket diperbarui.' : 'Paket ditambahkan.');
      closeForm();
      refresh();
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Hapus paket "${p.name}"? Menu paketnya ikut terhapus. Tindakan ini permanen.`)) return;
    try {
      await packageAdmin.deletePackage(p.id);
      showToast('Paket dihapus.');
      refresh();
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    }
  };

  if (allowed === null) {
    return <div className="flex justify-center py-24"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>;
  }
  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto px-5 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-4">lock</span>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">Khusus Admin</h1>
        <p className="text-on-surface-variant text-sm mb-6">Halaman ini hanya untuk admin CookPlan.</p>
        <button onClick={() => navigate('/generate')} className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer">Kembali</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl">shopping_bag</span>
            Kelola Paket
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">Paket "Belanja di Kami" — atur menu fiks & periode.</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer inline-flex items-center gap-1.5 shrink-0">
          <span className="material-symbols-outlined text-[20px]">add</span> Tambah
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari paket…"
        className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
      />

      {loading ? (
        <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-sm text-on-surface-variant py-8">Belum ada paket.</p>}
          {filtered.map((p) => (
            <div key={p.id} className={`rounded-2xl border p-3 flex items-center gap-3 ${p.isActive ? 'border-outline-variant' : 'border-error/30 bg-error/5'}`}>
              <div className="w-14 h-14 rounded-xl bg-surface-container-high overflow-hidden shrink-0 flex items-center justify-center">
                {p.imageUrl
                  ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <span className="material-symbols-outlined text-on-surface-variant">shopping_bag</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-on-surface truncate">{p.name}</span>
                  {!p.isActive && <span className="text-[10px] font-bold uppercase bg-error text-white px-2 py-0.5 rounded-full">Disembunyikan</span>}
                  {(p.badges ?? []).map((b) => (
                    <span key={b} className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded-full">{b}</span>
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {p.periodeDays} hari · {p.mealsPerDay}× makan/hari · {p.meals?.length ?? 0} menu · ~{formatRupiah(packageCost(p))}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(p)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low cursor-pointer">Edit</button>
                <button onClick={() => handleDelete(p)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-error/40 text-error hover:bg-error/10 cursor-pointer">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-on-surface/60 backdrop-blur-sm" onClick={closeForm}>
          <div className="bg-white w-full max-w-2xl rounded-t-3xl md:rounded-3xl p-6 max-h-[92dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-headline-md text-headline-md text-primary mb-4">{editing.id ? 'Edit Paket' : 'Tambah Paket'}</h2>

            <div className="space-y-3">
              <Field label="Nama paket">
                <TextInput value={editing.name} onChange={(v) => setField('name', v)} placeholder="Paket Hemat 3 Hari" />
              </Field>
              <Field label="Deskripsi">
                <textarea
                  value={editing.description ?? ''}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={2}
                  placeholder="Menu rumahan hemat untuk 3 hari. Bahan lengkap kami siapkan."
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Periode (hari)">
                  <TextInput type="number" value={editing.periodeDays} onChange={(v) => setField('periodeDays', v)} />
                </Field>
                <Field label="Makan / hari">
                  <TextInput type="number" value={editing.mealsPerDay} onChange={(v) => setField('mealsPerDay', v)} />
                </Field>
                <Field label="Porsi dasar">
                  <TextInput type="number" value={editing.baseServings} onChange={(v) => setField('baseServings', v)} />
                </Field>
              </div>

              <Field label="Badge tampilan (pisahkan dengan koma)">
                <TextInput value={badgesRaw} onChange={setBadgesRaw} placeholder="Hemat, Populer" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Urutan tampil (sort)">
                  <TextInput type="number" value={editing.sortOrder} onChange={(v) => setField('sortOrder', v)} />
                </Field>
                <Field label="Harga tampilan (opsional)">
                  <TextInput type="number" value={editing.priceIdr} onChange={(v) => setField('priceIdr', v)} placeholder="0 = pakai harga otomatis" />
                </Field>
              </div>

              <Field label="URL Foto (opsional)">
                <TextInput value={editing.imageUrl ?? ''} onChange={(v) => setField('imageUrl', v)} placeholder="https://…" />
              </Field>

              {editing.id && (
                <p className="text-[11px] text-on-surface-variant">Slug (key permanen): <code className="text-on-surface">{editing.slug}</code></p>
              )}

              {/* Harga terhitung otomatis dari bahan resep menu */}
              <div className="flex items-center justify-between rounded-xl bg-surface-container-low border border-outline-variant px-4 py-2.5">
                <span className="text-xs font-semibold text-on-surface">Perkiraan harga (otomatis dari bahan menu)</span>
                <span className="font-bold text-primary">{formatRupiah(previewCost)}</span>
              </div>

              {/* Menu fiks: grid hari × waktu makan, pilih resep tiap slot */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-xs font-semibold text-on-surface">Menu Fiks</span>
                  <span className="text-[11px] text-on-surface-variant">{filledSlots}/{totalSlots} slot terisi</span>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2">Pilih resep katalog untuk tiap waktu makan. Slot yang dikosongkan tidak masuk paket. Harga & bahan ikut resep.</p>
                <div className="space-y-3">
                  {days.map((day) => (
                    <div key={day} className="rounded-xl border border-outline-variant overflow-hidden">
                      <div className="px-3 py-2 bg-surface-cream text-primary font-bold text-xs">Hari {day + 1}</div>
                      <div className="divide-y divide-outline-variant/50">
                        {visibleMealTypes.map((mt) => (
                          <div key={mt.value} className="flex items-center gap-2 p-2.5">
                            <span className="text-xs font-semibold text-on-surface-variant w-24 shrink-0">{mt.label}</span>
                            <select
                              value={menu[`${day}-${mt.value}`] ?? ''}
                              onChange={(e) => setMenuCell(day, mt.value, e.target.value)}
                              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">— pilih resep —</option>
                              {recipeOptions.map((r) => (
                                <option key={r.id} value={String(r.id)}>{r.title}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer pt-1">
                <input type="checkbox" checked={!editing.isActive} onChange={(e) => setField('isActive', !e.target.checked)} />
                Sembunyikan dari "Belanja di Kami" (is_active = false)
              </label>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={closeForm} disabled={saving} className="flex-1 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm cursor-pointer disabled:opacity-50">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {saving && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function splitCsv(v) {
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-on-surface mb-1">{label}</span>
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
    />
  );
}
