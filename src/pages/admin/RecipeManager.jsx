import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkIsAdmin } from '../../services/adminService.js';
import * as recipeAdmin from '../../services/adminRecipeService.js';
import * as ingredientService from '../../services/ingredientService.js';
import { parseIngredient } from '../../utils/parseIngredient.js';
import { usePlan } from '../../hooks/usePlan.js';
import { formatRupiah } from '../../utils/buildShoppingList.js';

const DIFFICULTIES = [
  { value: 'easy', label: 'Mudah' },
  { value: 'medium', label: 'Sedang' },
  { value: 'hard', label: 'Sulit' },
];

const EMPTY_RECIPE = {
  title: '', description: '', cuisine: '', difficulty: 'easy',
  readyInMinutes: '', calories: '', baseServings: 2,
  badges: [], tags: [], instructions: [], ingredientsText: '',
  imageUrl: '', isActive: true, isVerified: false,
};

const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
let rowKey = 0;
// priceIdr di baris = biaya terhitung (read-only, dari trigger); _id = id baris existing.
const newRow = () => ({ _key: `r${++rowKey}`, _id: null, ingredientId: null, name: '', amount: '', unit: '', category: '', priceIdr: null, rawText: '' });

// Dimensi base_unit (selaras unit_conversions.dimension).
const BASE_DIM = { g: 'mass', ml: 'volume', pcs: 'count' };

// Preview biaya baris di KLIEN — mirror persis fungsi DB resolve_ingredient_cost
// (override per-bahan → unit==base → unit_conversions sedimensi). Dipakai supaya
// admin lihat hasil sebelum simpan + tahu PERSIS kenapa belum terhitung.
// status: 'ok' | 'new' | 'unpriced' | 'no-qty' | 'bad-unit'.
function resolveRowCost(row, { masterById, convByUnit, ovByIng }) {
  const ing = row.ingredientId ? masterById.get(row.ingredientId) : null;
  if (!ing) return { status: 'new', price: null };
  if (ing.pricePerBase == null) return { status: 'unpriced', price: null };
  const amt = Number(row.amount);
  const unit = String(row.unit ?? '').trim().toLowerCase();
  if (!row.amount || Number.isNaN(amt) || !unit) return { status: 'no-qty', price: null };
  let factor = ovByIng.get(ing.id)?.get(unit);
  if (factor == null && unit === ing.baseUnit) factor = 1;
  if (factor == null) {
    const c = convByUnit.get(unit);
    if (c && c.dimension === BASE_DIM[ing.baseUnit]) factor = c.toBaseFactor;
  }
  if (factor == null) return { status: 'bad-unit', price: null };
  return { status: 'ok', price: Math.round(amt * factor * Number(ing.pricePerBase)) };
}

// Satuan yang VALID untuk sebuah bahan (base + override + konversi global sedimensi).
function unitOptionsFor(ing, { convByUnit, ovByIng }) {
  if (!ing) return [];
  const set = new Set();
  if (ing.baseUnit) set.add(ing.baseUnit);
  ovByIng.get(ing.id)?.forEach((_, u) => set.add(u));
  const dim = BASE_DIM[ing.baseUnit];
  convByUnit.forEach((c, u) => { if (c.dimension === dim) set.add(u); });
  return [...set];
}

// Tampilan status biaya per baris (warna + makna jelas → tim tahu apa yang difix).
const STATUS_META = {
  ok:         { cls: 'bg-primary/10 text-primary', icon: 'check_circle' },
  new:        { cls: 'bg-blue-50 text-blue-700', icon: 'add_circle', label: 'bahan baru' },
  unpriced:   { cls: 'bg-error/10 text-error', icon: 'price_change', label: 'belum berharga' },
  'no-qty':   { cls: 'bg-surface-container-high text-on-surface-variant', icon: 'edit', label: 'isi jml/satuan' },
  'bad-unit': { cls: 'bg-amber-50 text-amber-700', icon: 'help', label: 'satuan?' },
};

