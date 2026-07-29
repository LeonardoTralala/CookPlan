import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyRecipes, deleteRecipe } from '../services/recipeService.js';
import { usePlan } from '../hooks/usePlan.js';
import { Modal } from '../components/Modal.jsx';

export default function MyRecipesPage() {
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterTab, setFilterTab] = useState('semua'); // 'semua' | 'publik' | 'draf'

  // Modal konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    getMyRecipes()
      .then((data) => {
        if (active) {
          setRecipes(data);
          setErrorMsg('');
        }
      })
      .catch((err) => {
        console.error("Gagal memuat resep saya:", err);
        if (active) setErrorMsg(err.message || 'Gagal memuat daftar resep Anda.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Filter resep berdasarkan tab aktif
  const filteredRecipes = useMemo(() => {
    if (filterTab === 'publik') return recipes.filter((r) => r.isPublic);
    if (filterTab === 'draf') return recipes.filter((r) => !r.isPublic);
    return recipes;
  }, [recipes, filterTab]);

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRecipe(deleteTarget.id);
      showToast(`Resep "${deleteTarget.title}" berhasil dihapus.`);
      setRecipes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Gagal menghapus resep:", err);
      showToast(err.message || 'Gagal menghapus resep.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-canvas-white min-h-dvh pb-24 pt-6 px-Margin-mobile md:px-margin-desktop">
      <div className="max-w-container-max mx-auto">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary tracking-tight">
              Resep Saya
            </h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
              Kelola resep kreasi buatan Anda yang tersimpan di CookPlan
            </p>
          </div>

          <Link
            to="/recipes/create"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-bold text-sm hover:bg-primary-container transition-all shadow-md shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            + Buat Resep Baru
          </Link>
        </div>

        {/* Tab Filter */}
        <div className="flex items-center gap-2 mb-6 border-b border-outline-variant/40 pb-3 overflow-x-auto">
          {[
            { id: 'semua', label: 'Semua Resep', count: recipes.length },
            { id: 'publik', label: 'Publik', count: recipes.filter((r) => r.isPublic).length },
            { id: 'draf', label: 'Draf Pribadi', count: recipes.filter((r) => !r.isPublic).length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-cream/50 text-primary border border-outline-variant hover:bg-primary-container hover:text-white'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterTab === tab.id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Recipe Grid / Content State */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-3xl p-4 border border-outline-variant animate-pulse space-y-3">
                <div className="w-full h-36 bg-surface-container rounded-2xl"></div>
                <div className="h-5 bg-surface-container rounded w-3/4"></div>
                <div className="h-4 bg-surface-container rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : errorMsg ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-error/30 p-8">
            <span className="material-symbols-outlined text-5xl text-error mb-3">error</span>
            <h3 className="text-lg font-bold text-on-surface mb-1">Gagal Memuat Resep</h3>
            <p className="text-sm text-on-surface-variant mb-4">{errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-primary text-white font-bold rounded-full text-xs hover:bg-primary-container transition-all cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-outline-variant p-8 max-w-md mx-auto">
            <span className="material-symbols-outlined text-6xl text-outline-variant mb-3">
              set_meal
            </span>
            <h3 className="text-lg font-bold text-on-surface mb-1">
              {filterTab === 'semua'
                ? 'Belum Ada Resep Kreasi'
                : filterTab === 'publik'
                ? 'Belum Ada Resep Publik'
                : 'Belum Ada Draf Resep'}
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
              Buat resep kuliner Anda sendiri untuk disimpan atau dibagikan ke komunitas CookPlan!
            </p>
            <Link
              to="/recipes/create"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-bold text-xs hover:bg-primary-container transition-all shadow-md"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Buat Resep Pertama Anda
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-white rounded-3xl border border-outline-variant/60 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                {/* Image Header */}
                <div className="relative h-40 overflow-hidden bg-surface-container">
                  <img
                    src={recipe.imageUrl || '/img/recipe-placeholder.svg'}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                  />

                  {/* Public / Draft Badge */}
                  <div className="absolute top-3 left-3">
                    {recipe.isPublic ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wide shadow-sm flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">public</span> Publik
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-600 text-white font-extrabold text-[10px] uppercase tracking-wide shadow-sm flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">lock</span> Draf
                      </span>
                    )}
                  </div>

                  {/* Likes Count */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-error flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-sm text-error fill">favorite</span>
                    <span>{recipe.likesCount || 0}</span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-extrabold text-base text-on-surface line-clamp-1 mb-1">
                      {recipe.title}
                    </h3>
                    <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                      {recipe.description || 'Tidak ada deskripsi.'}
                    </p>

                    {/* Meta info chips */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-primary">schedule</span>
                        {recipe.readyInMinutes || 30} mnt
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-primary">group</span>
                        {recipe.baseServings || 2} porsi
                      </span>
                      <span className="capitalize font-semibold text-primary">
                        {recipe.difficulty === 'easy' ? 'Mudah' : recipe.difficulty === 'medium' ? 'Sedang' : recipe.difficulty === 'hard' ? 'Sulit' : (recipe.difficulty || 'Mudah')}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between border-t border-outline-variant/40 pt-3 gap-2">
                    <button
                      onClick={() => navigate(`/recipes/${recipe.id}/edit`)}
                      className="flex-1 py-2 px-3 rounded-full border border-primary text-primary font-bold text-xs hover:bg-primary/5 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                      Edit
                    </button>

                    <button
                      onClick={() => setDeleteTarget(recipe)}
                      className="py-2 px-3 rounded-full border border-error/40 text-error font-bold text-xs hover:bg-error/10 transition-colors cursor-pointer flex items-center justify-center gap-1"
                      title="Hapus Resep"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)}>
        <div className="w-full max-w-sm bg-canvas-white rounded-3xl p-6 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-error/10 text-error mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">delete_forever</span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-on-surface">Hapus Resep Ini?</h3>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Apakah Anda yakin ingin menghapus resep <strong className="text-on-surface">"{deleteTarget?.title}"</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-full border border-outline-variant text-on-surface-variant font-bold text-xs hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-full bg-error text-white font-bold text-xs hover:bg-error/90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {deleting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
