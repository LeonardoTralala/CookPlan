import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkIsAdmin } from '../../services/adminService.js';
import * as recipeAdmin from '../../services/adminRecipeService.js';
import { usePlan } from '../../hooks/usePlan.js';
import { formatRupiah } from '../../utils/buildShoppingList.js';

const DIFFICULTIES = [
  { value: 'easy', label: 'Mudah' },
  { value: 'medium', label: 'Sedang' },
  { value: 'hard', label: 'Sulit' },
];

const CATEGORIES = [
  { value: '', label: '—' },
  { value: 'vegetables', label: 'Sayur' },
  { value: 'meat', label: 'Daging' },
  { value: 'dairy', label: 'Olahan susu' },
  { value: 'spices', label: 'Bumbu' },
  { value: 'dry_goods', label: 'Bahan kering' },
];

const EMPTY_RECIPE = {
  title: '', description: '', cuisine: '', difficulty: 'easy',
  readyInMinutes: '', calories: '', priceIdr: '', baseServings: 2,
  badges: [], tags: [], instructions: [], ingredientsText: '',
  imageUrl: '', isActive: true,
};

const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
let rowKey = 0;
const newRow = () => ({ _key: `r${++rowKey}`, _id: null, name: '', amount: '', unit: '', category: '', priceIdr: '' });

// Admin UI: kelola bank resep (harga, foto, deskripsi, bahan, langkah).
// Tulis langsung lewat RLS admin (adminRecipeService) — tanpa Edge Function.
export function RecipeManager() {
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [allowed, setAllowed] = useState(null); // null=checking
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [editing, setEditing] = useState(null); // recipe camelCase | null
  const [ingredients, setIngredients] = useState([]);
  const [origIds, setOrigIds] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);

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
      if (ok) refresh();
    });
    return () => { active = false; };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title?.toLowerCase().includes(q));
  }, [recipes, query]);

  const openCreate = () => {
    setEditing({ ...EMPTY_RECIPE });
    setIngredients([newRow()]);
    setOrigIds([]);
    setImageFile(null);
    setImagePreview('');
  };

  const openEdit = async (r) => {
    setEditing({ ...EMPTY_RECIPE, ...r });
    setImageFile(null);
    setImagePreview(r.imageUrl || '');
    setIngredients([]);
    setOrigIds([]);
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
  const addRow = () => setIngredients((rows) => [...rows, newRow()]);
  const removeRow = (key) => setIngredients((rows) => rows.filter((r) => r._key !== key));

  const syncIngredients = async (recipeId) => {
    const kept = ingredients.filter((r) => r.name?.trim());
    const keptIds = kept.map((r) => r._id).filter(Boolean);
    const deleted = origIds.filter((id) => !keptIds.includes(id));
    for (const id of deleted) await recipeAdmin.deleteIngredient(id);
    for (const row of kept) {
      if (row._id) await recipeAdmin.updateIngredient(row._id, row);
      else await recipeAdmin.addIngredient(recipeId, row);
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
        priceIdr: numOrNull(editing.priceIdr),
        baseServings: Number(editing.baseServings) || 2,
        badges: editing.badges,
        tags: editing.tags,
        instructions: editing.instructions,
        ingredientsText: editing.ingredientsText || null,
        isActive: editing.isActive,
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

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari resep…"
        className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
      />

      {loading ? (
        <div className="flex justify-center py-16"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-sm text-on-surface-variant py-8">Tidak ada resep.</p>}
          {filtered.map((r) => (
            <div key={r.id} className={`rounded-2xl border p-3 flex items-center gap-3 ${r.isActive ? 'border-outline-variant' : 'border-error/30 bg-error/5'}`}>
              <div className="w-14 h-14 rounded-xl bg-surface-container-high overflow-hidden shrink-0">
                {r.imageUrl && <img src={r.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-on-surface truncate">{r.title}</span>
                  {!r.isActive && <span className="text-[10px] font-bold uppercase bg-error text-white px-2 py-0.5 rounded-full">Disembunyikan</span>}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {formatRupiah(r.priceIdr)} · {r.ingredients?.length ?? 0} bahan
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(r)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-outline-variant text-on-surface-variant hover:bg-surface-container-low cursor-pointer">Edit</button>
                <button onClick={() => handleDelete(r)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-error/40 text-error hover:bg-error/10 cursor-pointer">Hapus</button>
              </div>
            </div>
          ))}
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Waktu (menit)"><TextInput type="number" value={editing.readyInMinutes ?? ''} onChange={(v) => setField('readyInMinutes', v)} /></Field>
                <Field label="Kalori"><TextInput type="number" value={editing.calories ?? ''} onChange={(v) => setField('calories', v)} /></Field>
                <Field label="Harga total (Rp)"><TextInput type="number" value={editing.priceIdr ?? ''} onChange={(v) => setField('priceIdr', v)} /></Field>
                <Field label="Porsi dasar"><TextInput type="number" value={editing.baseServings ?? 2} onChange={(v) => setField('baseServings', v)} /></Field>
              </div>

              <Field label="Tag (pisahkan dengan koma)">
                <TextInput value={editing.tags.join(', ')} onChange={(v) => setField('tags', splitCsv(v))} placeholder="halal, tinggi-protein" />
              </Field>
              <Field label="Badge tampilan (pisahkan dengan koma)">
                <TextInput value={editing.badges.join(', ')} onChange={(v) => setField('badges', splitCsv(v))} placeholder="Cepat, Hemat" />
              </Field>
              <Field label="Langkah memasak (satu langkah per baris)">
                <textarea
                  value={editing.instructions.join('\n')}
                  onChange={(e) => setField('instructions', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
              </Field>

              {/* Bahan */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-xs font-semibold text-on-surface">Bahan</span>
                  <button onClick={addRow} className="text-xs font-semibold text-primary inline-flex items-center gap-1 cursor-pointer">
                    <span className="material-symbols-outlined text-[18px]">add</span> Baris
                  </button>
                </div>
                <div className="space-y-2">
                  {ingredients.map((row) => (
                    <div key={row._key} className="grid grid-cols-12 gap-1.5 items-center">
                      <input value={row.name} onChange={(e) => setIngredient(row._key, 'name', e.target.value)} placeholder="Nama" className="col-span-4 px-2.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      <input value={row.amount} onChange={(e) => setIngredient(row._key, 'amount', e.target.value)} placeholder="Jml" type="number" className="col-span-2 px-2.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      <input value={row.unit} onChange={(e) => setIngredient(row._key, 'unit', e.target.value)} placeholder="gr" className="col-span-2 px-2.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      <select value={row.category ?? ''} onChange={(e) => setIngredient(row._key, 'category', e.target.value)} className="col-span-2 px-1 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <input value={row.priceIdr} onChange={(e) => setIngredient(row._key, 'priceIdr', e.target.value)} placeholder="Rp" type="number" className="col-span-1 px-1.5 py-2 rounded-lg bg-white border border-outline-variant text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      <button onClick={() => removeRow(row._key)} className="col-span-1 flex justify-center text-error cursor-pointer" title="Hapus bahan">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer pt-1">
                <input type="checkbox" checked={!editing.isActive} onChange={(e) => setField('isActive', !e.target.checked)} />
                Sembunyikan dari katalog (is_active = false)
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