// Coverage harga sebuah resep dari bahan-bahannya (priceIdr per baris sudah ikut
// RECIPE_SELECT). Dipakai badge daftar resep agar tim cepat lihat mana yang perlu digarap.
function coverageOf(r) {
  const ings = r.ingredients ?? [];
  const total = ings.length;
  const priced = ings.filter((x) => x.priceIdr != null).length;
  return { priced, total };
}

function CoverageBadge({ priced, total }) {
  if (!total) {
    return <span className="text-[10px] font-bold uppercase bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">tanpa bahan</span>;
  }
  const pct = Math.round((priced / total) * 100);
  const cls = pct === 100 ? 'bg-primary/10 text-primary' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-error/10 text-error';
  return (
    <span title={`${priced} dari ${total} bahan sudah terhitung biayanya (${pct}%)`} className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${cls}`}>
      <span className="material-symbols-outlined text-[13px] leading-none">{pct === 100 ? 'task_alt' : 'pending'}</span>{priced}/{total}
    </span>
  );
}

function RowStatusChip({ cost, unitOpts, onFix }) {
  const meta = STATUS_META[cost.status] ?? STATUS_META.new;
  const baseTitle =
    cost.status === 'bad-unit' ? `Satuan tak dikenali untuk bahan ini. Pakai: ${unitOpts.slice(0, 10).join(', ')}` :
    cost.status === 'unpriced' ? 'Bahan ada di Master tapi belum diisi harga.' :
    cost.status === 'new' ? 'Bahan belum ada di Master — akan dibuat otomatis saat simpan.' :
    cost.status === 'no-qty' ? 'Isi jumlah & satuan supaya biaya terhitung.' : 'Terhitung dari Master Bahan.';
  const cls = `inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold max-w-full ${meta.cls}`;
  const inner = (
    <>
      <span className="material-symbols-outlined text-[14px] leading-none">{onFix ? 'build' : meta.icon}</span>
      <span className="truncate">{cost.status === 'ok' ? formatRupiah(cost.price) : meta.label}</span>
    </>
  );
  if (onFix) {
    return <button type="button" onClick={onFix} title={`${baseTitle} Klik untuk perbaiki di sini.`} className={`${cls} cursor-pointer hover:brightness-95`}>{inner}</button>;
  }
  return <span title={baseTitle} className={cls}>{inner}</span>;
}

// Admin UI: kelola bank resep (harga, foto, deskripsi, bahan, langkah).
// Tulis langsung lewat RLS admin (adminRecipeService) — tanpa Edge Function.
export function RecipeManager() {
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [allowed, setAllowed] = useState(null); // null=checking
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [status, setStatus] = useState('all'); // all | active | hidden
  const [verify, setVerify] = useState('all'); // all | verified | unverified
  const [sort, setSort] = useState('default'); // default | coverage | name

  const [editing, setEditing] = useState(null); // recipe camelCase | null
  const [ingredients, setIngredients] = useState([]);
  const [origIds, setOrigIds] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  // Teks mentah yang sedang diketik untuk field bertipe array (tag, badge, langkah).
  // Disimpan sebagai STRING agar Enter/koma/baris kosong tetap utuh saat mengetik —
  // konversi ke array baru dilakukan saat Simpan (lihat handleSave), bukan tiap keystroke.
  const [tagsRaw, setTagsRaw] = useState('');
  const [badgesRaw, setBadgesRaw] = useState('');
  const [instructionsRaw, setInstructionsRaw] = useState('');
  // Quick-fix dari chip status baris: { rowKey, ing, kind:'price'|'unit', unit, value }.
  const [quickFix, setQuickFix] = useState(null);
  const [quickSaving, setQuickSaving] = useState(false);

  // Master bahan (untuk picker + resolusi ingredient_id by nama). Dimuat sekali.
  const [master, setMaster] = useState([]);
  const [aliases, setAliases] = useState([]); // {alias, ingredientId}
  const [conversions, setConversions] = useState([]); // {unit, dimension, toBaseFactor}
  const [overrides, setOverrides] = useState([]); // {ingredientId, unit, factorToBase}
  const masterByName = useMemo(() => {
    const m = new Map();
    for (const ing of master) m.set(ing.name.trim().toLowerCase(), ing);
    return m;
  }, [master]);
  const masterById = useMemo(() => {
    const m = new Map();
    for (const ing of master) m.set(ing.id, ing);
    return m;
  }, [master]);
  const convByUnit = useMemo(() => {
    const m = new Map();
    for (const c of conversions) m.set(c.unit, c);
    return m;
  }, [conversions]);
  const ovByIng = useMemo(() => {
    const m = new Map();
    for (const o of overrides) {
      if (!m.has(o.ingredientId)) m.set(o.ingredientId, new Map());
      m.get(o.ingredientId).set(o.unit, Number(o.factorToBase));
    }
    return m;
  }, [overrides]);
  const costCtx = useMemo(() => ({ masterById, convByUnit, ovByIng }), [masterById, convByUnit, ovByIng]);
  // Biaya tiap baris dihitung live (klien) untuk feedback instan saat mengedit.
  const rowCosts = useMemo(() => {
    const m = new Map();
    for (const r of ingredients) m.set(r._key, resolveRowCost(r, costCtx));
    return m;
  }, [ingredients, costCtx]);
  const liveSummary = useMemo(() => {
    const named = ingredients.filter((r) => r.name?.trim());
    let total = 0, priced = 0;
    for (const r of named) {
      const c = rowCosts.get(r._key);
      if (c?.status === 'ok') { total += c.price; priced += 1; }
    }
    return { total, priced, count: named.length };
  }, [ingredients, rowCosts]);
  const aliasToId = useMemo(() => {
    const m = new Map();
    for (const a of aliases) m.set(a.alias, a.ingredientId);
    return m;
  }, [aliases]);
  // Cocokkan nama bersih ke master: nama kanonik dulu, lalu alias (sinonim).
  const findMaster = useCallback((name) => {
    const key = name.trim().toLowerCase();
    if (masterByName.has(key)) return masterByName.get(key);
    const id = aliasToId.get(key);
    return id ? (master.find((x) => x.id === id) ?? { id }) : null;
  }, [masterByName, aliasToId, master]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRecipes(await recipeAdmin.listAllRecipes());
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
        ingredientService.listIngredients().then((d) => { if (active) setMaster(d); }).catch(() => {});
        ingredientService.listAllAliases().then((d) => { if (active) setAliases(d); }).catch(() => {});
        ingredientService.listConversions().then((d) => { if (active) setConversions(d); }).catch(() => {});
        ingredientService.listAllOverrides().then((d) => { if (active) setOverrides(d); }).catch(() => {});
      }
    });
    return () => { active = false; };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = recipes.filter((r) => {
      if (q && !r.title?.toLowerCase().includes(q)) return false;
      if (status === 'active' && !r.isActive) return false;
      if (status === 'hidden' && r.isActive) return false;
      if (verify === 'verified' && !r.isVerified) return false;
      if (verify === 'unverified' && r.isVerified) return false;
      if (onlyIncomplete) {
        const { priced, total } = coverageOf(r);
        if (total > 0 && priced >= total) return false; // sudah lengkap → sembunyikan
      }
      return true;
    });
    if (sort === 'coverage') {
      // coverage terendah dulu (yang paling perlu digarap di atas); tanpa bahan = paling atas.
      const ratio = (r) => { const { priced, total } = coverageOf(r); return total ? priced / total : -1; };
      return [...list].sort((a, b) => ratio(a) - ratio(b));
    }
    if (sort === 'name') return [...list].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    return list;
  }, [recipes, query, onlyIncomplete, status, verify, sort]);
  const incompleteCount = useMemo(
    () => recipes.filter((r) => { const { priced, total } = coverageOf(r); return total === 0 || priced < total; }).length,
    [recipes],
  );

  const openCreate = () => {
    setEditing({ ...EMPTY_RECIPE });
    setIngredients([newRow()]);
    setOrigIds([]);
    setImageFile(null);
    setImagePreview('');
    setTagsRaw('');
    setBadgesRaw('');
    setInstructionsRaw('');
  };

  const openEdit = async (r) => {
    setEditing({ ...EMPTY_RECIPE, ...r });
    setImageFile(null);
    setImagePreview(r.imageUrl || '');
    setIngredients([]);
    setOrigIds([]);
    // Isi teks mentah dari array DB: tag/badge dipisah ", ", langkah per baris.
    setTagsRaw((r.tags ?? []).join(', '));
    setBadgesRaw((r.badges ?? []).join(', '));
    setInstructionsRaw((r.instructions ?? []).join('\n'));
    try {
      const rows = await recipeAdmin.listIngredients(r.id);
      setIngredients(rows.map((x) => ({ ...x, _key: `e${x.id}`, _id: x.id })));
      setOrigIds(rows.map((x) => x.id));
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    }
  };

  const closeForm = () => { setEditing(null); setImageFile(null); setImagePreview(''); };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const setField = (key, val) => setEditing((p) => ({ ...p, [key]: val }));

  const setIngredient = (key, field, val) =>
    setIngredients((rows) => rows.map((r) => (r._key === key ? { ...r, [field]: val } : r)));
  // Saat nama bahan dipilih/ketik, cocokkan ke master → isi ingredientId, kategori,
  // dan sarankan satuan dasar bila satuan baris masih kosong.
  const setIngredientName = (key, name) =>
    setIngredients((rows) => rows.map((r) => {
      if (r._key !== key) return r;
      const m = findMaster(name);
      return {
        ...r, name,
        ingredientId: m?.id ?? null,
        category: m ? (m.category ?? r.category) : r.category,
        unit: r.unit || (m?.baseUnit ?? ''),
      };
    }));
  const addRow = () => setIngredients((rows) => [...rows, newRow()]);
  const removeRow = (key) => setIngredients((rows) => rows.filter((r) => r._key !== key));

  // Perbaiki bahan dari chip status tanpa pindah halaman: isi harga master (status
  // 'unpriced') atau tambah konversi satuan (status 'bad-unit'). Setelah simpan,
  // master/override lokal diperbarui → preview biaya baris langsung ikut terhitung.
  const openQuickFix = (row, cost) => {
    const ing = masterById.get(row.ingredientId);
    if (!ing) return;
    if (cost.status === 'unpriced') setQuickFix({ rowKey: row._key, ing, kind: 'price', value: '' });
    else if (cost.status === 'bad-unit') setQuickFix({ rowKey: row._key, ing, kind: 'unit', unit: String(row.unit ?? '').trim().toLowerCase(), value: '' });
  };
  const saveQuickFix = async () => {
    if (!quickFix) return;
    const val = Number(quickFix.value);
    if (quickFix.value === '' || Number.isNaN(val) || val < 0) { showToast('Angka tidak valid.', { variant: 'error' }); return; }
    setQuickSaving(true);
    try {
      if (quickFix.kind === 'price') {
        await ingredientService.updateIngredient(quickFix.ing.id, { pricePerBase: val });
        setMaster((m) => m.map((x) => (x.id === quickFix.ing.id ? { ...x, pricePerBase: val } : x)));
        showToast('Harga bahan disimpan.');
      } else {
        if (!quickFix.unit) { showToast('Satuan kosong.', { variant: 'error' }); setQuickSaving(false); return; }
        await ingredientService.upsertOverride(quickFix.ing.id, quickFix.unit, val);
        setOverrides((o) => [
          ...o.filter((x) => !(x.ingredientId === quickFix.ing.id && x.unit === quickFix.unit)),
          { ingredientId: quickFix.ing.id, unit: quickFix.unit, factorToBase: val },
        ]);
        showToast('Konversi satuan disimpan.');
      }
      setQuickFix(null);
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setQuickSaving(false);
    }
  };

  // Saat selesai mengetik/menempel nama (blur): pisahkan kuantitas & bersihkan nama
  // via parser kanonik supaya "100 ml air" → nama "air" + jml 100 + satuan ml, bukan
  // jadi baris master mentah. Teks asli disimpan ke rawText (provenance). Hanya isi
  // jml/satuan bila masih kosong (jangan timpa input admin).
  const applyParseToRow = (key) =>
    setIngredients((rows) => rows.map((r) => {
      if (r._key !== key || !r.name?.trim()) return r;
      const p = parseIngredient(r.name);
      const cleanName = p.name || r.name.trim();
      if (cleanName === r.name.trim() && p.amount == null && !p.unit) return r; // tak ada yang dipisah
      const m = findMaster(cleanName);
      return {
        ...r,
        name: cleanName,
        rawText: r.rawText || (r.name.trim() !== cleanName ? r.name.trim() : ''),
        amount: r.amount || (p.amount ?? ''),
        unit: r.unit || p.unit || (m?.baseUnit ?? ''),
        ingredientId: m?.id ?? null,
        category: m ? (m.category ?? r.category) : r.category,
      };
    }));

  // Pastikan baris punya ingredient_id: nama dibersihkan dulu via parser (jaring
  // pengaman bila blur tak sempat jalan), cocokkan ke master, atau buat master baru
  // dengan nama KANONIK (createIngredient memvalidasi & menolak nama mentah/junk).
  const resolveIngredientId = async (row) => {
    if (row.ingredientId) return row.ingredientId;
    const cleanName = (parseIngredient(row.name).name || row.name).trim();
    const found = findMaster(cleanName);
    if (found) return found.id;
    const created = await ingredientService.createIngredient({
      name: cleanName, category: row.category || null,
    });
    setMaster((m) => [...m, created]); // cache lokal agar baris lain ikut kebaca
    return created.id;
  };

  const syncIngredients = async (recipeId) => {
    // Baris yang ter-parse jadi nama kosong (judul seksi "Bumbu halus", note, emoji)
    // bukan bahan → dikeluarkan (dan baris lama begitu ikut terhapus saat simpan).
    const kept = ingredients.filter((r) => r.name?.trim() && parseIngredient(r.name).name);
    const keptIds = kept.map((r) => r._id).filter(Boolean);
    const deleted = origIds.filter((id) => !keptIds.includes(id));
    for (const id of deleted) await recipeAdmin.deleteIngredient(id);
    for (const row of kept) {
      const ingredientId = await resolveIngredientId(row);
      const p = parseIngredient(row.name);
      const cleanName = p.name || row.name.trim();
      const payload = {
        ...row,
        ingredientId,
        name: cleanName,
        amount: row.amount || (p.amount ?? ''),
        unit: row.unit || p.unit || '',
        rawText: row.rawText || (row.name.trim() !== cleanName ? row.name.trim() : ''),
      };
      if (row._id) await recipeAdmin.updateIngredient(row._id, payload);
      else await recipeAdmin.addIngredient(recipeId, payload);
    }
  };

  const handleSave = async () => {
    if (!editing.title?.trim()) {
      showToast('Judul resep wajib diisi.', { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const patch = {
        title: editing.title.trim(),
        description: editing.description || null,
        cuisine: editing.cuisine || null,
        difficulty: editing.difficulty || null,
        readyInMinutes: numOrNull(editing.readyInMinutes),
        calories: numOrNull(editing.calories),
        baseServings: Number(editing.baseServings) || 2,
        // Teks mentah → array bersih HANYA saat simpan (jaga bentuk data DB sama spt dulu).
        badges: splitCsv(badgesRaw),
        tags: splitCsv(tagsRaw),
        instructions: splitLines(instructionsRaw),
        ingredientsText: editing.ingredientsText || null,
        isActive: editing.isActive,
        isVerified: !!editing.isVerified,
      };

      let id = editing.id;
      if (id) await recipeAdmin.updateRecipe(id, patch);
      else id = await recipeAdmin.createRecipe(patch);

      if (imageFile) {
        const url = await recipeAdmin.uploadRecipeImage(id, imageFile);
        await recipeAdmin.updateRecipe(id, { imageUrl: url });
      }

      await syncIngredients(id);

      showToast(editing.id ? 'Resep diperbarui.' : 'Resep ditambahkan.');
      closeForm();
      refresh();
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r) => {
    if (!confirm(`Hapus resep "${r.title}"? Tindakan ini permanen.`)) return;
    try {
      await recipeAdmin.deleteRecipe(r.id);
      showToast('Resep dihapus.');
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
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl">restaurant_menu</span>
          Kelola Resep
        </h1>
        <button onClick={openCreate} className="px-4 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer inline-flex items-center gap-1.5 shrink-0">
          <span className="material-symbols-outlined text-[20px]">add</span> Tambah
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari resep…"
          className="flex-1 min-w-[10rem] px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} title="Filter status"
          className="px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="hidden">Disembunyikan</option>
        </select>
        <select value={verify} onChange={(e) => setVerify(e.target.value)} title="Filter verifikasi"
          className="px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
          <option value="all">Semua verifikasi</option>
          <option value="verified">Terverifikasi</option>
          <option value="unverified">Belum diverifikasi</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} title="Urutkan"
          className="px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
          <option value="default">Urutan default</option>
          <option value="coverage">Coverage terendah</option>
          <option value="name">Nama A–Z</option>
        </select>
        <button
          onClick={() => setOnlyIncomplete((v) => !v)}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border ${onlyIncomplete ? 'bg-primary text-on-primary border-primary' : 'bg-white text-on-surface-variant border-outline-variant'}`}
          title="Tampilkan hanya resep yang biayanya belum lengkap"
        >
          <span className="material-symbols-outlined text-[20px]">{onlyIncomplete ? 'filter_alt' : 'filter_alt_off'}</span>
          Belum lengkap ({incompleteCount})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-sm text-on-surface-variant py-8">Tidak ada resep.</p>}
          {filtered.map((r) => {
            const cov = coverageOf(r);
            return (
            <div key={r.id} className={`rounded-2xl border p-3 flex items-center gap-3 ${r.isActive ? 'border-outline-variant' : 'border-error/30 bg-error/5'}`}>
              <div className="w-14 h-14 rounded-xl bg-surface-container-high overflow-hidden shrink-0">
                {r.imageUrl && <img src={r.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-on-surface truncate">{r.title}</span>
                  {r.isVerified && <span className="text-[10px] font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-[12px]">verified</span>Terverifikasi</span>}
                  {!r.isActive && <span className="text-[10px] font-bold uppercase bg-error text-white px-2 py-0.5 rounded-full">Disembunyikan</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-on-surface-variant">{formatRupiah(r.priceIdr)} · {cov.total} bahan</p>
                  <CoverageBadge priced={cov.priced} total={cov.total} />
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(r)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low cursor-pointer">Edit</button>
                <button onClick={() => handleDelete(r)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-error/40 text-error hover:bg-error/10 cursor-pointer">Hapus</button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-on-surface/60 backdrop-blur-sm" onClick={closeForm}>
          <div className="bg-white w-full max-w-2xl rounded-t-3xl md:rounded-3xl p-6 max-h-[92dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-headline-md text-headline-md text-primary mb-4">{editing.id ? 'Edit Resep' : 'Tambah Resep'}</h2>

            {/* Foto */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-2xl bg-surface-container-high overflow-hidden shrink-0">
                {imagePreview && <img src={imagePreview} alt="" className="w-full h-full object-cover" />}
              </div>
              <label className="cursor-pointer text-sm font-semibold text-primary inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                {imagePreview ? 'Ganti foto' : 'Unggah foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickImage} />
              </label>
            </div>

            <div className="space-y-3">
              <Field label="Judul">
                <TextInput value={editing.title} onChange={(v) => setField('title', v)} placeholder="Soto Ayam Kampung" />
              </Field>
              <Field label="Deskripsi (tentang resep)">
                <textarea
                  value={editing.description ?? ''}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Masakan (cuisine)">
                  <TextInput value={editing.cuisine ?? ''} onChange={(v) => setField('cuisine', v)} placeholder="nusantara" />
                </Field>
                <Field label="Tingkat kesulitan">
                  <select value={editing.difficulty ?? 'easy'} onChange={(e) => setField('difficulty', e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary">
                    {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Waktu (menit)"><TextInput type="number" value={editing.readyInMinutes ?? ''} onChange={(v) => setField('readyInMinutes', v)} /></Field>
                <Field label="Kalori"><TextInput type="number" value={editing.calories ?? ''} onChange={(v) => setField('calories', v)} /></Field>
                <Field label="Porsi dasar"><TextInput type="number" value={editing.baseServings ?? 2} onChange={(v) => setField('baseServings', v)} /></Field>
              </div>

              <div className="rounded-xl bg-surface-container-low border border-outline-variant px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-on-surface">Estimasi biaya (live, dari Master Bahan)</span>
                  <span className="font-bold text-primary">{formatRupiah(liveSummary.total)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-surface-container-high overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${liveSummary.count ? Math.round((liveSummary.priced / liveSummary.count) * 100) : 0}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-on-surface-variant shrink-0">{liveSummary.priced}/{liveSummary.count} bahan terhitung</span>
                </div>
              </div>

              <Field label="Tag (pisahkan dengan koma)">
                <TextInput value={tagsRaw} onChange={setTagsRaw} placeholder="halal, tinggi-protein" />
              </Field>
              <Field label="Badge tampilan (pisahkan dengan koma)">
                <TextInput value={badgesRaw} onChange={setBadgesRaw} placeholder="Cepat, Hemat" />
              </Field>
              <Field label="Langkah memasak (satu langkah per baris)">
                {/* Tampilkan teks mentah apa adanya supaya Enter/baris kosong tetap utuh saat mengetik. */}
                <textarea
                  value={instructionsRaw}
                  onChange={(e) => setInstructionsRaw(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </Field>

              {/* Bahan — pilih dari Master Bahan; biaya per baris dihitung otomatis */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-xs font-semibold text-on-surface">Bahan</span>
                  <button onClick={addRow} className="text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">add</span> Baris
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2">Biaya & status muncul <span className="font-semibold">live</span>: <span className="text-primary font-semibold">Rp = terhitung</span> · <span className="text-blue-700 font-semibold">bahan baru</span> · <span className="text-error font-semibold">belum berharga</span> · <span className="text-amber-700 font-semibold">satuan tak dikenali</span>. <span className="font-semibold">Klik status 🔴/🟠</span> untuk perbaiki harga/satuan di tempat.</p>
                <datalist id="master-ingredients">
                  {master.map((m) => <option key={m.id} value={m.name} />)}
                </datalist>
                <div className="space-y-2">
                  {ingredients.map((row) => {
                    const cost = rowCosts.get(row._key) ?? { status: 'new', price: null };
                    const ing = row.ingredientId ? masterById.get(row.ingredientId) : null;
                    const unitOpts = unitOptionsFor(ing, costCtx);
                    return (
                      <div key={row._key} className="grid grid-cols-12 gap-1.5 items-center">
                        <input list="master-ingredients" value={row.name} onChange={(e) => setIngredientName(row._key, e.target.value)} onBlur={() => applyParseToRow(row._key)} placeholder="Nama bahan / tempel “100 ml air”" className="col-span-4 px-2.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        <input value={row.amount} onChange={(e) => setIngredient(row._key, 'amount', e.target.value)} placeholder="Jml" type="number" className="col-span-2 px-2.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        <input value={row.unit} list={unitOpts.length ? `units-${row._key}` : undefined} onChange={(e) => setIngredient(row._key, 'unit', e.target.value)} placeholder={ing?.baseUnit || 'gr'} className="col-span-2 px-2.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        {unitOpts.length > 0 && <datalist id={`units-${row._key}`}>{unitOpts.map((u) => <option key={u} value={u} />)}</datalist>}
                        <div className="col-span-3 flex justify-end min-w-0">
                          <RowStatusChip cost={cost} unitOpts={unitOpts} onFix={(cost.status === 'unpriced' || cost.status === 'bad-unit') ? () => openQuickFix(row, cost) : undefined} />
                        </div>
                        <button onClick={() => removeRow(row._key)} className="col-span-1 flex justify-center text-error cursor-pointer" title="Hapus bahan">
                          <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer pt-1">
                <input type="checkbox" checked={!editing.isActive} onChange={(e) => setField('isActive', !e.target.checked)} />
                Sembunyikan dari katalog (is_active = false)
              </label>
              <label className="flex items-start gap-2.5 rounded-xl border border-outline-variant p-3 cursor-pointer">
                <input type="checkbox" checked={!!editing.isVerified} onChange={(e) => setField('isVerified', e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold text-on-surface inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px] text-primary">verified</span>
                    Terverifikasi admin
                  </span>
                  <span className="block text-[11px] text-on-surface-variant mt-0.5">
                    Centang jika data resep ini sudah dicek & bersih. Memunculkan badge “Terverifikasi” di katalog (siapa & kapan dicatat otomatis).
                  </span>
                </span>
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

      {/* Quick-fix dari chip status: set harga master / tambah konversi satuan */}
      {quickFix && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/60 backdrop-blur-sm" onClick={() => !quickSaving && setQuickFix(null)}>
          <div className="bg-white w-full max-w-xs rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            {quickFix.kind === 'price' ? (
              <>
                <h3 className="font-semibold text-on-surface mb-1">Set harga: {quickFix.ing.name}</h3>
                <p className="text-[11px] text-on-surface-variant mb-3">Harga per <b>{quickFix.ing.baseUnit}</b> (satuan dasar). Mis. Rp40.000/kg → isi <b>40</b> (per gram).</p>
                <input type="number" step="any" autoFocus value={quickFix.value}
                  onChange={(e) => setQuickFix((q) => ({ ...q, value: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveQuickFix(); }}
                  placeholder={`Rp per ${quickFix.ing.baseUnit}`}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </>
            ) : (
              <>
                <h3 className="font-semibold text-on-surface mb-1">Konversi satuan: {quickFix.ing.name}</h3>
                <p className="text-[11px] text-on-surface-variant mb-3">1 <b>{quickFix.unit}</b> = berapa <b>{quickFix.ing.baseUnit}</b>? Mis. 1 siung = <b>5</b> (gram).</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-on-surface-variant shrink-0">1 {quickFix.unit} =</span>
                  <input type="number" step="any" autoFocus value={quickFix.value}
                    onChange={(e) => setQuickFix((q) => ({ ...q, value: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveQuickFix(); }}
                    placeholder={quickFix.ing.baseUnit}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                  <span className="text-sm text-on-surface-variant shrink-0">{quickFix.ing.baseUnit}</span>
                </div>
              </>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setQuickFix(null)} disabled={quickSaving} className="flex-1 py-2.5 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm cursor-pointer disabled:opacity-50">Batal</button>
              <button onClick={saveQuickFix} disabled={quickSaving} className="flex-1 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {quickSaving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
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

// Teks langkah memasak (satu per baris) → array bersih; baris kosong dibuang saat simpan.
function splitLines(v) {
  return v.split('\n').map((s) => s.trim()).filter(Boolean);
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
