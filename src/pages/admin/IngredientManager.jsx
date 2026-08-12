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

// Admin UI: Master Bahan — sumber kebenaran harga. Ubah harga sekali di sini,
// biaya bahan & total resep ikut berubah otomatis (trigger DB) di semua resep.
export function IngredientManager() {
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [allowed, setAllowed] = useState(null);
  const [activeTab, setActiveTab] = useState('master'); // 'master' | 'unlinked'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyUnpriced, setOnlyUnpriced] = useState(false);
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
  const [bulkMode, setBulkMode] = useState('markup30'); // 'markup30' | 'gross30' | 'custom'
  const [bulkPercentage, setBulkPercentage] = useState('-23.08');
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
    return items.filter((i) =>
      (!onlyUnpriced || i.pricePerBase == null) &&
      (!onlyStaple || i.isStaple) &&
      (category === '' || (category === '__none' ? i.category == null : i.category === category)) &&
      (!q || i.name.toLowerCase().includes(q))
    );
  }, [items, query, onlyUnpriced, onlyStaple, category]);

  const filteredUnlinked = useMemo(() => {
    const q = unlinkedQuery.trim().toLowerCase();
    return unlinkedItems.filter(
      (item) =>
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sampleRecipeTitles.some((t) => t.toLowerCase().includes(q))
    );
  }, [unlinkedItems, unlinkedQuery]);

  const pricedCount = useMemo(() => items.filter((i) => i.pricePerBase != null).length, [items]);

  const bulkTargetItems = useMemo(() => {
    return items.filter(
      (i) =>
        i.pricePerBase != null &&
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
  const openCreate = () => { setEditing({ id: null, name: '', category: '', baseUnit: 'g', pricePerBase: '', isStaple: false, packSize: '', packLabel: '' }); setOverrides([]); setAliasRows([]); };
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
      const patch = { name: editing.name, category: editing.category, baseUnit: editing.baseUnit, pricePerBase: editing.pricePerBase, isStaple: !!editing.isStaple, packSize: editing.isStaple ? editing.packSize : '', packLabel: editing.isStaple ? editing.packLabel : '' };
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
          Master Bahan
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
          <p className="text-xs text-on-surface-variant">
            {pricedCount}/{items.length} bahan sudah berharga. Ubah harga di sini → biaya bahan & total resep ikut otomatis di semua resep.
          </p>

          <div className="flex flex-wrap gap-2 items-center">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari bahan…"
              className="flex-1 min-w-[10rem] px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} title="Filter kategori"
              className="px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
              <option value="">Semua kategori</option>
              {CATEGORIES.filter((c) => c.value).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              <option value="__none">Tanpa kategori</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-on-surface cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={onlyUnpriced} onChange={(e) => setOnlyUnpriced(e.target.checked)} /> Belum berharga
            </label>
            <label className="flex items-center gap-1.5 text-sm text-on-surface cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={onlyStaple} onChange={(e) => setOnlyStaple(e.target.checked)} /> Bahan pokok
            </label>
          </div>
          {(query || category || onlyUnpriced || onlyStaple) && (
            <p className="-mt-2 text-[11px] text-on-surface-variant">{filtered.length} bahan cocok filter. <button onClick={() => { setQuery(''); setCategory(''); setOnlyUnpriced(false); setOnlyStaple(false); }} className="text-primary font-semibold cursor-pointer">Reset</button></p>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 && <p className="text-center text-sm text-on-surface-variant py-8">Tidak ada bahan.</p>}
              {filtered.slice(0, 300).map((ing) => (
                <button key={ing.id} onClick={() => openEdit(ing)}
                  className="w-full text-left rounded-xl border border-outline-variant p-3 flex items-center justify-between gap-3 hover:bg-surface-container-low cursor-pointer">
                  <div className="min-w-0">
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
                  <span className={`text-sm font-bold shrink-0 ${ing.pricePerBase == null ? 'text-error/70' : 'text-primary'}`}>
                    {ing.pricePerBase == null ? 'belum berharga' : `Rp${formatNum(ing.pricePerBase)}/${ing.baseUnit}`}
                  </span>
                </button>
              ))}
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
            <div className="space-y-3">
              <Field label="Nama bahan">
                <input value={editing.name} onChange={(e) => setField('name', e.target.value)} placeholder="Bawang Merah"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                {(() => { const err = validateIngredientName(editing.name); return err ? <span className="block text-[11px] text-error mt-1">{err}</span> : null; })()}
              </Field>
              <div className="grid grid-cols-3 gap-3">
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
                <Field label={`Harga / ${editing.baseUnit}`}>
                  <input type="number" step="any" value={editing.pricePerBase ?? ''} onChange={(e) => setField('pricePerBase', e.target.value)} placeholder="40"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                </Field>
              </div>
              <p className="text-[11px] text-on-surface-variant -mt-1">
                Contoh: bawang Rp40.000/kg → satuan dasar <b>g</b>, harga <b>40</b> (per gram).
              </p>

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

              {/* Kemasan jual add-on — hanya untuk bahan pokok. Diisi -> bumbu ini
                  jadi pilihan CENTANG "kami belikan sekalian" di Belanja di Kami;
                  dikosongkan -> cuma jadi info "disiapkan sendiri". */}
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
                      const price = Number(editing.pricePerBase);
                      if (editing.packSize && editing.pricePerBase && size > 0 && price > 0) {
                        return <>1 {editing.packLabel || 'kemasan'} = <b>Rp{formatNum(Math.round(size * price))}</b> (terhitung otomatis), muncul sebagai pilihan centang.</>;
                      }
                      return <>Isi ukuran kemasan jual <i>dan</i> harga/{editing.baseUnit} agar bahan ini bisa dicentang untuk dibelikan. Kosongkan = hanya jadi info "disiapkan sendiri".</>;
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

              {/* Alias / sinonim — nama lain yang menunjuk ke bahan ini */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-xs font-semibold text-on-surface">Alias / sinonim (opsional)</span>
                  <button onClick={addAliasRow} className="text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">add</span> Baris
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-2">Nama lain yang menunjuk ke bahan ini, mis. “santan instant” → <b>{editing.name || 'santan instan'}</b>. Saat resep memakai nama itu, otomatis nempel ke bahan ini (bukan bikin master kembar).</p>
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

            {/* Panel gabung — pembersih duplikat tanpa loss */}
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
              Fitur ini akan menyesuaikan <code className="bg-surface-container-high px-1 py-0.5 rounded text-primary font-mono">price_per_base</code> pada semua bahan berharga secara otomatis. Biaya bahan & total harga resep akan dihitung ulang otomatis oleh database.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-on-surface">Target Kategori Bahan</label>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                disabled={bulkApplying}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-outline-variant text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="">Semua Kategori ({pricedCount} bahan berharga)</option>
                {CATEGORIES.filter((c) => c.value).map((c) => (
                  <option key={c.value} value={c.value}>
                    Kategori {c.label}
                  </option>
                ))}
                <option value="__none">Tanpa Kategori</option>
              </select>
            </div>

            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-on-surface">Mode Penyesuaian Margin</label>

              {/* Option 1: Markup 30% */}
              <label className={`block p-3 rounded-xl border cursor-pointer transition-all ${bulkMode === 'markup30' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-container-low'}`}>
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="bulkMode"
                    value="markup30"
                    checked={bulkMode === 'markup30'}
                    onChange={() => setBulkMode('markup30')}
                    disabled={bulkApplying}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-sm text-on-surface block flex items-center gap-1.5">
                      Harga Modal untuk Margin 30% (Markup)
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">Rekomendasi</span>
                    </span>
                    <span className="text-xs text-on-surface-variant block mt-0.5">
                      Rumus: <code className="bg-surface-container-high px-1 rounded text-on-surface">Harga Saat Ini / 1.30</code> (Turun ~23.08%). Sangat pas agar harga jual di web tetap sesuai harga pasar.
                    </span>
                  </div>
                </div>
              </label>

              {/* Option 2: Gross Margin 30% */}
              <label className={`block p-3 rounded-xl border cursor-pointer transition-all ${bulkMode === 'gross30' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-outline-variant hover:bg-surface-container-low'}`}>
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="bulkMode"
                    value="gross30"
                    checked={bulkMode === 'gross30'}
                    onChange={() => setBulkMode('gross30')}
                    disabled={bulkApplying}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-sm text-on-surface block">Harga Modal untuk Gross Margin 30%</span>
                    <span className="text-xs text-on-surface-variant block mt-0.5">
                      Rumus: <code className="bg-surface-container-high px-1 rounded text-on-surface">Harga Saat Ini × 0.70</code> (Turun 30%).
                    </span>
                  </div>
                </div>
              </label>

              {/* Option 3: Custom Percentage */}
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
                  <div className="flex-1">
                    <span className="font-semibold text-sm text-on-surface block">Persentase Kustom (%)</span>
                    <span className="text-xs text-on-surface-variant block mt-0.5 mb-2">
                      Gunakan angka minus (misal <code className="bg-surface-container-high px-1 rounded text-on-surface">-23.08</code>) untuk menurunkan atau positif untuk menaikkan harga.
                    </span>
                    {bulkMode === 'custom' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={bulkPercentage}
                          onChange={(e) => setBulkPercentage(e.target.value)}
                          disabled={bulkApplying}
                          placeholder="-23.08"
                          className="w-32 px-3 py-1.5 rounded-lg bg-white border border-outline-variant text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <span className="text-xs text-on-surface-variant">% penyesuaian</span>
                      </div>
                    )}
                  </div>
                </div>
              </label>
            </div>

            {/* Live Preview Box */}
            {bulkTargetItems.length > 0 && (
              <div className="rounded-xl bg-surface-container-low p-3.5 border border-outline-variant space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
                    Preview Perubahan ({bulkTargetItems.length} bahan terpilih):
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs divide-y divide-outline-variant/30">
                  {bulkTargetItems.slice(0, 4).map((ing) => {
                    const currentP = Number(ing.pricePerBase);
                    let newP = currentP;
                    if (bulkMode === 'markup30') newP = Math.round((currentP / 1.3) * 100) / 100;
                    else if (bulkMode === 'gross30') newP = Math.round((currentP * 0.7) * 100) / 100;
                    else if (bulkMode === 'custom') {
                      const f = 1 + (Number(bulkPercentage) || 0) / 100;
                      newP = Math.max(0, Math.round((currentP * f) * 100) / 100);
                    }
                    return (
                      <div key={ing.id} className="pt-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-on-surface font-medium">{ing.name}</span>
                        <div className="shrink-0 font-mono text-[11px]">
                          <span className="line-through text-on-surface-variant mr-1.5">Rp{formatNum(currentP)}</span>
                          <span className="font-bold text-primary">➔ Rp{formatNum(newP)}/{ing.baseUnit}</span>
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

