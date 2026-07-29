import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRecipeById, createRecipe, updateRecipe, searchIngredients } from '../services/recipeService.js';
import { uploadRecipeImage } from '../services/storageService.js';
import { usePlan } from '../hooks/usePlan.js';
import { useAuth } from '../hooks/useAuth.js';

const STANDARD_UNITS = [
  'g', 'ml', 'sdm', 'sdt', 'buah', 'pcs', 'siung', 'lembar',
  'batang', 'bungkus', 'butir', 'potong', 'mangkuk', 'secukupnya'
];

const CUISINE_OPTIONS = [
  'Indonesian', 'Jawa', 'Padang', 'Sunda', 'Bali', 'Western',
  'Asian', 'Japanese', 'Korean', 'Chinese', 'Italian', 'Lainnya'
];

export default function RecipeFormPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = usePlan();
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [readyInMinutes, setReadyInMinutes] = useState(30);
  const [baseServings, setBaseServings] = useState(2);
  const [cuisine, setCuisine] = useState('Indonesian');
  const [isPublic, setIsPublic] = useState(true);

  // Image Upload State
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);

  // Ingredients State: [{ id, ingredientId, name, amount, unit, category }]
  const [ingredients, setIngredients] = useState([
    { ingredientId: null, name: '', amount: '1', unit: 'g', category: '' },
    { ingredientId: null, name: '', amount: '1', unit: 'sdm', category: '' }
  ]);

  // Autocomplete state per ingredient row
  const [activeSearchRow, setActiveSearchRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Cooking Steps State: array of step strings
  const [steps, setSteps] = useState([
    'Siapkan semua bahan yang diperlukan.',
    'Masak bahan utama hingga matang dan sajikan hangat.'
  ]);

  // Load existing recipe if in Edit Mode
  useEffect(() => {
    if (!isEditMode) return;
    let active = true;

    getRecipeById(id)
      .then((data) => {
        if (!active) return;
        if (data.userId && user && data.userId !== user.id) {
          setErrorMsg('Anda tidak memiliki izin untuk mengedit resep ini.');
          return;
        }

        setTitle(data.title || '');
        setDescription(data.description || '');
        setDifficulty(data.difficulty || 'easy');
        setReadyInMinutes(data.readyInMinutes || 30);
        setBaseServings(data.baseServings || 2);
        setCuisine(data.cuisine || 'Indonesian');
        setIsPublic(data.isPublic !== undefined ? data.isPublic : true);
        setImageUrl(data.imageUrl || '');
        setImagePreview(data.imageUrl || '');

        if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
          setIngredients(
            data.ingredients.map((ing) => ({
              ingredientId: ing.ingredientId || null,
              name: ing.name || '',
              amount: ing.amount != null ? String(ing.amount) : '',
              unit: ing.unit || 'g',
              category: ing.category || ''
            }))
          );
        }

        if (Array.isArray(data.instructions) && data.instructions.length > 0) {
          setSteps(data.instructions);
        } else if (typeof data.instructions === 'string') {
          setSteps(data.instructions.split('\n').filter(Boolean));
        }
      })
      .catch((err) => {
        if (active) setErrorMsg(err.message || 'Gagal memuat resep.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [id, isEditMode, user]);

  // Handle master ingredients search for autocomplete
  useEffect(() => {
    const query = searchQuery.trim();
    if (activeSearchRow === null || !query) return;

    let active = true;

    const timer = setTimeout(() => {
      setIsSearching(true);
      searchIngredients(query)
        .then((res) => {
          if (active) setSearchResults(res);
        })
        .catch((err) => console.error("Error searching ingredients:", err))
        .finally(() => {
          if (active) setIsSearching(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeSearchRow]);

  // Image Selection Handler
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 5 MB.');
      return;
    }

    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  // Ingredient Helpers
  const handleIngredientNameChange = (index, value) => {
    const next = [...ingredients];
    next[index] = {
      ...next[index],
      name: value,
      ingredientId: null // Reset ingredientId if user types custom text
    };
    setIngredients(next);
    setActiveSearchRow(index);
    setSearchQuery(value);
  };

  const handleSelectMasterIngredient = (index, masterItem) => {
    const next = [...ingredients];
    next[index] = {
      ...next[index],
      ingredientId: masterItem.id,
      name: masterItem.name,
      unit: masterItem.baseUnit || next[index].unit || 'g',
      category: masterItem.category || next[index].category || ''
    };
    setIngredients(next);
    setActiveSearchRow(null);
    setSearchQuery('');
  };

  const handleIngredientChange = (index, field, value) => {
    const next = [...ingredients];
    next[index] = { ...next[index], [field]: value };
    setIngredients(next);
  };

  const handleAddIngredient = () => {
    setIngredients([
      ...ingredients,
      { ingredientId: null, name: '', amount: '1', unit: 'g', category: '' }
    ]);
  };

  const handleRemoveIngredient = (index) => {
    if (ingredients.length <= 1) {
      showToast('Resep minimal harus memiliki 1 bahan.');
      return;
    }
    setIngredients(ingredients.filter((_, i) => i !== index));
    if (activeSearchRow === index) setActiveSearchRow(null);
  };

  // Steps Helpers
  const handleStepChange = (index, value) => {
    const next = [...steps];
    next[index] = value;
    setSteps(next);
  };

  const handleAddStep = () => {
    setSteps([...steps, '']);
  };

  const handleRemoveStep = (index) => {
    if (steps.length <= 1) {
      showToast('Resep minimal harus memiliki 1 langkah memasak.');
      return;
    }
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleMoveStep = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const next = [...steps];
    const temp = next[index];
    next[index] = next[newIndex];
    next[newIndex] = temp;
    setSteps(next);
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast('Judul resep wajib diisi.');
      return;
    }

    const validIngredients = ingredients.filter((ing) => ing.name && ing.name.trim());
    if (validIngredients.length === 0) {
      showToast('Masukkan minimal 1 bahan resep.');
      return;
    }

    const validSteps = steps.filter((st) => st && st.trim());
    if (validSteps.length === 0) {
      showToast('Masukkan minimal 1 langkah memasak.');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = imageUrl;

      // Upload image if a new file was chosen
      if (imageFile) {
        finalImageUrl = await uploadRecipeImage(imageFile);
      }

      const recipePayload = {
        title,
        description,
        difficulty,
        readyInMinutes,
        baseServings,
        cuisine,
        isPublic,
        imageUrl: finalImageUrl,
        ingredients: validIngredients,
        instructions: validSteps
      };

      if (isEditMode) {
        await updateRecipe(id, recipePayload);
        showToast(`Resep "${title}" berhasil diperbarui!`);
      } else {
        await createRecipe(recipePayload);
        showToast(`Resep "${title}" berhasil dibuat!`);
      }

      navigate('/my-recipes');
    } catch (err) {
      console.error("Gagal menyimpan resep:", err);
      let userMsg = err.message || 'Gagal menyimpan resep.';
      if (userMsg.includes('recipes_difficulty_check')) {
        userMsg = 'Pilihan tingkat kesulitan tidak valid. Harap pilih Mudah, Sedang, atau Sulit.';
      } else if (userMsg.includes('violates check constraint')) {
        userMsg = 'Isian data resep belum memenuhi format yang ditentukan. Silakan periksa kembali data Anda.';
      }
      showToast(userMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-canvas-white flex flex-col items-center justify-center p-6 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-3">progress_activity</span>
        <p className="text-sm font-medium">Memuat data resep...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-dvh bg-canvas-white flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-3">error</span>
        <h2 className="text-xl font-bold text-on-surface mb-2">{errorMsg}</h2>
        <Link to="/my-recipes" className="mt-4 px-6 py-2.5 bg-primary text-white font-bold rounded-full hover:bg-primary-container transition-all">
          Kembali ke Resep Saya
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-canvas-white min-h-dvh pb-24 pt-6 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header Breadcrumb & Title */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              aria-label="Kembali"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-primary tracking-tight">
                {isEditMode ? 'Edit Resep' : 'Buat Resep Baru'}
              </h1>
              <p className="text-xs md:text-sm text-on-surface-variant">
                {isEditMode ? 'Perbarui informasi dan bahan resep Anda' : 'Bagikan resep andalan keluarga Anda di CookPlan'}
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Card 1: Informasi Dasar */}
          <div className="bg-white rounded-3xl p-6 border border-outline-variant/60 shadow-sm space-y-5">
            <h2 className="text-lg font-bold text-primary flex items-center gap-2 border-b border-outline-variant/40 pb-3">
              <span className="material-symbols-outlined text-xl">restaurant_menu</span>
              Informasi Umum Resep
            </h2>

            {/* Title Input */}
            <div className="space-y-1.5">
              <label htmlFor="recipe-title" className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                Judul Resep <span className="text-error">*</span>
              </label>
              <input
                id="recipe-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Ayam Goreng Mentega Spesial"
                className="w-full px-4 py-3 rounded-2xl border border-outline-variant bg-surface-cream/30 text-on-surface text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            {/* Description Input */}
            <div className="space-y-1.5">
              <label htmlFor="recipe-desc" className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                Deskripsi Singkat
              </label>
              <textarea
                id="recipe-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ceritakan sedikit keunikan atau rasa khas dari hidangan ini..."
                className="w-full px-4 py-3 rounded-2xl border border-outline-variant bg-surface-cream/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary leading-relaxed"
              />
            </div>

            {/* Image Upload Area */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                Foto Resep (Maks 5 MB)
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {imagePreview ? (
                  <div className="relative w-full sm:w-48 h-36 rounded-2xl overflow-hidden border border-outline-variant group shrink-0">
                    <img src={imagePreview} alt="Preview foto resep" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview('');
                        setImageUrl('');
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-error text-white flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                      title="Hapus foto"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-48 h-36 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-cream/40 flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-surface-cream hover:border-primary/60 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-3xl text-primary mb-1">add_a_photo</span>
                    <span className="text-xs font-bold text-primary">Unggah Foto</span>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">JPG, PNG, WebP</span>
                  </div>
                )}

                <div className="flex-1 w-full space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-secondary-container/30 text-primary border border-outline-variant rounded-full text-xs font-bold hover:bg-secondary-container/50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">upload</span>
                    {imagePreview ? 'Ganti Foto' : 'Pilih File Foto'}
                  </button>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Foto resep yang menarik akan membuat lebih banyak pengguna terinspirasi untuk memasak hidangan Anda!
                  </p>
                </div>
              </div>
            </div>

            {/* Grid 2 Columns for Meta: Difficulty, Time, Servings, Cuisine */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              {/* Difficulty */}
              <div className="space-y-1.5">
                <label htmlFor="difficulty" className="block text-[11px] font-bold text-on-surface uppercase tracking-wider">
                  Tingkat Kesulitan
                </label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-white text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary"
                >
                  <option value="easy">Mudah</option>
                  <option value="medium">Sedang</option>
                  <option value="hard">Sulit</option>
                </select>
              </div>

              {/* Ready in minutes */}
              <div className="space-y-1.5">
                <label htmlFor="cooking-time" className="block text-[11px] font-bold text-on-surface uppercase tracking-wider">
                  Waktu (Menit)
                </label>
                <input
                  id="cooking-time"
                  type="number"
                  min="1"
                  max="480"
                  value={readyInMinutes}
                  onChange={(e) => setReadyInMinutes(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-white text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Base Servings */}
              <div className="space-y-1.5">
                <label htmlFor="base-servings" className="block text-[11px] font-bold text-on-surface uppercase tracking-wider">
                  Jumlah Porsi
                </label>
                <input
                  id="base-servings"
                  type="number"
                  min="1"
                  max="50"
                  value={baseServings}
                  onChange={(e) => setBaseServings(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-white text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Cuisine */}
              <div className="space-y-1.5">
                <label htmlFor="cuisine" className="block text-[11px] font-bold text-on-surface uppercase tracking-wider">
                  Masakan (Cuisine)
                </label>
                <select
                  id="cuisine"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-white text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary"
                >
                  {CUISINE_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Is Public Toggle */}
            <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between">
              <div>
                <span className="block text-sm font-bold text-on-surface">Status Publikasi</span>
                <span className="block text-xs text-on-surface-variant">
                  {isPublic
                    ? 'Publik: Dapat ditemukan di katalog & disukai oleh komunitas CookPlan'
                    : 'Draf Pribadi: Hanya dapat dilihat dan dipakai oleh Anda'}
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>

          {/* Card 2: Daftar Bahan-Bahan */}
          <div className="bg-white rounded-3xl p-6 border border-outline-variant/60 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <div>
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">grocery</span>
                  Bahan-Bahan Masakan
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Ketik nama bahan untuk memilih dari master data (estimasi harga otomatis tersedia).
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddIngredient}
                className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Tambah Bahan
              </button>
            </div>

            {/* Ingredients Table / List */}
            <div className="space-y-3">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-surface-cream/20 rounded-2xl border border-outline-variant/50">
                  {/* Row Index */}
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* Autocomplete Input Nama Bahan */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Nama bahan (mis. Daging Ayam, Bawang Merah)..."
                      value={ing.name}
                      onChange={(e) => handleIngredientNameChange(idx, e.target.value)}
                      onFocus={() => {
                        if (ing.name.trim()) {
                          setActiveSearchRow(idx);
                          setSearchQuery(ing.name);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-white text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary"
                    />

                    {/* Master Data Badge Status */}
                    {ing.ingredientId ? (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary bg-primary-container/20 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px]">verified</span> Master
                      </span>
                    ) : ing.name.trim() ? (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-on-surface-variant bg-surface-variant/40 px-1.5 py-0.5 rounded" title="Bahan manual pengguna (tanpa master ID)">
                        Manual
                      </span>
                    ) : null}

                    {/* Autocomplete Dropdown Popup */}
                    {activeSearchRow === idx && (searchResults.length > 0 || isSearching) && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-outline-variant shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-outline-variant/30">
                        {isSearching ? (
                          <div className="p-3 text-xs text-on-surface-variant text-center flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined animate-spin text-base text-primary">progress_activity</span>
                            Mencari bahan...
                          </div>
                        ) : (
                          searchResults.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectMasterIngredient(idx, item)}
                              className="w-full p-2.5 text-left hover:bg-surface-cream flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <div>
                                <span className="block text-xs font-bold text-on-surface">{item.name}</span>
                                {item.category && (
                                  <span className="block text-[10px] text-on-surface-variant capitalize">{item.category}</span>
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                {item.baseUnit || 'g'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quantity Amount */}
                  <div className="w-full sm:w-24">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Jumlah"
                      value={ing.amount}
                      onChange={(e) => handleIngredientChange(idx, 'amount', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-white text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Unit Select */}
                  <div className="w-full sm:w-28">
                    <select
                      value={ing.unit}
                      onChange={(e) => handleIngredientChange(idx, 'unit', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-white text-xs font-semibold text-on-surface focus:ring-2 focus:ring-primary"
                    >
                      {STANDARD_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveIngredient(idx)}
                    className="w-9 h-9 rounded-xl bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-colors shrink-0 cursor-pointer self-end sm:self-center"
                    title="Hapus Bahan"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Langkah-Langkah Memasak */}
          <div className="bg-white rounded-3xl p-6 border border-outline-variant/60 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <div>
                <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">skillet</span>
                  Langkah-Langkah Memasak
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Tulis instruksi memasak urut dari awal hingga sajian siap dihidangkan.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddStep}
                className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Tambah Langkah
              </button>
            </div>

            {/* Steps List */}
            <div className="space-y-3">
              {steps.map((stepText, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-surface-cream/20 rounded-2xl border border-outline-variant/50">
                  {/* Step Number */}
                  <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-1">
                    {idx + 1}
                  </span>

                  {/* Step Textarea */}
                  <textarea
                    rows={2}
                    value={stepText}
                    onChange={(e) => handleStepChange(idx, e.target.value)}
                    placeholder={`Langkah ${idx + 1}: Jelaskan proses memasak...`}
                    className="flex-1 px-3 py-2 rounded-xl border border-outline-variant bg-white text-xs text-on-surface leading-relaxed focus:ring-2 focus:ring-primary"
                  />

                  {/* Action Controls: Move Up/Down & Remove */}
                  <div className="flex flex-col gap-1 shrink-0">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMoveStep(idx, -1)}
                        className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        title="Naikkan"
                      >
                        <span className="material-symbols-outlined text-sm">arrow_upward</span>
                      </button>
                    )}
                    {idx < steps.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMoveStep(idx, 1)}
                        className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        title="Turunkan"
                      >
                        <span className="material-symbols-outlined text-sm">arrow_downward</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="w-7 h-7 rounded-lg bg-error/10 text-error flex items-center justify-center hover:bg-error/20 transition-colors cursor-pointer"
                      title="Hapus Langkah"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/my-recipes')}
              disabled={saving}
              className="px-6 py-3 rounded-full border border-outline-variant text-on-surface-variant font-bold text-sm hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 rounded-full bg-primary text-white font-bold text-sm hover:bg-primary-container transition-all shadow-md cursor-pointer disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Menyimpan Resep...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">save</span>
                  {isEditMode ? 'Simpan Perubahan' : 'Terbitkan Resep'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
