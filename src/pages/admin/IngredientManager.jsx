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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [onlyUnpriced, setOnlyUnpriced] = useState(false);
  const [category, setCategory] = useState(''); // '' = semua, '__none' = tanpa kategori

  const [editing, setEditing] = useState(null); // ingredient camelCase | null
  const [overrides, setOverrides] = useState([]);
  const [aliasRows, setAliasRows] = useState([]); // { alias, _new }
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await ingredientService.listIngredients());
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
      if (ok) refresh();
    });
    return () => { active = false; };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) =>
      (!onlyUnpriced || i.pricePerBase == null) &&
      (category === '' || (category === '__none' ? i.category == null : i.category === category)) &&
      (!q || i.name.toLowerCase().includes(q))
    );
  }, [items, query, onlyUnpriced, category]);

  const pricedCount = useMemo(() => items.filter((i) => i.pricePerBase != null).length, [items]);

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
  const openCreate = () => { setEditing({ id: null, name: '', category: '', baseUnit: 'g', pricePerBase: '' }); setOverrides([]); setAliasRows([]); };
  const close = () => { setEditing(null); setOverrides([]); setAliasRows([]); };

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
      const patch = { name: editing.name, category: editing.category, baseUnit: editing.baseUnit, pricePerBase: editing.pricePerBase };
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
        <button onClick={openCreate} className="px-4 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm cursor-pointer inline-flex items-center gap-1.5 shrink-0">
          <span className="material-symbols-outlined text-[20px]">add</span> Tambah
        </button>
      </div>

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
      </div>
      {(query || category || onlyUnpriced) && (
        <p className="-mt-2 text-[11px] text-on-surface-variant">{filtered.length} bahan cocok filter. <button onClick={() => { setQuery(''); setCategory(''); setOnlyUnpriced(false); }} className="text-primary font-semibold cursor-pointer">Reset</button></p>
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
                <span className="font-semibold text-on-surface truncate block">{ing.name}</span>
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

            <div className="flex gap-3 mt-5">
              {editing.id && (
                <button onClick={handleDelete} disabled={saving} title="Hapus bahan"
                  className="py-3 px-4 border border-error/40 text-error rounded-full font-semibold text-sm cursor-pointer disabled:opacity-50 inline-flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">delete</span>
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
