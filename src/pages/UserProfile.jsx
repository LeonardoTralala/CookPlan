import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getSavedRecipes, unsaveRecipe, saveRecipe, getRecipes } from '../services/recipeService.js';
import { getMyOrders, formatRupiah } from '../services/orderService.js';
import { ORDER_STATUS_META, PAYMENT_STATUS_META, STATUS_TONE_CLS } from '../utils/orderStatus.js';
import { getProfile, updateProfile, uploadAvatar } from '../services/profileService.js';
import { getActiveDietTags } from '../services/dietService.js';
import { checkIsAdmin } from '../services/adminService.js';
import { usePlan } from '../hooks/usePlan.js';
import { useAuth } from '../hooks/useAuth.js';
import { useSubscription } from '../hooks/useSubscription.js';
import { AVATAR_URL } from '../utils/userConfig.js';
import { PERSONA_OPTIONS, personaLabel } from '../utils/persona.js';
import { setCachedPersona } from '../utils/personaCache.js';
import { Modal } from '../components/Modal.jsx';
import { SettingsDrawer } from '../components/SettingsDrawer.jsx';
import { RecipeDetailModal } from '../components/RecipeDetailModal.jsx';
import { FeedbackCard } from '../components/FeedbackCard.jsx';
import { KECAMATAN_LIST } from '../utils/delivery.js';

// Item navigasi Pengaturan. Dipakai bersama oleh sidebar (desktop) & drawer (mobile).
const SETTINGS_NAV = [
  { id: 'personal', icon: 'person', label: 'Info Personal' },
  { id: 'my-recipes', icon: 'skillet', label: 'Resep Saya' },
  { id: 'orders', icon: 'receipt_long', label: 'Riwayat Pesanan' },
  { id: 'addresses', icon: 'location_on', label: 'Alamat' },
  { id: 'preferences', icon: 'tune', label: 'Preferensi' },
  { id: 'saved', icon: 'bookmark', label: 'Resep Tersimpan' },
  { id: 'security', icon: 'shield', label: 'Keamanan' },
  { id: 'subscription', icon: 'payments', label: 'Langganan' }
];


const fmtOrderDate = (iso) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(iso));
  } catch { return iso; }
};

