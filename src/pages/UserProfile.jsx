import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSavedRecipes, unsaveRecipe } from '../services/recipeService.js';
import { getProfile, updateProfile, uploadAvatar } from '../services/profileService.js';
import { getActiveDietTags } from '../services/dietService.js';
import { usePlan } from '../hooks/usePlan.js';
import { useAuth } from '../hooks/useAuth.js';
import { AVATAR_URL } from '../utils/userConfig.js';
import { Modal } from '../components/Modal.jsx';
import { SettingsDrawer } from '../components/SettingsDrawer.jsx';

// Item navigasi Pengaturan. Dipakai bersama oleh sidebar (desktop) & drawer (mobile).
const SETTINGS_NAV = [
  { id: 'personal', icon: 'person', label: 'Info Personal' },
  { id: 'orders', icon: 'receipt_long', label: 'Riwayat Pesanan' },
  { id: 'addresses', icon: 'location_on', label: 'Alamat' },
  { id: 'preferences', icon: 'tune', label: 'Preferensi' },
  { id: 'saved', icon: 'bookmark', label: 'Resep Tersimpan' },
  { id: 'security', icon: 'shield', label: 'Keamanan' },
  { id: 'subscription', icon: 'payments', label: 'Langganan' }
];

// Panel yang kontennya belum dibangun — render placeholder Coming Soon konsisten
// dengan kartu Manajemen Langganan.
const COMING_SOON = {
  orders: { icon: 'receipt_long', title: 'Riwayat Pesanan', desc: 'Lacak pesanan bahan & paket masakanmu di sini.' },
  addresses: { icon: 'location_on', title: 'Alamat', desc: 'Simpan alamat pengiriman untuk checkout lebih cepat.' }
};

