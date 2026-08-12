import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkIsAdmin } from '../../services/adminService.js';
import * as ingredientService from '../../services/ingredientService.js';
import { validateIngredientName } from '../../utils/parseIngredient.js';
import { usePlan } from '../../hooks/usePlan.js';

const BASE_UNITS = [
  { value: 'g', label: 'gram (berat)' },
  { value: 'ml', label: 'ml (volume)' },
  { value: 'pcs', label: 'pcs (hitungan)' },
];
const CATEGORIES = [
  { value: '', label: '—' },
  { value: 'vegetables', label: 'Sayur' },
  { value: 'meat', label: 'Daging' },
  { value: 'dairy', label: 'Olahan susu' },
  { value: 'spices', label: 'Bumbu' },
  { value: 'dry_goods', label: 'Bahan kering' },
];

// Admin UI: Master Bahan — sumber kebenaran harga. Ubah harga dasar (modal) & harga jual di sini.
// Biaya bahan & total resep dihitung otomatis oleh trigger DB dari harga jual (price_per_base).
export function IngredientManager() {
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [allowed, setAllowed] = useState(null);
  const [activeTab, setActiveTab] = useState('master'); // 'master' | 'unlinked'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState('all'); // 'all' | 'unpriced_cost' | 'unpriced_selling' | 'unpriced_any'
  const [onlyStaple, setOnlyStaple] = useState(false);
  const [category, setCategory] = useState(''); // '' = semua, '__none' = tanpa kategori

  // State untuk Antrean Bahan Bebas (Unlinked Queue)
  const [unlinkedItems, setUnlinkedItems] = useState([]);
  const [loadingUnlinked, setLoadingUnlinked] = useState(false);
  const [unlinkedQuery, setUnlinkedQuery] = useState('');
  const [selectedMasters, setSelectedMasters] = useState({});
  const [linkingName, setLinkingName] = useState(null);

  const [editing, setEditing] = useState(null); // ingredient camelCase | null
  const [overrides, setOverrides] = useState([]);
  const [aliasRows, setAliasRows] = useState([]); // { alias, _new }
  const [saving, setSaving] = useState(false);
  const [merging, setMerging] = useState(false); // panel "Gabung ke bahan lain"
  const [mergeQuery, setMergeQuery] = useState('');

  // State untuk Penyesuaian Margin Massal (Bulk Adjust)
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState('markup30'); // 'markup30' | 'gross30' | 'set_cost_from_selling' | 'set_selling_from_cost' | 'custom'
  const [bulkPercentage, setBulkPercentage] = useState('30');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkApplying, setBulkApplying] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadingUnlinked(true);
    try {
      const [mList, uList] = await Promise.all([
        ingredientService.listIngredients(),
        ingredientService.getUnlinkedIngredients(),
      ]);
      setItems(mList);
      setUnlinkedItems(uList);
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setLoading(false);
      setLoadingUnlinked(false);
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => {
      if (!active) return;
      setAllowed(ok);
      if (ok) refresh();
    });
    return () => { active = false; };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (priceFilter === 'unpriced_cost' && i.costPricePerBase != null) return false;
      if (priceFilter === 'unpriced_selling' && i.pricePerBase != null) return false;
      if (priceFilter === 'unpriced_any' && (i.costPricePerBase != null || i.pricePerBase != null)) return false;
      if (onlyStaple && !i.isStaple) return false;
      if (category !== '' && (category === '__none' ? i.category != null : i.category !== category)) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, priceFilter, onlyStaple, category]);

  const filteredUnlinked = useMemo(() => {
    const q = unlinkedQuery.trim().toLowerCase();
    return unlinkedItems.filter(
      (item) =>
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sampleRecipeTitles.some((t) => t.toLowerCase().includes(q))
    );
  }, [unlinkedItems, unlinkedQuery]);

  const costPricedCount = useMemo(() => items.filter((i) => i.costPricePerBase != null).length, [items]);
  const sellingPricedCount = useMemo(() => items.filter((i) => i.pricePerBase != null).length, [items]);
  const avgMarginPct = useMemo(() => {
    const valid = items
      .filter((i) => i.costPricePerBase != null && i.pricePerBase != null && Number(i.pricePerBase) > 0)
      .map((i) => ((Number(i.pricePerBase) - Number(i.costPricePerBase)) / Number(i.pricePerBase)) * 100);
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }, [items]);

  const bulkTargetItems = useMemo(() => {
    return items.filter(
      (i) =>
        (bulkCategory === '' || (bulkCategory === '__none' ? i.category == null : i.category === bulkCategory))
    );
  }, [items, bulkCategory]);

  const handleBulkApply = async () => {
    if (bulkTargetItems.length === 0 || bulkApplying) return;
    setBulkApplying(true);
    try {
      const res = await ingredientService.bulkAdjustPrices({
        mode: bulkMode,
        percentage: Number(bulkPercentage),
        category: bulkCategory,
      });
      showToast(`Berhasil menyesuaikan harga ${res.updatedCount} bahan!`);
      setShowBulkModal(false);
      await refresh();
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setBulkApplying(false);
    }
  };

  const handleLink = async (unlinkedName) => {
    const targetId = selectedMasters[unlinkedName];
    if (!targetId || linkingName) return;
    setLinkingName(unlinkedName);
    try {
      await ingredientService.linkUnlinkedIngredient(unlinkedName, targetId);
      const masterObj = items.find((i) => i.id === targetId);
      showToast(`Berhasil menghubungkan "${unlinkedName}" ke "${masterObj?.name || 'master'}".`);
      setSelectedMasters((prev) => {
        const next = { ...prev };
        delete next[unlinkedName];
        return next;
      });
      await refresh();
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setLinkingName(null);
    }
  };

  const openEdit = async (ing) => {
    setEditing({ ...ing });
    setOverrides([]);
    setAliasRows([]);
    try {
      const [ov, al] = await Promise.all([
        ingredientService.listOverrides(ing.id),
        ingredientService.listAliases(ing.id),
      ]);
      setOverrides(ov);
      setAliasRows(al);
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    }
  };
  const openCreate = () => {
    setEditing({ id: null, name: '', category: '', baseUnit: 'g', costPricePerBase: '', pricePerBase: '', isStaple: false, packSize: '', packLabel: '' });
    setOverrides([]);
    setAliasRows([]);
  };
  const close = () => { setEditing(null); setOverrides([]); setAliasRows([]); setMerging(false); setMergeQuery(''); };

  // Kandidat target gabung: semua bahan lain (kecuali diri sendiri), terfilter cari.
  const mergeCandidates = useMemo(() => {
    if (!merging || !editing) return [];
    const q = mergeQuery.trim().toLowerCase();
    return items
      .filter((i) => i.id !== editing.id && (!q || i.name.toLowerCase().includes(q)))
      .slice(0, 40);
  }, [merging, mergeQuery, items, editing]);

  const handleMerge = async (targetId) => {
    if (!editing?.id || saving) return;
    const target = items.find((i) => i.id === targetId);
    if (!target) return;
    if (!window.confirm(`Gabung "${editing.name}" → "${target.name}"?\n\nSemua baris resep & alias "${editing.name}" pindah ke "${target.name}", lalu "${editing.name}" dihapus. Tindakan ini tak bisa dibatalkan.`)) return;
    setSaving(true);
    try {
      await ingredientService.mergeIngredient(editing.id, targetId);
      showToast(`Digabung ke "${target.name}".`);
      close();
      refresh();
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const setField = (k, v) => setEditing((p) => ({ ...p, [k]: v }));

  const addAliasRow = () => setAliasRows((a) => [...a, { alias: '', _new: true }]);
  const setAliasRow = (idx, v) => setAliasRows((a) => a.map((r, i) => (i === idx ? { ...r, alias: v } : r)));
  const removeAliasRow = async (idx) => {
    const row = aliasRows[idx];
    setAliasRows((a) => a.filter((_, i) => i !== idx));
    if (row.alias && !row._new) {
      try { await ingredientService.deleteAlias(row.alias); }
      catch (e) { showToast(e.message, { variant: 'error' }); }
    }
  };

  const addOverrideRow = () => setOverrides((o) => [...o, { unit: '', factorToBase: '', _new: true }]);
  const setOverrideRow = (idx, k, v) => setOverrides((o) => o.map((r, i) => (i === idx ? { ...r, [k]: v } : r)));
  const removeOverrideRow = async (idx) => {
    const row = overrides[idx];
    setOverrides((o) => o.filter((_, i) => i !== idx));
    if (editing?.id && row.unit && !row._new) {
      try { await ingredientService.deleteOverride(editing.id, row.unit); }
      catch (e) { showToast(e.message, { variant: 'error' }); }
    }
  };

  const handleSave = async () => {
    const nameErr = validateIngredientName(editing.name);
    if (nameErr) { showToast(nameErr, { variant: 'error' }); return; }
    setSaving(true);
    try {
      let id = editing.id;
      const patch = {
        name: editing.name,
        category: editing.category,
        baseUnit: editing.baseUnit,
        costPricePerBase: editing.costPricePerBase,
        pricePerBase: editing.pricePerBase,
        isStaple: !!editing.isStaple,
        packSize: editing.isStaple ? editing.packSize : '',
        packLabel: editing.isStaple ? editing.packLabel : ''
      };
      if (id) await ingredientService.updateIngredient(id, patch);
      else id = (await ingredientService.createIngredient(patch)).id;

      for (const row of overrides) {
        if (!row.unit?.trim() || row.factorToBase === '' || row.factorToBase == null) continue;
        await ingredientService.upsertOverride(id, row.unit, row.factorToBase);
      }
      for (const row of aliasRows) {
        if (!row.alias?.trim()) continue;
        await ingredientService.addAlias(id, row.alias);
      }
      showToast(editing.id ? 'Bahan diperbarui.' : 'Bahan ditambahkan.');
      close();
      refresh();
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!window.confirm(`Hapus bahan "${editing.name}"? Tautan harga di resep yang memakainya akan lepas (resep tetap ada).`)) return;
    setSaving(true);
    try {
      await ingredientService.deleteIngredient(editing.id);
      showToast('Bahan dihapus.');
      close();
      refresh();
    } catch (e) {
      showToast(e.message, { variant: 'error' });
    } finally {
      setSaving(false);
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
    <div className="max-w-3xl mx-auto px-5 md:px-10 py-8 md:py-12 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-headline-lg text-headline-lg text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl">inventory_2</span>
          Master Bahan & Margin
        </h1>
        {activeTab === 'master' && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-3.5 py-2.5 bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 rounded-full font-semibold text-sm cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">percent</span> Atur Margin Massal
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2.5 bg-primary text-on-primary hover:bg-primary/90 rounded-full font-semibold text-sm cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">add</span> Tambah
            </button>
          </div>
        )}
      </div>

      {/* Navigasi Tab */}
      <div className="flex border-b border-outline-variant gap-4">
        <button
          onClick={() => setActiveTab('master')}
          className={`pb-3 font-semibold text-sm cursor-pointer border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'master'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">inventory_2</span>
          Master Bahan ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('unlinked')}
          className={`pb-3 font-semibold text-sm cursor-pointer border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'unlinked'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">link_off</span>
          Antrean Bahan Bebas Pengguna
          {unlinkedItems.length > 0 && (
            <span className="rounded-full bg-error/10 text-error text-xs font-bold px-2 py-0.5">
              {unlinkedItems.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'master' && (
        <>
          {/* Banner Ringkasan Harga & Margin */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/60">
            <div>
              <span className="text-[11px] font-semibold text-on-surface-variant block">Total Bahan</span>
              <span className="text-lg font-bold text-on-surface">{items.length}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-on-surface-variant block">Harga Dasar (Modal)</span>
              <span className="text-lg font-bold text-on-surface">{costPricedCount} <span className="text-xs font-normal text-on-surface-variant">bahan</span></span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-on-surface-variant block">Harga Jual (Retail)</span>
              <span className="text-lg font-bold text-primary">{sellingPricedCount} <span className="text-xs font-normal text-on-surface-variant">bahan</span></span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-on-surface-variant block">Rata-rata Margin</span>
              <span className={`text-lg font-bold ${avgMarginPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {(avgMarginPct ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari bahan…"
              className="flex-1 min-w-[10rem] px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} title="Filter kategori"
              className="px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
              <option value="">Semua kategori</option>
              {CATEGORIES.filter((c) => c.value).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              <option value="__none">Tanpa kategori</option>
            </select>
            <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} title="Filter status harga"
              className="px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
              <option value="all">Semua Status Harga</option>
              <option value="unpriced_cost">Belum harga dasar</option>
              <option value="unpriced_selling">Belum harga jual</option>
              <option value="unpriced_any">Belum set lengkap</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-on-surface cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={onlyStaple} onChange={(e) => setOnlyStaple(e.target.checked)} /> Bahan pokok
            </label>
          </div>
          {(query || category || priceFilter !== 'all' || onlyStaple) && (
            <p className="-mt-2 text-[11px] text-on-surface-variant">{filtered.length} bahan cocok filter. <button onClick={() => { setQuery(''); setCategory(''); setPriceFilter('all'); setOnlyStaple(false); }} className="text-primary font-semibold cursor-pointer">Reset</button></p>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
          ) : (
            <div className="space-y-2.5">
              {filtered.length === 0 && <p className="text-center text-sm text-on-surface-variant py-8">Tidak ada bahan.</p>}
              {filtered.slice(0, 300).map((ing) => {
                const cost = ing.costPricePerBase != null ? Number(ing.costPricePerBase) : null;
                const selling = ing.pricePerBase != null ? Number(ing.pricePerBase) : null;
                const hasBoth = cost != null && selling != null;
                const margin = hasBoth ? selling - cost : null;
                const marginPct = hasBoth && selling > 0 ? ((selling - cost) / selling) * 100 : null;

                return (
                  <button key={ing.id} onClick={() => openEdit(ing)}
                    className="w-full text-left rounded-2xl border border-outline-variant p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-surface-container-low cursor-pointer transition-all bg-white hover:shadow-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-on-surface truncate flex items-center gap-1.5">
                        <span className="truncate">{ing.name}</span>
                        {ing.isStaple && (
                          <span title="Bahan pokok dapur — tak masuk daftar belanja" className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-[10px] font-bold px-1.5 py-0.5">
                            <span className="material-symbols-outlined text-[12px]">home</span> pokok
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-on-surface-variant">{labelOf(CATEGORIES, ing.category)} · dasar {ing.baseUnit}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                      <div className="bg-surface-container px-3 py-1 rounded-xl">
                        <span className="text-on-surface-variant text-[10px] block font-medium">Harga Dasar (Modal)</span>
                        <span className="font-bold text-on-surface">
                          {cost == null ? '—' : `Rp${formatNum(cost)}/${ing.baseUnit}`}
                        </span>
                      </div>
                      <div className="bg-primary/5 px-3 py-1 rounded-xl border border-primary/20">
                        <span className="text-primary text-[10px] block font-semibold">Harga Jual</span>
                        <span className="font-bold text-primary">
                          {selling == null ? 'belum set' : `Rp${formatNum(selling)}/${ing.baseUnit}`}
                        </span>
                      </div>
                      {hasBoth ? (
                        <div className={`px-3 py-1 rounded-xl border ${margin >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                          <span className="text-[10px] block font-semibold">Margin</span>
                          <span className="font-bold">
                            Rp{formatNum(Math.round(margin))} ({marginPct != null ? marginPct.toFixed(1) : '0.0'}%)
                          </span>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-xl text-[11px] font-medium">
                          perlu data margin
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              {filtered.length > 300 && <p className="text-center text-xs text-on-surface-variant py-2">Menampilkan 300 dari {filtered.length}. Persempit dengan pencarian.</p>}
            </div>
          )}
        </>
      )}

      {activeTab === 'unlinked' && (
        <div className="space-y-4">
          <p className="text-xs text-on-surface-variant">
            Daftar bahan manual yang di-input pengguna pada resep kreasi. Hubungkan ke master bahan sekali klik agar harga & daftar belanja terhitung otomatis.
          </p>

          <div className="flex items-center gap-2">
            <input
              value={unlinkedQuery}
              onChange={(e) => setUnlinkedQuery(e.target.value)}
              placeholder="Cari bahan bebas atau judul resep..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            {unlinkedQuery && (
              <button
                onClick={() => setUnlinkedQuery('')}
                className="text-xs text-primary font-semibold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {loadingUnlinked ? (
            <div className="flex justify-center py-16">
              <span className="material-symbols-outlined animate-spin text-3xl text-primary">
                progress_activity
              </span>
            </div>
          ) : filteredUnlinked.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-low rounded-2xl p-6 border border-outline-variant">
              <span className="material-symbols-outlined text-4xl text-primary mb-2">check_circle</span>
              <p className="text-sm font-semibold text-on-surface">Tidak ada antrean bahan bebas</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Semua bahan resep kreasi pengguna sudah terhubung ke master bahan!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUnlinked.map((item) => (
                <div
                  key={item.name}
                  className="rounded-2xl border border-outline-variant p-4 bg-white space-y-3 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4 hover:shadow-sm transition-shadow"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-on-surface text-base">{item.name}</span>
                      <span className="rounded-full bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5">
                        {item.count}x digunakan
                      </span>
                    </div>
                    {item.sampleRecipeTitles.length > 0 && (
                      <p className="text-xs text-on-surface-variant truncate">
                        <span className="font-semibold">Resep:</span> {item.sampleRecipeTitles.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-outline-variant/40">
                    <MasterIngredientCombobox
                      items={items}
                      value={selectedMasters[item.name] || null}
                      onChange={(val) =>
                        setSelectedMasters((prev) => ({ ...prev, [item.name]: val }))
                      }
                      disabled={linkingName === item.name}
                    />
                    <button
                      onClick={() => handleLink(item.name)}
                      disabled={!selectedMasters[item.name] || linkingName === item.name}
                      className="px-4 py-2 bg-primary text-on-primary rounded-full font-semibold text-xs cursor-pointer hover:bg-primary/90 disabled:opacity-40 inline-flex items-center gap-1.5 shrink-0 transition-opacity"
                    >
                      {linkingName === item.name ? (
                        <span className="material-symbols-outlined animate-spin text-[16px]">
                          progress_activity
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">link</span>
                      )}
                      Hubungkan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-on-surface/60 backdrop-blur-sm" onClick={close}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl p-6 max-h-[92dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-headline-md text-headline-md text-primary mb-4">{editing.id ? 'Edit Bahan' : 'Tambah Bahan'}</h2>
            <div className="space-y-3.5">
              <Field label="Nama bahan">
                <input value={editing.name} onChange={(e) => setField('name', e.target.value)} placeholder="Bawang Merah"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                {(() => { const err = validateIngredientName(editing.name); return err ? <span className="block text-[11px] text-error mt-1">{err}</span> : null; })()}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Kategori">
                  <select value={editing.category ?? ''} onChange={(e) => setField('category', e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Satuan dasar">
                  <select value={editing.baseUnit} onChange={(e) => setField('baseUnit', e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    {BASE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </Field>
              </div>

              {/* Dual Input Harga: Dasar (Modal) & Jual (Retail) */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Harga Dasar / ${editing.baseUnit} (Modal)`}>
                  <input type="number" step="any" value={editing.costPricePerBase ?? ''} onChange={(e) => setField('costPricePerBase', e.target.value)} placeholder="30"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                </Field>
                <Field label={`Harga Jual / ${editing.baseUnit} (Retail)`}>
                  <input type="number" step="any" value={editing.pricePerBase ?? ''} onChange={(e) => setField('pricePerBase', e.target.value)} placeholder="40"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                </Field>
              </div>

              {/* Kalkulator Live Margin */}
              {(() => {
                const cost = Number(editing.costPricePerBase);
                const selling = Number(editing.pricePerBase);
                const hasCost = editing.costPricePerBase !== '' && editing.costPricePerBase != null && !isNaN(cost) && cost > 0;
                const hasSelling = editing.pricePerBase !== '' && editing.pricePerBase != null && !isNaN(selling) && selling > 0;

                const margin = (hasSelling ? selling : 0) - (hasCost ? cost : 0);
                const marginPct = hasSelling && selling > 0 ? (margin / selling) * 100 : 0;
                const markupPct = hasCost && cost > 0 ? (margin / cost) * 100 : 0;

                return (
                  <div className="rounded-2xl border border-outline-variant/80 p-3.5 bg-surface-container-low space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-primary">calculate</span>
                        Analisis Margin per {editing.baseUnit}
                      </span>
                      {hasCost && hasSelling && (
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${margin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          Margin: Rp{formatNum(Math.round(margin))} ({(marginPct ?? 0).toFixed(1)}%)
                        </span>
                      )}
                    </div>

                    {hasCost && hasSelling ? (
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-white p-2 rounded-xl border border-outline-variant/60 shadow-2xs">
                          <span className="block text-[10px] text-on-surface-variant font-medium">Margin Rp</span>
                          <span className="font-bold text-primary text-sm">Rp{formatNum(Math.round(margin))}</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-outline-variant/60 shadow-2xs">
                          <span className="block text-[10px] text-on-surface-variant font-medium">Gross Margin %</span>
                          <span className="font-bold text-emerald-700 text-sm">{(marginPct ?? 0).toFixed(1)}%</span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-outline-variant/60 shadow-2xs">
                          <span className="block text-[10px] text-on-surface-variant font-medium">Markup %</span>
                          <span className="font-bold text-secondary text-sm">{(markupPct ?? 0).toFixed(1)}%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Masukkan Harga Dasar & Harga Jual untuk melihat analisis margin keuntungan secara otomatis.
                      </p>
                    )}

                    {/* Quick Helper Buttons */}
                    <div className="pt-1 space-y-1.5">
                      <span className="text-[11px] font-semibold text-on-surface block">Hitung Otomatis:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={!hasCost}
                          onClick={() => setField('pricePerBase', Math.round(cost * 1.3 * 100) / 100)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-white border border-outline-variant hover:border-primary text-primary font-semibold disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                        >
                          +30% Markup Jual
                        </button>
                        <button
                          type="button"
                          disabled={!hasCost}
                          onClick={() => setField('pricePerBase', Math.round(cost * 1.2 * 100) / 100)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-white border border-outline-variant hover:border-primary text-primary font-semibold disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                        >
                          +20% Markup Jual
                        </button>
                        <button
                          type="button"
                          disabled={!hasCost}
                          onClick={() => setField('pricePerBase', Math.round(cost * 1.5 * 100) / 100)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-white border border-outline-variant hover:border-primary text-primary font-semibold disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                        >
                          +50% Markup Jual
                        </button>
                        <button
                          type="button"
                          disabled={!hasSelling}
                          onClick={() => setField('costPricePerBase', Math.round((selling / 1.3) * 100) / 100)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-white border border-outline-variant hover:border-primary text-on-surface-variant font-medium disabled:opacity-40 cursor-pointer transition-colors shadow-2xs"
                        >
                          Hitung Modal (Jual / 1.3)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Bahan pokok dapur — dikecualikan dari daftar belanja */}
              <label className="flex items-start gap-2.5 rounded-xl border border-outline-variant p-3 cursor-pointer">
                <input type="checkbox" checked={!!editing.isStaple} onChange={(e) => setField('isStaple', e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold text-on-surface">Bahan pokok dapur (cek stok di rumah)</span>
                  <span className="block text-[11px] text-on-surface-variant mt-0.5">
                    Mis. garam, minyak, kaldu bubuk, penyedap. Jika dicentang, bahan ini <b>tidak masuk daftar belanja & tidak dihitung biaya</b> — hanya jadi pengingat “cek stok di rumah”.
                  </span>
                </span>
              </label>

              {/* Kemasan jual add-on — hanya untuk bahan pokok. */}
              {editing.isStaple && (
                <div className="rounded-xl border border-outline-variant p-3 space-y-2">
                  <span className="block text-xs font-semibold text-on-surface">Tawarkan sebagai add-on "kami belikan" (opsional)</span>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`Ukuran kemasan (${editing.baseUnit})`}>
                      <input type="number" step="any" value={editing.packSize ?? ''} onChange={(e) => setField('packSize', e.target.value)} placeholder="250"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                    </Field>
                    <Field label="Label kemasan">
                      <input value={editing.packLabel ?? ''} onChange={(e) => setField('packLabel', e.target.value)} placeholder="bungkus / botol / sachet"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                    </Field>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    {(() => {
                      const size = Number(editing.packSize);
                      const cost = Number(editing.costPricePerBase);
                      const price = Number(editing.pricePerBase);
                      if (editing.packSize && editing.pricePerBase && size > 0 && price > 0) {
                        const packCost = Math.round(size * (cost || price));
                        const packSelling = Math.round(size * price);
                        const packMargin = packSelling - packCost;
                        return (
                          <>
                            1 {editing.packLabel || 'kemasan'} = Jual <b>Rp{formatNum(packSelling)}</b>
                            {cost > 0 && <> (Modal <b>Rp{formatNum(packCost)}</b> · Profit <b>Rp{formatNum(packMargin)}</b>)</>}.
                          </>
                        );
                      }
                      return <>Isi ukuran kemasan jual <i>dan</i> harga/{editing.baseUnit} agar bahan ini bisa dicentang untuk dibelikan.</>;
                    })()}
                  </p>
                </div>
              )}

              {/* Override satuan per-bahan (jembatan hitung↔berat) */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-xs font-semibold text-on-surface">Konversi satuan khusus (opsional)</span>
                  <button onClick={addOverrideRow} className="text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">add</span> Baris
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2">Mis. 1 siung = 8 (gram). Hanya perlu untuk satuan hitung yang dipakai resep tapi bahan dihargai per berat/volume.</p>
                <div className="space-y-2">
                  {overrides.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                      <input value={row.unit} onChange={(e) => setOverrideRow(idx, 'unit', e.target.value)} placeholder="siung"
                        className="col-span-5 px-2.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      <span className="col-span-1 text-center text-on-surface-variant">=</span>
                      <input type="number" step="any" value={row.factorToBase} onChange={(e) => setOverrideRow(idx, 'factorToBase', e.target.value)} placeholder={`per ${editing.baseUnit}`}
                        className="col-span-5 px-2.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      <button onClick={() => removeOverrideRow(idx)} className="col-span-1 flex justify-center text-error cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alias / sinonim */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-xs font-semibold text-on-surface">Alias / sinonim (opsional)</span>
                  <button onClick={addAliasRow} className="text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">add</span> Baris
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2">Nama lain yang menunjuk ke bahan ini, mis. “santan instant” → <b>{editing.name || 'santan instan'}</b>.</p>
                <div className="space-y-2">
                  {aliasRows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                      <input value={row.alias} onChange={(e) => setAliasRow(idx, e.target.value)} placeholder="nama lain (mis. santan instant)"
                        className="col-span-11 px-2.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      <button onClick={() => removeAliasRow(idx)} className="col-span-1 flex justify-center text-error cursor-pointer">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel gabung */}
            {editing.id && merging && (
              <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-on-surface">Gabung “{editing.name}” ke…</span>
                  <button onClick={() => { setMerging(false); setMergeQuery(''); }} className="text-on-surface-variant cursor-pointer inline-flex">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2">Pilih bahan kanonik. Semua baris resep & alias “{editing.name}” pindah ke sana, lalu bahan ini dihapus.</p>
                <input value={mergeQuery} onChange={(e) => setMergeQuery(e.target.value)} placeholder="Cari bahan target…" autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-outline-variant divide-y divide-outline-variant/40 bg-white">
                  {mergeCandidates.length === 0 && <p className="p-3 text-xs text-on-surface-variant text-center">Tidak ada bahan cocok.</p>}
                  {mergeCandidates.map((c) => (
                    <button key={c.id} onClick={() => handleMerge(c.id)} disabled={saving}
                      className="w-full text-left px-3 py-2.5 hover:bg-surface-container-low cursor-pointer flex items-center justify-between gap-2 disabled:opacity-50">
                      <span className="text-sm text-on-surface truncate">{c.name}</span>
                      <span className="text-[11px] shrink-0 text-on-surface-variant">{c.pricePerBase == null ? 'belum berharga' : `Rp${formatNum(c.pricePerBase)}/${c.baseUnit}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              {editing.id && (
                <button onClick={handleDelete} disabled={saving} title="Hapus bahan"
                  className="py-3 px-4 border border-error/40 text-error rounded-full font-semibold text-sm cursor-pointer disabled:opacity-50 inline-flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              )}
              {editing.id && (
                <button onClick={() => setMerging((m) => !m)} disabled={saving} title="Gabung ke bahan lain"
                  className={`py-3 px-4 border rounded-full font-semibold text-sm cursor-pointer disabled:opacity-50 inline-flex items-center justify-center ${merging ? 'border-primary bg-primary/10 text-primary' : 'border-primary/40 text-primary'}`}>
                  <span className="material-symbols-outlined text-[20px]">merge</span>
                </button>
              )}
              <button onClick={close} disabled={saving} className="flex-1 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm cursor-pointer disabled:opacity-50">Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {saving && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Penyesuaian Margin Massal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-outline-variant max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">percent</span>
                Penyesuaian Margin Massal
              </h2>
              <button
                onClick={() => setShowBulkModal(false)}
                disabled={bulkApplying}
                className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Atur harga dasar (modal) & harga jual secara massal. Biaya bahan & total harga resep akan dihitung ulang otomatis oleh database dari harga jual.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-on-surface">Target Kategori Bahan</label>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                disabled={bulkApplying}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="">Semua Kategori ({items.length} bahan)</option>
                {CATEGORIES.filter((c) => c.value).map((c) => (
                  <option key={c.value} value={c.value}>
                    Kategori {c.label}
                  </option>
                ))}
                <option value="__none">Tanpa Kategori</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-on-surface">Mode Penyesuaian Margin & Harga</label>

              {/* Group 1: Hitung Harga Jual dari Modal */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-bold text-primary tracking-wider uppercase">🔼 Hitung Harga Jual dari Modal</span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setBulkMode('markup30'); setBulkPercentage('30'); }}
                    disabled={bulkApplying}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      bulkMode === 'markup30'
                        ? 'border-primary bg-primary/10 ring-1 ring-primary text-primary font-bold'
                        : 'border-outline-variant hover:bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <span className="block text-xs font-bold">+30% Markup Jual</span>
                    <span className="block text-[10px] opacity-80 mt-0.5">Rumus: Modal × 1.30</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setBulkMode('gross30'); setBulkPercentage('30'); }}
                    disabled={bulkApplying}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      bulkMode === 'gross30'
                        ? 'border-primary bg-primary/10 ring-1 ring-primary text-primary font-bold'
                        : 'border-outline-variant hover:bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <span className="block text-xs font-bold">Gross Margin 30%</span>
                    <span className="block text-[10px] opacity-80 mt-0.5">Rumus: Modal / 0.70</span>
                  </button>
                </div>
              </div>

              {/* Group 2: Hitung Modal dari Harga Jual */}
              <div className="space-y-1.5 pt-1">
                <span className="block text-[11px] font-bold text-on-surface-variant tracking-wider uppercase">🔽 Hitung Modal dari Harga Jual</span>

                <button
                  type="button"
                  onClick={() => { setBulkMode('set_cost_from_selling'); setBulkPercentage('30'); }}
                  disabled={bulkApplying}
                  className={`w-full p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    bulkMode === 'set_cost_from_selling'
                      ? 'border-primary bg-primary/10 ring-1 ring-primary text-primary font-bold'
                      : 'border-outline-variant hover:bg-surface-container-low text-on-surface'
                  }`}
                >
                  <span className="block text-xs font-bold">Hitung Modal (Diskon/Margin 30% dari Jual)</span>
                  <span className="block text-[10px] opacity-80 mt-0.5">Rumus: Modal = Harga Jual / 1.30</span>
                </button>
              </div>

              {/* Group 3: Persentase Kustom */}
              <div className="pt-1">
                <label className={`block p-3 rounded-xl border cursor-pointer transition-all ${bulkMode === 'custom' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-container-low'}`}>
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="bulkMode"
                      value="custom"
                      checked={bulkMode === 'custom'}
                      onChange={() => setBulkMode('custom')}
                      disabled={bulkApplying}
                      className="mt-0.5"
                    />
                    <div className="flex-1 space-y-2">
                      <div>
                        <span className="font-semibold text-sm text-on-surface block">⚙️ Persentase Penyesuaian Kustom (%)</span>
                        <span className="text-xs text-on-surface-variant block mt-0.5">
                          Ubah harga jual dengan persentase (+ untuk naik, - untuk turun).
                        </span>
                      </div>

                      {/* Chip presets */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          { label: '+10%', val: '10' },
                          { label: '+15%', val: '15' },
                          { label: '+20%', val: '20' },
                          { label: '+25%', val: '25' },
                          { label: '+30%', val: '30' },
                          { label: '+50%', val: '50' },
                          { label: '-10%', val: '-10' },
                          { label: '-20%', val: '-20' },
                        ].map((chip) => (
                          <button
                            key={chip.val}
                            type="button"
                            onClick={() => {
                              setBulkMode('custom');
                              setBulkPercentage(chip.val);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer transition-all ${
                              bulkMode === 'custom' && bulkPercentage === chip.val
                                ? 'bg-primary text-on-primary border-primary'
                                : 'bg-surface-container-low text-on-surface border-outline-variant hover:border-primary/50'
                            }`}
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>

                      {bulkMode === 'custom' && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="number"
                            step="0.01"
                            value={bulkPercentage}
                            onChange={(e) => setBulkPercentage(e.target.value)}
                            disabled={bulkApplying}
                            placeholder="30"
                            className="w-32 px-3 py-1.5 rounded-lg bg-white border border-outline-variant text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                          />
                          <span className="text-xs text-on-surface-variant font-medium">% penyesuaian</span>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Live Preview Box */}
            {bulkTargetItems.length > 0 && (
              <div className="rounded-xl bg-surface-container-low p-3.5 border border-outline-variant space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
                    Preview Hasil ({bulkTargetItems.length} bahan terpilih):
                  </span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto text-xs divide-y divide-outline-variant/30">
                  {bulkTargetItems.slice(0, 4).map((ing) => {
                    let costP = ing.costPricePerBase != null ? Number(ing.costPricePerBase) : null;
                    let sellP = ing.pricePerBase != null ? Number(ing.pricePerBase) : null;

                    if (bulkMode === 'markup30') {
                      if (costP != null) sellP = Math.round((costP * 1.3) * 100) / 100;
                      else if (sellP != null) costP = Math.round((sellP / 1.3) * 100) / 100;
                    } else if (bulkMode === 'gross30') {
                      if (costP != null) sellP = Math.round((costP / 0.7) * 100) / 100;
                      else if (sellP != null) costP = Math.round((sellP * 0.7) * 100) / 100;
                    } else if (bulkMode === 'set_cost_from_selling' && sellP != null) {
                      const div = 1 + (Number(bulkPercentage) || 30) / 100;
                      costP = Math.round((sellP / div) * 100) / 100;
                    } else if (bulkMode === 'custom' && sellP != null) {
                      const f = 1 + (Number(bulkPercentage) || 0) / 100;
                      sellP = Math.max(0, Math.round((sellP * f) * 100) / 100);
                    }

                    const margin = costP != null && sellP != null ? sellP - costP : null;
                    const marginPct = margin != null && sellP > 0 ? (margin / sellP) * 100 : null;

                    return (
                      <div key={ing.id} className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="truncate text-on-surface font-medium">{ing.name}</span>
                        <div className="shrink-0 font-mono text-[11px] flex items-center gap-1.5">
                          <span className="text-on-surface-variant">Modal: Rp{costP != null ? formatNum(costP) : '—'}</span>
                          <span>➔</span>
                          <span className="font-bold text-primary">Jual: Rp{sellP != null ? formatNum(sellP) : '—'}</span>
                          {marginPct != null && (
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                              {(marginPct ?? 0).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {bulkTargetItems.length > 4 && (
                    <p className="text-[11px] text-on-surface-variant pt-1 text-center font-medium">...dan {bulkTargetItems.length - 4} bahan lainnya.</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowBulkModal(false)}
                disabled={bulkApplying}
                className="flex-1 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm cursor-pointer disabled:opacity-50 hover:bg-surface-container-low transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleBulkApply}
                disabled={bulkApplying || bulkTargetItems.length === 0}
                className="flex-1 py-3 bg-primary text-on-primary hover:bg-primary/90 rounded-full font-semibold text-sm cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                {bulkApplying && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                Terapkan ke {bulkTargetItems.length} Bahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MasterIngredientCombobox({ items, value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  const selectedItem = useMemo(() => items.find((i) => i.id === value), [items, value]);

  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(selectedItem ? selectedItem.name : '');
  }

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 30);
  }, [items, query]);

  return (
    <div className="relative min-w-[180px] max-w-[240px]">
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder="Pilih master bahan..."
        className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
      />
      {isOpen && candidates.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-outline-variant bg-white shadow-lg text-xs divide-y divide-outline-variant/30">
          {candidates.map((c) => (
            <li
              key={c.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c.id);
                setQuery(c.name);
                setIsOpen(false);
              }}
              className="px-3 py-2 hover:bg-primary/10 cursor-pointer flex items-center justify-between gap-2"
            >
              <span className="font-medium text-on-surface truncate">{c.name}</span>
              <span className="text-[10px] text-on-surface-variant shrink-0">
                {c.pricePerBase == null ? 'belum berharga' : `Rp${formatNum(c.pricePerBase)}/${c.baseUnit}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function labelOf(opts, value) {
  return opts.find((o) => o.value === (value ?? ''))?.label ?? '—';
}
function formatNum(n) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(n);
}
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-on-surface mb-1">{label}</span>
      {children}
    </label>
  );
}