// Panel "Riwayat Pesanan": daftar pesanan milik user (RLS owner-only) dengan
// rincian item yang bisa di-expand. Fetch sendiri saat panel dirender (tab aktif).
function OrderHistoryPanel() {
  const { showToast } = usePlan();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let active = true;
    getMyOrders()
      .then((data) => { if (active) setOrders(data); })
      .catch((err) => {
        console.error('Gagal memuat riwayat pesanan:', err);
        if (active) showToast('Gagal memuat riwayat pesanan.', { variant: 'error' });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showToast]);

  return (
    <section className="space-y-6">
      <h3 className="font-headline-md text-headline-md text-on-surface border-b border-outline-variant pb-2 inline-block">
        Riwayat Pesanan
      </h3>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-2" aria-hidden="true">progress_activity</span>
          <p className="text-sm">Memuat riwayat pesanan…</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl text-outline-variant mb-2 block">receipt_long</span>
          <p className="text-sm">Belum ada pesanan.</p>
          <p className="text-xs mt-1">Pesanan dari "Belanja di Kami" akan muncul di sini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const om = ORDER_STATUS_META[o.orderStatus] ?? { label: o.orderStatus ?? '—', tone: 'info' };
            const pm = PAYMENT_STATUS_META[o.paymentStatus] ?? { label: o.paymentStatus ?? '—', tone: 'info' };
            const grand = (o.total_price ?? 0) + (o.delivery_fee ?? 0);
            const isOpen = expanded === o.id;
            return (
              <div key={o.id} className="rounded-2xl border border-outline-variant bg-white overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-surface-container-lowest transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-on-surface text-sm">{o.id}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_TONE_CLS[om.tone]}`}>{om.label}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_TONE_CLS[pm.tone]}`}>{pm.label}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 truncate">
                      {o.items?.length ?? 0} item · {fmtOrderDate(o.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block font-bold text-primary">{formatRupiah(grand)}</span>
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px]">{isOpen ? 'expand_less' : 'expand_more'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-outline-variant/60 p-4 space-y-4 bg-surface-container-lowest">
                    {o.delivery_address && (
                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Alamat</span>
                        <span className="block text-sm text-on-surface break-words">{o.delivery_address}</span>
                      </div>
                    )}
                    {o.items?.length > 0 && (
                      <div className="rounded-xl border border-outline-variant bg-white divide-y divide-outline-variant/40 overflow-hidden">
                        {o.items.map((it) => (
                          <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="text-on-surface">{it.name}</span>
                            <span className="text-on-surface-variant">{it.amount} {it.unit}
                              {it.priceIdr > 0 && <span className="ml-2 text-primary font-semibold">{formatRupiah(it.priceIdr)}</span>}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-3 py-2 text-sm bg-surface-cream">
                          <span className="text-on-surface-variant flex items-center gap-1.5">
                            Ongkir
                            {(o.delivery_fee ?? 0) === 0 && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                PRO FREE ONGKIR
                              </span>
                            )}
                          </span>
                          <span className={`font-semibold ${(o.delivery_fee ?? 0) === 0 ? 'text-emerald-600 font-bold' : 'text-on-surface'}`}>
                            {(o.delivery_fee ?? 0) === 0 ? 'Rp 0 (Gratis Ongkir)' : formatRupiah(o.delivery_fee ?? 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <span className="font-bold text-primary">Total</span>
                          <span className="font-bold text-primary">{formatRupiah(grand)}</span>
                        </div>
                      </div>
                    )}
                    {o.notes && (
                      <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Catatan</span>
                        <span className="block text-sm text-on-surface break-words">{o.notes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Daftar navigasi Pengaturan + blok Bantuan & Legal. Dipakai di sidebar desktop
// (asTablist: tab ARIA penuh + navigasi panah) dan di dalam SettingsDrawer mobile
// (asTablist=false: menu navigasi biasa, hindari duplikasi id tab di DOM).
function SettingsNavList({ activeNav, onSelect, onLogout, signingOut = false, asTablist = false, isAdmin = false, onNavigate }) {
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
          onClick={() => onNavigate?.('/help')}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors text-sm font-medium cursor-pointer text-left"
        >
          <span className="material-symbols-outlined text-[20px]">support_agent</span>
          Layanan Pelanggan
        </button>
        <button
          onClick={() => onNavigate?.('/about')}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors text-sm font-medium cursor-pointer text-left"
        >
          <span className="material-symbols-outlined text-[20px]">groups</span>
          Tentang Kami
        </button>
        <button
          onClick={() => onNavigate?.('/privacy')}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors text-sm font-medium cursor-pointer text-left"
        >
          <span className="material-symbols-outlined text-[20px]">policy</span>
          Kebijakan Privasi
        </button>
        <button
          onClick={() => onNavigate?.('/terms')}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors text-sm font-medium cursor-pointer text-left"
        >
          <span className="material-symbols-outlined text-[20px]">gavel</span>
          Syarat &amp; Ketentuan
        </button>
      </div>
      {isAdmin && (
        <div className="pt-6 mt-6 border-t border-outline-variant">
          <h3 className="text-xs font-semibold text-on-surface mb-3 px-4 uppercase tracking-widest">
            Admin
          </h3>
          <button
            onClick={() => onNavigate?.('/admin')}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:text-primary transition-colors text-sm font-medium cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
            Panel Admin
          </button>
        </div>
      )}
      <div className="pt-4 mt-4 border-t border-outline-variant">
        <button
          onClick={onLogout}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-left text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          <span className={`material-symbols-outlined ${signingOut ? 'animate-spin' : ''}`}>
            {signingOut ? 'progress_activity' : 'logout'}
          </span>
          {signingOut ? 'Keluar…' : 'Keluar'}
        </button>
      </div>
    </>
  );
}

function AddressPanel({ profile, onUpdate }) {
  const { showToast } = usePlan();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    name: profile?.deliveryCustomerName || '',
    phone: profile?.deliveryCustomerPhone || '',
    kecamatan: profile?.deliveryKecamatan || '',
    detailAddress: profile?.deliveryDetailAlamat || ''
  });
  
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: profile?.deliveryCustomerName || '',
      phone: profile?.deliveryCustomerPhone || '',
      kecamatan: profile?.deliveryKecamatan || '',
      detailAddress: profile?.deliveryDetailAlamat || ''
    });
  }, [profile]);

  const validate = () => {
    const err = {};
    if (!form.name.trim()) err.name = 'Nama penerima wajib diisi.';
    if (!form.phone.trim()) err.phone = 'Nomor WhatsApp wajib diisi.';
    else if (!/^[0-9+\s-]{8,16}$/.test(form.phone.trim())) err.phone = 'Nomor tidak valid.';
    if (!form.kecamatan) err.kecamatan = 'Kecamatan wajib dipilih.';
    if (!form.detailAddress.trim()) err.detailAddress = 'Detail alamat wajib diisi.';
    return err;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      const updated = await updateProfile({
        deliveryCustomerName: form.name.trim(),
        deliveryCustomerPhone: form.phone.trim(),
        deliveryKecamatan: form.kecamatan,
        deliveryDetailAlamat: form.detailAddress.trim()
      });
      onUpdate(updated);
      setIsEditing(false);
      showToast('Alamat pengiriman berhasil disimpan.');
    } catch (e) {
      showToast(e.message || 'Gagal menyimpan alamat.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const hasAddress = profile?.deliveryCustomerName && profile?.deliveryCustomerPhone && profile?.deliveryKecamatan && profile?.deliveryDetailAlamat;

  if (isEditing) {
    return (
      <section className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between border-b border-outline-variant pb-2">
          <h3 className="font-headline-md text-headline-md text-on-surface">
            {hasAddress ? 'Ubah Alamat Pengiriman' : 'Tambah Alamat Pengiriman'}
          </h3>
        </div>
        
        <div className="space-y-4 max-w-lg bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant">
          <div className="space-y-1">
            <label htmlFor="addr-name" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Nama Penerima</label>
            <input id="addr-name" type="text" value={form.name} onChange={(e) => {
              setForm(p => ({ ...p, name: e.target.value }));
              setErrors(p => ({ ...p, name: undefined }));
            }} className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-base focus:outline-none focus:ring-2 ${errors.name ? 'focus:ring-error-100' : 'focus:ring-primary/20'}`} placeholder="Contoh: Zilfi Alvin" />
            {errors.name && <p className="text-xs text-error font-medium">{errors.name}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-phone" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Nomor WhatsApp</label>
            <input id="addr-phone" type="text" value={form.phone} onChange={(e) => {
              setForm(p => ({ ...p, phone: e.target.value }));
              setErrors(p => ({ ...p, phone: undefined }));
            }} className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-base focus:outline-none focus:ring-2 ${errors.phone ? 'focus:ring-error-100' : 'focus:ring-primary/20'}`} placeholder="Contoh: 081234567890" />
            {errors.phone && <p className="text-xs text-error font-medium">{errors.phone}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Kota / Kabupaten</label>
              <input type="text" value="Kota Malang" disabled className="w-full px-4 py-2.5 bg-surface-variant text-on-surface-variant opacity-70 border-none rounded-xl text-base cursor-not-allowed" />
            </div>

            <div className="space-y-1">
              <label htmlFor="addr-kecamatan" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Kecamatan</label>
              <select id="addr-kecamatan" value={form.kecamatan} onChange={(e) => {
                setForm(p => ({ ...p, kecamatan: e.target.value }));
                setErrors(p => ({ ...p, kecamatan: undefined }));
              }} className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-base focus:outline-none focus:ring-2 ${errors.kecamatan ? 'focus:ring-error-100' : 'focus:ring-primary/20'}`}>
                <option value="">Pilih Kecamatan</option>
                {KECAMATAN_LIST.map((k) => (
                  <option key={k.name} value={k.name}>
                    Kecamatan {k.name} (Ongkir {formatRupiah(k.fee)})
                  </option>
                ))}
              </select>
              {errors.kecamatan && <p className="text-xs text-error font-medium">{errors.kecamatan}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="addr-detail" className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Detail Alamat</label>
            <textarea id="addr-detail" value={form.detailAddress} onChange={(e) => {
              setForm(p => ({ ...p, detailAddress: e.target.value }));
              setErrors(p => ({ ...p, detailAddress: undefined }));
            }} rows={3} className={`w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-base focus:outline-none focus:ring-2 ${errors.detailAddress ? 'focus:ring-error-100' : 'focus:ring-primary/20'}`} placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, info kos" />
            {errors.detailAddress && <p className="text-xs text-error font-medium">{errors.detailAddress}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => {
              setIsEditing(false);
              setErrors({});
            }} disabled={loading} className="px-5 py-2.5 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm hover:bg-surface-container-low transition cursor-pointer disabled:opacity-50">
              Batal
            </button>
            <button onClick={handleSave} disabled={loading} className="flex-1 px-5 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5">
              {loading ? (
                <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Menyimpan...</>
              ) : (
                <><span className="material-symbols-outlined text-[18px]">save</span> Simpan Alamat</>
              )}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-outline-variant pb-2">
        <h3 className="font-headline-md text-headline-md text-on-surface">
          Alamat Pengiriman
        </h3>
        {hasAddress && (
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">edit</span> Ubah Alamat
          </button>
        )}
      </div>

      {!hasAddress ? (
        <div className="p-10 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-cream flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[28px]">location_on</span>
          </div>
          <div>
            <p className="font-semibold text-on-surface text-base">Alamat Pengiriman Belum Disimpan</p>
            <p className="text-sm text-on-surface-variant mt-1">Simpan alamat pengiriman Kota Malang Anda untuk mempercepat proses checkout paket belanja.</p>
          </div>
          <button onClick={() => setIsEditing(true)} className="px-5 py-2.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
            Tambah Alamat
          </button>
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-outline-variant bg-surface-container-lowest hover:shadow-[0_4px_20px_-4px_rgba(44,58,30,0.04)] transition-all space-y-4 max-w-lg">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">home_pin</span>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-on-surface text-base">{profile.deliveryCustomerName}</p>
              <p className="text-sm text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-primary">call</span>
                {profile.deliveryCustomerPhone}
              </p>
              <div className="pt-2 text-sm text-on-surface leading-relaxed">
                <p className="font-semibold text-primary">Kota Malang, Kec. {profile.deliveryKecamatan}</p>
                <p className="text-on-surface-variant mt-0.5">{profile.deliveryDetailAlamat}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


function UserProfile() {
  const { showToast } = usePlan();
  const { user, updatePassword, signOut, resendVerification, isAnonymous } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const soon = (fitur) => showToast(`Fitur ${fitur} sedang dikembangkan oleh Tim Pengembang CookPlan.`);

  // Tab aktif disimpan di URL (?tab=...) supaya refresh, bookmark, dan tombol
  // back/forward browser konsisten. Nilai tak dikenal jatuh ke 'saved'.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeNav = SETTINGS_NAV.some((i) => i.id === tabParam) ? tabParam : 'saved';
  const setActiveNav = (id) => {
    if (id === 'my-recipes') {
      navigate('/my-recipes');
      return;
    }
    if (id === 'subscription') {
      navigate('/subscription');
      return;
    }
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

  // Tautan menu Admin hanya muncul untuk admin (gerbang sebenarnya tetap RLS).
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    checkIsAdmin().then((ok) => { if (active) setIsAdmin(ok); });
    return () => { active = false; };
  }, []);

  // Nilai dari profil (tanpa fallback email/'Pengguna') untuk prefill form edit.
  const metaName = profile?.fullName || '';
  const metaGender = profile?.gender || '';
  const metaPersona = profile?.persona || '';

  // Persona ("siapakah kamu") ditampilkan read-only di header; diedit lewat modal
  // Edit Profil (pola sama dengan jenis kelamin).
  const personaText = personaLabel(metaPersona) || 'Belum diisi';

  // Jenis kelamin hanya ditampilkan di header (read-only); satu-satunya tempat
  // mengeditnya adalah modal Edit Profil — hindari dua kontrol untuk field sama.
  const genderLabel = metaGender === 'male'
    ? 'Laki-laki'
    : metaGender === 'female'
      ? 'Perempuan'
      : 'Belum diisi';

  // Modal Edit Profil (foto + nama lengkap + jenis kelamin).
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editPersona, setEditPersona] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  // Foto di-staging di dalam modal: file dipilih & di-preview dulu, baru diunggah
  // saat user menekan "Simpan" — jadi perubahan profil diterapkan sesuka user.
  const editAvatarInputRef = useRef(null);
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');

  // Buang preview lokal (object URL) supaya tidak bocor memori, lalu reset staging.
  const clearStagedAvatar = () => {
    setEditAvatarPreview((url) => { if (url) URL.revokeObjectURL(url); return ''; });
    setEditAvatarFile(null);
  };

  const openEdit = () => {
    setEditName(metaName);
    setEditGender(metaGender);
    setEditPersona(metaPersona);
    clearStagedAvatar();
    setEditOpen(true);
  };

  const handleEditAvatarPick = () => editAvatarInputRef.current?.click();

  const handleEditAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset agar pilih file sama tetap memicu onChange
    if (!file) return;
    // Validasi cepat di klien (cocokkan dengan limit bucket: JPG/PNG/WebP, 2 MB).
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 2 MB.');
      return;
    }
    setEditAvatarFile(file);
    setEditAvatarPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (editName.trim() === '') {
      showToast('Nama tidak boleh kosong.');
      return;
    }
    setSavingProfile(true);
    try {
      // Unggah foto baru dulu (bila ada) supaya avatar_url ikut tersimpan, baru
      // perbarui nama & jenis kelamin. getProfile final memuat ketiganya sekaligus.
      if (editAvatarFile) await uploadAvatar(editAvatarFile);
      const updated = await updateProfile({ fullName: editName, gender: editGender, persona: editPersona });
      setProfile(updated);
      setCachedPersona(user?.id ?? null, updated?.persona ?? ''); // jaga gate konsisten
      clearStagedAvatar();
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

  // State untuk modal "Tambah Koleksi Resep" (Simpan Resep)
  const [isAddCollectionOpen, setIsAddCollectionOpen] = useState(false);
  const [allRecipes, setAllRecipes] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [selectedRecipeForDetail, setSelectedRecipeForDetail] = useState(null);

  const handleOpenAddCollection = async () => {
    setIsAddCollectionOpen(true);
    if (allRecipes.length === 0) {
      setLoadingAll(true);
      try {
        const data = await getRecipes();
        setAllRecipes(data);
      } catch (err) {
        console.error("Gagal memuat resep:", err);
      } finally {
        setLoadingAll(false);
      }
    }
  };

  const handleToggleSave = async (recipe) => {
    const isSaved = savedRecipes.some((r) => r.id === recipe.id);
    if (isSaved) {
      const prev = savedRecipes;
      setSavedRecipes((list) => list.filter((r) => r.id !== recipe.id));
      try {
        await unsaveRecipe(recipe.id);
        showToast('Resep dihapus dari tersimpan.');
      } catch (err) {
        setSavedRecipes(prev);
        showToast(err.message || 'Gagal menghapus resep.');
      }
    } else {
      const prev = savedRecipes;
      setSavedRecipes((list) => [recipe, ...list]);
      try {
        await saveRecipe(recipe.id);
        showToast('Resep berhasil disimpan.');
      } catch (err) {
        setSavedRecipes(prev);
        const msg = err.message || 'Gagal menyimpan resep.';
        showToast(msg, { variant: 'error' });
        if (err.code === 'QUOTA_EXHAUSTED' || /kuota|10 resep|berlangganan/i.test(msg)) {
          navigate('/subscription', {
            state: {
              reason: 'quota_exhausted',
              message: 'Kuota simpan resep gratis (10 resep) telah habis. Silakan berlangganan Paket Digital (CookPass Lite) atau Paket Komplet (CookPass Pro) untuk menyimpan resep tanpa batas.'
            }
          });
        }
      }
    }
  };

  const filteredAddRecipes = useMemo(() => {
    if (addSearch.trim() === '') return allRecipes;
    const q = addSearch.toLowerCase();
    return allRecipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [allRecipes, addSearch]);

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

  // Keluar akun: pola sama dengan AppShell (signOut → kembali ke landing).
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Sign out gagal:', err);
      showToast('Gagal keluar. Coba lagi.');
    } finally {
      setSigningOut(false);
    }
  };

  // Kirim ulang email verifikasi (hanya relevan bila email belum terverifikasi).
  const [resending, setResending] = useState(false);
  const handleResendVerification = async () => {
    setResending(true);
    try {
      const { error } = await resendVerification(displayEmail);
      if (error) throw error;
      showToast('Email verifikasi telah dikirim. Cek kotak masuk Anda.');
    } catch (err) {
      showToast(err.message || 'Gagal mengirim email verifikasi.');
    } finally {
      setResending(false);
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

  // Konten panel sesuai tab aktif.
  const renderPanel = () => {

    switch (activeNav) {
      case 'orders':
        return <OrderHistoryPanel />;

      case 'addresses':
        return <AddressPanel profile={profile} onUpdate={setProfile} />;


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
                  onClick={handleOpenAddCollection}
                  className="flex items-center justify-center p-2 bg-surface-cream text-primary rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
                  aria-label="Tambah koleksi resep"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">add</span>
                </button>
              </div>
            </div>

            {!isAnonymous && (
              subscription?.status === 'active' ? (
                <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50/80 border border-emerald-200/60 rounded-2xl">
                  <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                    Status Berlangganan Aktif: Simpan resep <strong>Unlimited</strong> ({savedRecipes.length} resep tersimpan)
                  </p>
                  <Link to="/subscription" className="shrink-0 px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-full hover:shadow-md transition active:scale-95 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                    <span>Detail Paket</span>
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-900">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0">bookmark</span>
                    <span className="text-xs font-medium">
                      Kuota Simpan Resep Gratis: <strong>{savedRecipes.length}</strong> dari 10 resep ({Math.max(0, 10 - savedRecipes.length) === 0 ? 'Kuota Habis' : `Sisa ${Math.max(0, 10 - savedRecipes.length)}`})
                    </span>
                  </div>
                  <Link to="/subscription" className="shrink-0 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-full hover:shadow-md transition active:scale-95 shadow-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                    <span>Simpan Unlimited 👑</span>
                  </Link>
                </div>
              )
            )}

            <FeedbackCard question="Apakah fitur Resep Tersimpan membantu mengelola masakan favoritmu?" category="saran" cooldownKey="saved" />

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
                    onClick={() => setSelectedRecipeForDetail(recipe)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedRecipeForDetail(recipe);
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
                    {/* Waktu masak disembunyikan sementara */}
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
                  {!emailVerified && (
                    <button
                      onClick={handleResendVerification}
                      disabled={resending}
                      className="mt-1 text-xs font-semibold text-primary hover:underline cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                    >
                      {resending ? 'Mengirim…' : 'Kirim ulang verifikasi'}
                    </button>
                  )}
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
              // Cegah klik programatik input menggelembung balik ke div pembungkus
              // (onClick handleAvatarPick) yang akan memicu picker dua kali.
              onClick={(e) => e.stopPropagation()}
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
                Jenis Kelamin: {genderLabel}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container-low border border-outline-variant text-on-surface-variant rounded-full text-xs font-semibold">
                <span className="material-symbols-outlined text-[14px]">badge</span>
                {personaText}
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
            <SettingsNavList activeNav={activeNav} onSelect={setActiveNav} onSoon={soon} onLogout={handleSignOut} signingOut={signingOut} isAdmin={isAdmin} onNavigate={navigate} asTablist />
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
        <SettingsNavList activeNav={activeNav} onSelect={handleSelectNav} onSoon={handleDrawerSoon} onLogout={handleSignOut} signingOut={signingOut} isAdmin={isAdmin} onNavigate={navigate} />
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
            <p className="text-sm text-on-surface-variant mt-1">Perbarui foto, nama, jenis kelamin, dan persona Anda.</p>
          </div>

          {/* Foto profil: pilih + preview di sini, diterapkan saat tekan Simpan */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-surface-cream bg-surface-variant shrink-0">
              <img
                src={editAvatarPreview || avatarSrc}
                alt=""
                onError={(e) => { e.currentTarget.src = AVATAR_URL; }}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleEditAvatarPick}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-primary text-primary text-sm font-semibold hover:bg-primary/5 active:scale-95 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                {editAvatarFile ? 'Ganti Foto' : 'Ubah Foto'}
              </button>
              <p className="text-xs text-on-surface-variant">JPG, PNG, atau WebP. Maks 2 MB.</p>
            </div>
            <input
              ref={editAvatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleEditAvatarChange}
            />
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

          <div className="space-y-2">
            <label htmlFor="edit-persona" className="block text-sm font-medium text-on-surface">
              Siapakah kamu?
            </label>
            <select
              id="edit-persona"
              value={editPersona}
              onChange={(e) => setEditPersona(e.target.value)}
              className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">Belum diisi</option>
              {PERSONA_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <p className="text-xs text-on-surface-variant">
              Dipakai sebagai bawaan saat membuat rencana makan dengan AI.
            </p>
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

      {/* Modal Tambah Koleksi Resep */}
      <Modal isOpen={isAddCollectionOpen} onClose={() => setIsAddCollectionOpen(false)}>
        <div className="bg-surface-container rounded-3xl w-full max-w-lg p-6 flex flex-col max-h-[85vh] animate-scale-up relative">
          <button
            onClick={() => setIsAddCollectionOpen(false)}
            className="absolute right-4 top-4 w-10 h-10 rounded-full bg-surface-container-low text-on-surface flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
          
          <h3 className="font-headline-md text-headline-md text-primary mb-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl">bookmark</span>
            Tambah ke Tersimpan
          </h3>
          <p className="text-xs text-on-surface-variant mb-4">
            Pilih resep dari katalog untuk disimpan ke koleksi favoritmu.
          </p>

          <div className="relative mb-4">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Cari resep..."
              className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant/60 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="overflow-y-auto flex-grow space-y-3 pr-1">
            {loadingAll ? (
              <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin text-3xl text-primary mb-2">progress_activity</span>
                <p className="text-xs">Memuat daftar resep...</p>
              </div>
            ) : filteredAddRecipes.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant">
                <p className="text-sm">Tidak ada resep ditemukan.</p>
              </div>
            ) : (
              filteredAddRecipes.map((recipe) => {
                const isSaved = savedRecipes.some((r) => r.id === recipe.id);
                return (
                  <div key={recipe.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={recipe.imageUrl}
                        alt=""
                        onError={(e) => { e.currentTarget.src = '/img/recipe-placeholder.svg'; }}
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                      />
                      <span className="font-semibold text-sm text-on-surface line-clamp-2">{recipe.title}</span>
                    </div>
                    <button
                      onClick={() => handleToggleSave(recipe)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                        isSaved
                          ? 'bg-success-green/10 text-success-green border border-success-green/30 hover:bg-success-green/20'
                          : 'bg-primary text-on-primary hover:shadow-md'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{isSaved ? 'check' : 'add'}</span>
                      {isSaved ? 'Tersimpan' : 'Simpan'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Detail Resep */}
      {selectedRecipeForDetail && (
        <RecipeDetailModal
          recipe={selectedRecipeForDetail}
          isSaved={savedRecipes.some((r) => r.id === selectedRecipeForDetail.id)}
          onToggleSave={handleToggleSave}
          onClose={() => setSelectedRecipeForDetail(null)}
        />
      )}
    </div>
  );
}

export default UserProfile;