// Daftar navigasi Pengaturan + blok Bantuan & Legal. Dipakai di sidebar desktop
// (asTablist: tab ARIA penuh + navigasi panah) dan di dalam SettingsDrawer mobile
// (asTablist=false: menu navigasi biasa, hindari duplikasi id tab di DOM).
function SettingsNavList({ activeNav, onSelect, onSoon, asTablist = false }) {
  const tabRefs = useRef({});

  // Navigasi panah antar-tab (roving tabindex) — hanya pada mode tablist desktop.
  const handleKeyDown = (e, idx) => {
    if (!asTablist) return;
    let nextIdx = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nextIdx = (idx + 1) % SETTINGS_NAV.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nextIdx = (idx - 1 + SETTINGS_NAV.length) % SETTINGS_NAV.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = SETTINGS_NAV.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    const nextId = SETTINGS_NAV[nextIdx].id;
    onSelect(nextId);
    tabRefs.current[nextId]?.focus();
  };

  return (
    <>
      <div
        role={asTablist ? 'tablist' : undefined}
        aria-orientation={asTablist ? 'vertical' : undefined}
        aria-label={asTablist ? 'Pengaturan' : undefined}
        className="space-y-2"
      >
        {SETTINGS_NAV.map((item, idx) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              ref={(el) => { tabRefs.current[item.id] = el; }}
              onClick={() => onSelect(item.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              role={asTablist ? 'tab' : undefined}
              id={asTablist ? `tab-${item.id}` : undefined}
              aria-selected={asTablist ? active : undefined}
              aria-controls={asTablist ? 'settings-panel' : undefined}
              aria-current={!asTablist && active ? 'page' : undefined}
              tabIndex={asTablist ? (active ? 0 : -1) : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors cursor-pointer ${active
                ? 'bg-surface-cream text-primary font-bold shadow-[0_4px_20px_-4px_rgba(44,58,30,0.04)]'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
                }`}
            >
              <span className={`material-symbols-outlined ${active ? 'fill' : ''}`}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="pt-6 mt-6 border-t border-outline-variant">
        <h3 className="text-xs font-semibold text-on-surface mb-3 px-4 uppercase tracking-widest">
          Bantuan &amp; Legal
        </h3>
        <button
          onClick={() => onSoon('Customer Service')}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors text-sm font-medium cursor-pointer text-left"
        >
          <span className="material-symbols-outlined text-[20px]">support_agent</span>
          Layanan Pelanggan
        </button>
        <button
          onClick={() => onSoon('Privacy Policy')}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors text-sm font-medium cursor-pointer text-left"
        >
          <span className="material-symbols-outlined text-[20px]">policy</span>
          Kebijakan Privasi
        </button>
      </div>
    </>
  );
}

// Placeholder untuk panel yang fiturnya belum siap.
function ComingSoonPanel({ icon, title, desc }) {
  return (
    <section className="space-y-6">
      <h3 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-2 inline-block">
        {title}
      </h3>
      <div className="p-10 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-surface-cream flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-[28px]">{icon}</span>
        </div>
        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest">
          Coming Soon
        </span>
        <p className="text-sm text-on-surface-variant max-w-xs">{desc}</p>
      </div>
    </section>
  );
}

function UserProfile() {
  const { showToast } = usePlan();
  const { user, updatePassword } = useAuth();
  const soon = (fitur) => showToast(`Fitur ${fitur} sedang dikembangkan oleh rekan tim!`);

  // Tab aktif disimpan di URL (?tab=...) supaya refresh, bookmark, dan tombol
  // back/forward browser konsisten. Nilai tak dikenal jatuh ke 'saved'.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeNav = SETTINGS_NAV.some((i) => i.id === tabParam) ? tabParam : 'saved';
  const setActiveNav = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    });
  };

  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [savedSearch, setSavedSearch] = useState('');

  // Profil dimuat dari tabel public.profiles (sumber kebenaran). Diperbarui
  // lokal setiap kali updateProfile mengembalikan baris terbaru.
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    let active = true;
    getProfile()
      .then((p) => { if (active) setProfile(p); })
      .catch((err) => { console.error('Gagal memuat profil:', err); });
    return () => { active = false; };
  }, []);

  // Nilai dari profil (tanpa fallback email/'Pengguna') untuk prefill form edit.
  const metaName = profile?.fullName || '';
  const metaGender = profile?.gender || '';

  // profile.gender adalah sumber kebenaran; override lokal hanya untuk tampilan
  // optimistic selama proses simpan.
  const [genderOverride, setGenderOverride] = useState(null);
  const [savingGender, setSavingGender] = useState(false);
  const gender = genderOverride ?? metaGender;

  const handleGenderChange = async (value) => {
    setGenderOverride(value); // optimistic
    setSavingGender(true);
    try {
      const updated = await updateProfile({ gender: value });
      setProfile(updated);     // profil kini jadi sumber kebenaran
      setGenderOverride(null);
      showToast('Jenis kelamin diperbarui.');
    } catch (err) {
      setGenderOverride(null); // rollback ke nilai profil
      showToast(err.message || 'Gagal memperbarui jenis kelamin.');
    } finally {
      setSavingGender(false);
    }
  };

  // Modal Edit Profil (nama lengkap + jenis kelamin).
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const openEdit = () => {
    setEditName(metaName);
    setEditGender(metaGender);
    setEditOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (editName.trim() === '') {
      showToast('Nama tidak boleh kosong.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateProfile({ fullName: editName, gender: editGender });
      setProfile(updated);
      showToast('Profil berhasil diperbarui.');
      setEditOpen(false);
    } catch (err) {
      showToast(err.message || 'Gagal memperbarui profil.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Foto profil: input file tersembunyi dipicu lewat klik avatar. URL disimpan
  // di profiles.avatar_url; fallback ke placeholder bila kosong / gagal muat.
  const avatarInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarSrc = profile?.avatarUrl || AVATAR_URL;

  const handleAvatarPick = () => {
    if (uploadingAvatar) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset agar pilih file yang sama lagi tetap memicu onChange
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const updated = await uploadAvatar(file);
      setProfile(updated);
      showToast('Foto profil diperbarui.');
    } catch (err) {
      showToast(err.message || 'Gagal mengunggah foto profil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Modal Ubah Kata Sandi. Memakai AuthContext.updatePassword (updateUser).
  // Validasi sama dengan alur recovery di AuthPage: min 6 karakter + konfirmasi.
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const openPassword = () => {
    setNewPw('');
    setConfirmPw('');
    setShowPw(false);
    setPwOpen(true);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPw.length < 6) {
      showToast('Kata sandi minimal 6 karakter.');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await updatePassword(newPw);
      if (error) throw error;
      showToast('Kata sandi berhasil diperbarui.');
      setPwOpen(false);
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      showToast(
        msg.includes('should be at least')
          ? 'Kata sandi minimal 6 karakter.'
          : err?.message || 'Gagal memperbarui kata sandi.'
      );
    } finally {
      setSavingPw(false);
    }
  };

  // Data identitas. Nama dari profil; email & tanggal gabung dari sesi/auth.
  const displayName = metaName || user?.email?.split('@')[0] || 'Pengguna';
  const displayEmail = user?.email || '-';
  const joinedAtSource = profile?.createdAt || user?.created_at;
  const joinedAt = joinedAtSource
    ? new Date(joinedAtSource).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
    : null;

  // Akun terhubung: status nyata dari sesi auth (bukan data dummy). Supabase
  // menaruh provider di app_metadata.providers dan/atau daftar identities.
  const authProviders = user?.app_metadata?.providers
    ?? (user?.app_metadata?.provider ? [user.app_metadata.provider] : []);
  const googleConnected = authProviders.includes('google')
    || (user?.identities ?? []).some((i) => i.provider === 'google');
  const emailVerified = Boolean(user?.email_confirmed_at);

  // Resep tersimpan milik pengguna (dari tabel saved_recipes via RLS).
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  useEffect(() => {
    let active = true;
    getSavedRecipes()
      .then((data) => { if (active) setSavedRecipes(data); })
      .catch((err) => {
        // Log gagal fetch supaya tidak silent (audit Copilot). UI fallback ke
        // state kosong, jadi user tetap bisa lihat profil tanpa Resep Tersimpan.
        console.error("Gagal memuat resep tersimpan:", err);
      })
      .finally(() => { if (active) setLoadingSaved(false); });
    return () => { active = false; };
  }, []);

  // Hapus resep dari tersimpan (optimistic + rollback bila gagal).
  const handleRemoveSaved = async (recipeId) => {
    const prev = savedRecipes;
    setSavedRecipes((list) => list.filter((r) => r.id !== recipeId));
    try {
      await unsaveRecipe(recipeId);
      showToast('Resep dihapus dari tersimpan.');
    } catch (err) {
      setSavedRecipes(prev); // rollback
      showToast(err.message || 'Gagal menghapus resep.');
    }
  };

  const filteredSaved = useMemo(() => {
    if (savedSearch.trim() === '') return savedRecipes;
    const q = savedSearch.toLowerCase();
    return savedRecipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [savedRecipes, savedSearch]);

  // Preferensi diet: pool referensi publik (diet_tags) + pilihan tersimpan
  // pengguna (profiles.diet_prefs). Toggle persist optimistic; dipakai untuk
  // prefill wizard generate-plan.
  const [dietTags, setDietTags] = useState([]);
  const [loadingDietTags, setLoadingDietTags] = useState(true);
  useEffect(() => {
    let active = true;
    getActiveDietTags()
      .then((rows) => { if (active) setDietTags(rows); })
      .catch((err) => { console.error('Gagal memuat opsi preferensi diet:', err); })
      .finally(() => { if (active) setLoadingDietTags(false); });
    return () => { active = false; };
  }, []);

  // profile.dietPrefs adalah sumber kebenaran; override lokal hanya untuk tampilan
  // optimistic selama proses simpan (pola sama dengan genderOverride).
  const [dietOverride, setDietOverride] = useState(null);
  const [savingDiet, setSavingDiet] = useState(false);
  const dietPrefs = dietOverride ?? (profile?.dietPrefs ?? []);

  const handleToggleDiet = async (value) => {
    const next = dietPrefs.includes(value)
      ? dietPrefs.filter((v) => v !== value)
      : [...dietPrefs, value];
    setDietOverride(next); // optimistic
    setSavingDiet(true);
    try {
      const updated = await updateProfile({ dietPrefs: next });
      setProfile(updated);   // profil kini jadi sumber kebenaran
      setDietOverride(null);
    } catch (err) {
      setDietOverride(null); // rollback ke nilai profil
      showToast(err.message || 'Gagal menyimpan preferensi.');
    } finally {
      setSavingDiet(false);
    }
  };

  // Pilih item nav: set panel aktif & tutup drawer (no-op di desktop).
  const handleSelectNav = (id) => {
    setActiveNav(id);
    setNavDrawerOpen(false);
  };
  const handleDrawerSoon = (fitur) => {
    soon(fitur);
    setNavDrawerOpen(false);
  };
  const activeLabel = SETTINGS_NAV.find((i) => i.id === activeNav)?.label ?? 'Pengaturan';

  // Konten panel sesuai tab aktif. Section yang belum dibangun → ComingSoonPanel.
  const renderPanel = () => {
    if (COMING_SOON[activeNav]) return <ComingSoonPanel {...COMING_SOON[activeNav]} />;

    switch (activeNav) {
      case 'saved':
        return (
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-2 inline-block">
                Resep Tersimpan
              </h3>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-grow md:w-64">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={savedSearch}
                    onChange={(e) => setSavedSearch(e.target.value)}
                    placeholder="Cari resep tersimpan..."
                    className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  onClick={() => soon('Tambah Koleksi Resep')}
                  className="flex items-center justify-center p-2 bg-surface-cream text-primary rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
                  aria-label="Tambah koleksi resep"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">add</span>
                </button>
              </div>
            </div>

            {loadingSaved ? (
              <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-2" aria-hidden="true">progress_activity</span>
                <p className="text-sm">Memuat resep tersimpan…</p>
              </div>
            ) : savedRecipes.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl text-outline-variant mb-2 block">
                  bookmark_border
                </span>
                <p className="text-sm">Belum ada resep tersimpan.</p>
                <p className="text-xs mt-1">Simpan resep favoritmu dari halaman Katalog.</p>
              </div>
            ) : filteredSaved.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl text-outline-variant mb-2 block">
                  sentiment_dissatisfied
                </span>
                <p className="text-sm">Resep tidak ditemukan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSaved.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="group cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary rounded-2xl"
                    role="button"
                    tabIndex={0}
                    onClick={() => soon('Detail Resep')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        soon('Detail Resep');
                      }
                    }}
                  >
                    <div className="relative aspect-video rounded-2xl overflow-hidden mb-3 recipe-card-shadow">
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveSaved(recipe.id); }}
                        className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-full text-error hover:bg-white transition-colors cursor-pointer"
                        aria-label="Hapus resep tersimpan"
                      >
                        <span className="material-symbols-outlined fill text-[20px]" aria-hidden="true">favorite</span>
                      </button>
                    </div>
                    <p className="text-sm font-medium text-on-surface line-clamp-1">{recipe.title}</p>
                    <p className="text-xs text-on-surface-variant">{recipe.readyInMinutes} mnt</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        );

      case 'personal':
        return (
          <section className="space-y-6">
            <h3 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-2 inline-block">
              Akun Terhubung
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest flex items-center gap-4 hover:shadow-[0_4px_20px_-4px_rgba(44,58,30,0.04)] transition-all">
                <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined">mail</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{displayEmail}</p>
                  <p className={`text-xs font-semibold ${emailVerified ? 'text-success-green' : 'text-on-surface-variant'}`}>
                    {emailVerified ? 'Email terverifikasi' : 'Email belum terverifikasi'}
                  </p>
                </div>
              </div>
              {/* Google */}
              <div className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest flex items-center gap-4 hover:shadow-[0_4px_20px_-4px_rgba(44,58,30,0.04)] transition-all">
                <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined">account_circle</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface">Google</p>
                  <p className={`text-xs font-semibold ${googleConnected ? 'text-success-green' : 'text-on-surface-variant'}`}>
                    {googleConnected ? 'Terhubung' : 'Belum terhubung'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        );

      case 'security':
        return (
          <section className="space-y-6">
            <h3 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-2 inline-block">
              Keamanan Akun
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={openPassword}
                className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest flex items-center justify-between hover:shadow-[0_4px_20px_-4px_rgba(44,58,30,0.04)] transition-all cursor-pointer group text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">lock</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">Ubah Kata Sandi</p>
                    <p className="text-xs text-on-surface-variant">Perbarui kata sandi akun Anda</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
                  chevron_right
                </span>
              </button>
              <button
                onClick={() => soon('Autentikasi Dua Faktor')}
                className="p-5 rounded-2xl border border-outline-variant bg-surface-container-lowest flex items-center justify-between hover:shadow-[0_4px_20px_-4px_rgba(44,58,30,0.04)] transition-all cursor-pointer group text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">security</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">Autentikasi Dua Faktor</p>
                    <p className="text-xs text-on-surface-variant">Amankan login Anda dengan 2FA</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
                  chevron_right
                </span>
              </button>
            </div>
          </section>
        );

      case 'preferences':
        return (
          <section className="space-y-6">
            <h3 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-2 inline-block">
              Preferensi Diet
            </h3>
            <p className="text-sm text-on-surface-variant -mt-2">
              Pilihanmu tersimpan otomatis dan dipakai sebagai bawaan saat membuat rencana makan dengan AI.
            </p>

            {loadingDietTags ? (
              <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-2" aria-hidden="true">progress_activity</span>
                <p className="text-sm">Memuat preferensi…</p>
              </div>
            ) : dietTags.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl text-outline-variant mb-2 block">tune</span>
                <p className="text-sm">Opsi preferensi belum tersedia.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {dietTags.map((tag) => {
                    const active = dietPrefs.includes(tag.value);
                    return (
                      <button
                        key={tag.value}
                        onClick={() => handleToggleDiet(tag.value)}
                        disabled={savingDiet}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait ${active
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-cream text-on-surface-variant hover:bg-surface-variant'
                          }`}
                      >
                        <span className={`material-symbols-outlined text-[18px] ${active ? 'fill' : ''}`} aria-hidden="true">
                          {active ? 'check_circle' : 'add'}
                        </span>
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-on-surface-variant">
                  {dietPrefs.length > 0
                    ? `${dietPrefs.length} preferensi dipilih.`
                    : 'Belum ada preferensi dipilih.'}
                </p>
              </>
            )}
          </section>
        );

      case 'subscription':
        return (
          <section className="space-y-6">
            <h3 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-2 inline-block">
              Manajemen Langganan
            </h3>
            <div className="p-10 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-surface-cream flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[28px]">card_membership</span>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest">
                Coming Soon
              </span>
              <p className="font-headline-md text-headline-md text-primary">Paket Premium</p>
              <p className="text-sm text-on-surface-variant">Segera hadir — semua fitur masih gratis.</p>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-canvas-white text-on-surface min-h-dvh">
      <div className="w-full max-w-container-max mx-auto px-5 md:px-10 py-8 md:py-16 space-y-8">
        {/* ---------------- Header profil (persisten, semua ukuran) ---------------- */}
        <section className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-[0_8px_24px_-8px_rgba(44,58,30,0.04)]">
          <div
            className="relative group cursor-pointer"
            onClick={handleAvatarPick}
            role="button"
            tabIndex={0}
            aria-label="Ubah foto profil"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAvatarPick();
              }
            }}
          >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-surface-cream bg-surface-variant flex items-center justify-center shadow-sm">
              <img
                src={avatarSrc}
                alt={displayName}
                onError={(e) => { e.currentTarget.src = AVATAR_URL; }}
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className={`absolute inset-0 bg-primary/20 flex items-center justify-center rounded-full backdrop-blur-sm transition-opacity ${uploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
            >
              <span className={`material-symbols-outlined text-white ${uploadingAvatar ? 'animate-spin' : ''}`}>
                {uploadingAvatar ? 'progress_activity' : 'photo_camera'}
              </span>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-grow text-center md:text-left space-y-2 mt-2 md:mt-4">
            <h1 className="font-headline-xl text-headline-lg md:text-headline-xl text-primary tracking-tight leading-tight">
              {displayName}
            </h1>
            <p className="text-lg text-on-surface-variant">{displayEmail}</p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-on-primary rounded-full text-xs font-semibold shadow-sm">
                <span className="material-symbols-outlined text-[14px] fill">verified</span> Akun Aktif
              </span>
              {joinedAt && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container-lowest border border-outline-variant text-on-surface-variant rounded-full text-xs font-semibold">
                  Bergabung {joinedAt}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container-low border border-outline-variant text-on-surface-variant rounded-full text-xs font-semibold">
                <span className="material-symbols-outlined text-[14px]">wc</span>
                Jenis Kelamin:
                <select
                  value={gender}
                  onChange={(e) => handleGenderChange(e.target.value)}
                  disabled={savingGender}
                  className="bg-transparent border-none p-0 pr-1 focus:ring-0 text-xs font-semibold cursor-pointer outline-none disabled:opacity-60 disabled:cursor-wait"
                >
                  <option value="" disabled>Pilih</option>
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                </select>
              </span>
            </div>
          </div>

          <button
            onClick={openEdit}
            className="w-full md:w-auto flex items-center justify-center px-6 py-3 bg-primary text-white rounded-full text-sm font-semibold hover:bg-surface-tint transition-colors shadow-sm cursor-pointer shrink-0"
          >
            Edit Profil
          </button>
        </section>

        {/* ---------------- Trigger Pengaturan (mobile saja) ---------------- */}
        <button
          onClick={() => setNavDrawerOpen(true)}
          className="md:hidden w-full flex items-center justify-between gap-3 px-5 py-3 rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface font-medium cursor-pointer"
          aria-haspopup="dialog"
          aria-expanded={navDrawerOpen}
        >
          <span className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">tune</span>
            Pengaturan
          </span>
          <span className="flex items-center gap-1 text-sm text-on-surface-variant">
            {activeLabel}
            <span className="material-symbols-outlined text-[20px]">expand_more</span>
          </span>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* ---------------- Sidebar Settings (desktop) ---------------- */}
          <aside className="hidden md:block col-span-3 space-y-2 sticky top-[100px] self-start">
            <h2 className="font-headline-md text-headline-md text-primary mb-6">Pengaturan</h2>
            <SettingsNavList activeNav={activeNav} onSelect={setActiveNav} onSoon={soon} asTablist />
          </aside>

          {/* ---------------- Panel aktif ---------------- */}
          <div
            id="settings-panel"
            role="tabpanel"
            aria-labelledby={`tab-${activeNav}`}
            tabIndex={0}
            className="col-span-1 md:col-span-9 outline-none"
          >
            {renderPanel()}
          </div>
        </div>
      </div>

      {/* ---------------- Drawer navigasi (mobile) ---------------- */}
      <SettingsDrawer isOpen={navDrawerOpen} onClose={() => setNavDrawerOpen(false)}>
        <SettingsNavList activeNav={activeNav} onSelect={handleSelectNav} onSoon={handleDrawerSoon} />
      </SettingsDrawer>

      {/* ---------------- Modal Edit Profil ---------------- */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)}>
        <form
          onSubmit={handleSaveProfile}
          className="bg-canvas-white rounded-panel p-8 max-w-md w-full shadow-2xl border border-outline-variant/30 relative space-y-6"
        >
          <button
            type="button"
            onClick={() => setEditOpen(false)}
            className="absolute top-4 right-4 material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full cursor-pointer"
            aria-label="Tutup"
          >
            close
          </button>

          <div>
            <h3 className="font-headline-md text-headline-md text-primary">Edit Profil</h3>
            <p className="text-sm text-on-surface-variant mt-1">Perbarui nama dan jenis kelamin Anda.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-name" className="block text-sm font-medium text-on-surface">
              Nama Lengkap
            </label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Masukkan nama lengkap"
              autoFocus
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-gender" className="block text-sm font-medium text-on-surface">
              Jenis Kelamin
            </label>
            <select
              id="edit-gender"
              value={editGender}
              onChange={(e) => setEditGender(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">Tidak disebutkan</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="px-5 py-3 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-semibold hover:bg-surface-tint transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {savingProfile ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---------------- Modal Ubah Kata Sandi ---------------- */}
      <Modal isOpen={pwOpen} onClose={() => setPwOpen(false)}>
        <form
          onSubmit={handleChangePassword}
          className="bg-canvas-white rounded-panel p-8 max-w-md w-full shadow-2xl border border-outline-variant/30 relative space-y-6"
        >
          <button
            type="button"
            onClick={() => setPwOpen(false)}
            className="absolute top-4 right-4 material-symbols-outlined text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full cursor-pointer"
            aria-label="Tutup"
          >
            close
          </button>

          <div>
            <h3 className="font-headline-md text-headline-md text-primary">Ubah Kata Sandi</h3>
            <p className="text-sm text-on-surface-variant mt-1">Masukkan kata sandi baru minimal 6 karakter.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="new-password" className="block text-sm font-medium text-on-surface">
              Kata Sandi Baru
            </label>
            <input
              id="new-password"
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Minimal 6 karakter"
              autoComplete="new-password"
              autoFocus
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="block text-sm font-medium text-on-surface">
              Konfirmasi Kata Sandi
            </label>
            <input
              id="confirm-password"
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPw}
              onChange={(e) => setShowPw(e.target.checked)}
              className="accent-primary cursor-pointer"
            />
            Tampilkan kata sandi
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setPwOpen(false)}
              className="px-5 py-3 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingPw}
              className="px-6 py-3 bg-primary text-on-primary rounded-full text-sm font-semibold hover:bg-surface-tint transition-colors shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              {savingPw ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default UserProfile;
