import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePlan, getGeneratedHistory, getTodayUsageCount, getGuestUsageCount, deleteGeneratedPlan } from '../services/aiService.js';
import { getActiveDietTags, sampleDietTags } from '../services/dietService.js';
import { getProfile } from '../services/profileService.js';
import { usePlan } from '../hooks/usePlan.js';
import { Modal } from '../components/Modal.jsx';
import { useAuth } from '../hooks/useAuth.js';

// Fitur 1: Generate Foodplan & Foodprep. Wizard 3 langkah (mobile-first).
// Step 1: periode + porsi + waktu makan
// Step 2: diet + budget + bahan tersedia (pantry)
// Step 3: konfirmasi + generate

// Batas periode plan (hari). Maksimal 7 supaya selaras dengan kapasitas planner
// mingguan (Senin–Minggu) dan validasi server (validateInput).
const PERIODE_MAX = 7;

// Variasi menu per hari: berapa RESEP BERBEDA yang dimasak dalam sehari. Bila
// variasi < jumlah waktu makan terpilih, resep yang sama dipakai ulang untuk
// mengisi waktu makan sisanya (konsep foodprep — masak sekali, makan beberapa
// kali). Maks 3 (tidak mungkin > jumlah waktu makan dalam sehari).
const VARIASI_MAX = 3;

// Pilihan waktu makan per hari. User boleh memilih subset (mis. cuma makan siang,
// atau siang + malam); minimal satu. Urutan ini = urutan kanonik yang dipakai
// server (breakfast → lunch → dinner).
const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Sarapan', hint: 'Pagi hari', icon: 'wb_twilight' },
  { value: 'lunch', label: 'Makan Siang', hint: 'Tengah hari', icon: 'light_mode' },
  { value: 'dinner', label: 'Makan Malam', hint: 'Sore / malam', icon: 'bedtime' },
];

// Opsi diet sekarang diambil dinamis dari tabel diet_tags (lihat dietService).
// Konstanta ini cuma FALLBACK bila fetch gagal / tabel belum di-push, supaya
// wizard tidak pernah kosong. Selaras dengan seed migrasi diet_tags.
const DEFAULT_DIET_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'halal', label: 'Halal' },
  { value: 'tinggi-protein', label: 'Tinggi Protein' },
  { value: 'hemat', label: 'Hemat Budget' },
  { value: 'cepat', label: 'Cepat (< 30 mnt)' },
  { value: 'bahan-lokal', label: 'Bahan Lokal' },
];

const BUDGET_PRESETS = [100000, 200000, 350000, 500000];

// Batas catatan khusus — selaras NOTES_MAX di validateInput (Edge Function).
const NOTES_MAX = 300;

// Selaras dengan RATE_LIMIT_PER_DAY di Edge Function generate-plan.
const DAILY_LIMIT = 20;
// Selaras dengan GUEST_LIMIT di Edge Function generate-plan: tamu (anonymous)
// boleh mencoba generate sebanyak ini secara total sebelum harus daftar.
const GUEST_LIMIT = 2;

export function GeneratePlan() {
  const navigate = useNavigate();
  const { showToast } = usePlan();
  const { isAnonymous } = useAuth();

  const [step, setStep] = useState(1);
  const [periode, setPeriode] = useState(7);
  const [porsi, setPorsi] = useState(2);
  const [meals, setMeals] = useState(['breakfast', 'lunch', 'dinner']);
  const [variasiPerHari, setVariasiPerHari] = useState(1);
  const [persona, setPersona] = useState('');
  const [diet, setDiet] = useState(['halal']);
  const [budget, setBudget] = useState(200000);
  const [pantry, setPantry] = useState([]);
  const [pantryInput, setPantryInput] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Konfirmasi sebelum pindah ke "Belanja di Kami" (keluar dari wizard generate).
  const [confirmSwitchShop, setConfirmSwitchShop] = useState(false);
  // Modal teaser "Coming soon" untuk antar FoodPrep ke rumah (fitur belum siap).
  const [showFoodPrepSoon, setShowFoodPrepSoon] = useState(false);
  // Panel (bottom-sheet) riwayat generate — dibuka dari tombol di atas Step 1 supaya
  // form generate tidak ikut tergeser/hilang saat user mau lihat hasil lama.
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [usageCount, setUsageCount] = useState(null);
  // dietPool = semua preferensi (dari diet_tags). dietSample = subset acak yang
  // ditampilkan di chip (notulen #6/#7: pilihan variatif & segar, tidak hardcode).
  const [dietPool, setDietPool] = useState(DEFAULT_DIET_OPTIONS);
  const [dietSample, setDietSample] = useState(() => DEFAULT_DIET_OPTIONS.slice(0, 8));

  // Riwayat generate + kuota harian (info, bukan blocker — server tetap validasi).
  // Opsi diet di-fetch dari diet_tags; gagal → tetap pakai fallback konstanta.
  useEffect(() => {
    let active = true;
    // Tamu: tidak menampilkan riwayat; kuota dihitung total (bukan per hari).
    if (isAnonymous) {
      getGuestUsageCount()
        .then((n) => { if (active) setUsageCount(n); })
        .catch(() => { /* idem */ });
    } else {
      getGeneratedHistory(5, { successOnly: true })
        .then((rows) => { if (active) setHistory(rows); })
        .catch(() => { /* riwayat opsional, jangan ganggu wizard */ });
      getTodayUsageCount()
        .then((n) => { if (active) setUsageCount(n); })
        .catch(() => { /* idem */ });
    }
    // Opsi diet + preferensi tersimpan pengguna (profiles.diet_prefs) diambil
    // bersamaan: preferensi profil jadi pilihan awal wizard, dan chip yang
    // ditampilkan dijaga agar selalu memuat pilihan tersebut.
    Promise.all([
      getActiveDietTags().catch(() => []),
      getProfile().catch(() => null),
    ]).then(([rows, prof]) => {
      if (!active) return;
      const prefs = prof?.dietPrefs?.length ? prof.dietPrefs : null;
      if (prefs) setDiet(prefs);
      // Persona dari profil (diisi sekali saat onboarding) diteruskan diam-diam
      // ke AI — tidak ditampilkan di wizard; diubah lewat Profil bila perlu.
      if (prof?.persona) setPersona(prof.persona);
      const pool = rows.length ? rows : DEFAULT_DIET_OPTIONS;
      if (rows.length) setDietPool(rows);
      setDietSample(sampleDietTags(pool, 8, prefs ?? ['halal']));
    });
    return () => { active = false; };
  }, [isAnonymous]);

  // Sisa percobaan gratis untuk tamu; habis → arahkan ke login/daftar.
  const guestRemaining = Math.max(0, GUEST_LIMIT - (usageCount ?? 0));
  const guestExhausted = isAnonymous && usageCount != null && guestRemaining === 0;

  // Tamu yang kuotanya habis langsung diarahkan ke halaman login/daftar saat
  // mau generate lagi (termasuk saat membuka halaman ini dalam keadaan habis).
  useEffect(() => {
    if (guestExhausted) {
      navigate('/auth', { replace: true, state: { from: '/generate' } });
    }
  }, [guestExhausted, navigate]);

  // Kuota harian: server reset di tengah malam UTC (lihat getTodayUsageCount).
  // quotaLeft null = belum termuat. Tampilkan waktu reset dalam zona lokal user.
  const quotaLeft = usageCount == null ? null : Math.max(0, DAILY_LIMIT - usageCount);
  const quotaExhausted = quotaLeft === 0;
  const quotaResetText = useMemo(() => {
    const reset = new Date();
    reset.setUTCHours(24, 0, 0, 0); // tengah malam UTC berikutnya
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(reset);
  }, []);
  const quotaMessage = `Kuota generate harian (${DAILY_LIMIT}/hari) sudah habis. Bisa generate lagi mulai ${quotaResetText}.`;

  // Tampilkan kombinasi preferensi diet acak lain (yang sedang dipilih tetap muncul).
  const reshuffleDiet = () => setDietSample(sampleDietTags(dietPool, 8, diet));

  const toggleDiet = (value) => {
    setDiet((prev) => prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]);
  };

  // Jumlah waktu makan terpilih — dipakai untuk teks variasi & ringkasan.
  const mealCount = meals.length;

  // Toggle waktu makan; jaga minimal satu tetap aktif & urutan kanonik.
  const toggleMeal = (value) => {
    setMeals((prev) => {
      if (prev.includes(value)) {
        return prev.length === 1 ? prev : prev.filter((m) => m !== value);
      }
      return MEAL_OPTIONS.map((o) => o.value).filter((m) => prev.includes(m) || m === value);
    });
  };

  const addPantry = () => {
    const text = pantryInput.trim();
    if (!text) return;
    // Parsing sederhana: "telur 5 butir" → {name, amount, unit}
    const match = text.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(\w+)?$/);
    let item;
    if (match) {
      item = { name: match[1].trim(), amount: Number(match[2].replace(',', '.')), unit: match[3] || '' };
    } else {
      item = { name: text, amount: undefined, unit: '' };
    }
    setPantry((prev) => [...prev, item]);
    setPantryInput('');
  };

  const removePantry = (idx) => setPantry((prev) => prev.filter((_, i) => i !== idx));

  const handleDeleteHistory = async (id, e) => {
    e.stopPropagation();
    try {
      await deleteGeneratedPlan(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      showToast('Riwayat dihapus.');
    } catch {
      showToast('Gagal menghapus riwayat.');
    }
  };

  const handleGenerate = async () => {
    // Guarded click: kuota habis → jelaskan langsung, JANGAN buang request +
    // loading panjang yang berujung error (alternatif dari men-disable tombol).
    if (quotaExhausted) {
      setError(quotaMessage);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // outputType selalu 'full' — pilihan jenis output dihapus dari wizard;
      // hasil selalu lengkap (menu + belanja + prep), Core Offer tetap tersedia.
      const input = { periode, porsi, meals, variasiPerHari, diet, budget, pantry, notes, persona, outputType: 'full' };
      const result = await generatePlan(input);
      // Simpan hasil + input ke sessionStorage agar GenerateResult bisa baca tanpa
      // refetch. `input` (terutama pantry) dipakai untuk recompute belanja saat
      // "Ganti Menu" — lihat GenerateResult.handleRegenerateDay.
      sessionStorage.setItem(`plan_${result.planId}`, JSON.stringify({ ...result, input }));
      // Tamu: JANGAN naikkan hitungan di sini. Bila usageCount mencapai GUEST_LIMIT,
      // effect guestExhausted langsung redirect ke /auth dan menelan hasil generate
      // ke-2 sebelum user sempat melihatnya. Tamu cukup dihitung ulang saat kembali
      // ke halaman ini (mount → getGuestUsageCount), sehingga percobaan BERIKUTNYA
      // barulah diarahkan ke login. User penuh tetap disinkronkan untuk display kuota.
      if (!isAnonymous) {
        setUsageCount((n) => (n == null ? n : n + 1)); // sinkronkan sisa kuota
      }
      showToast('Plan berhasil dibuat! 🎉');
      navigate(`/generate/${result.planId}`);
    } catch (e) {
      const msg = e.message || 'Gagal generate plan. Coba lagi.';
      // Tamu kehabisan percobaan gratis → langsung ke halaman login/daftar.
      if (isAnonymous && /percobaan gratis/i.test(msg)) {
        navigate('/auth', { replace: true, state: { from: '/generate' } });
        return;
      }
      // Server menolak karena rate limit harian → samakan tampilannya & tandai habis.
      const lower = msg.toLowerCase();
      if (e.status === 429 || lower.includes('kuota') || lower.includes('limit') || lower.includes('rate')) {
        setUsageCount(DAILY_LIMIT);
        setError(quotaMessage);
      } else {
        setError(msg);
      }
      // Tamu: segarkan hitungan supaya redirect terpicu bila kuota ternyata habis.
      if (isAnonymous) {
        getGuestUsageCount().then(setUsageCount).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(n);

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-10 py-8 md:py-12">
      {/* Header + progress */}
      <div className="mb-8">
        <h1 className="font-headline-lg text-headline-lg text-primary mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl">auto_awesome</span>
          Generate Foodplan
        </h1>
        <p className="text-on-surface-variant text-body-md mb-2">
          Biar AI susun menu & belanja mingguanmu otomatis.
        </p>
        {usageCount != null && isAnonymous && (
          <p className="text-xs text-on-surface-variant/80 mb-5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            Sisa percobaan gratis: <strong>{guestRemaining}</strong> dari {GUEST_LIMIT} generate
          </p>
        )}
        {usageCount != null && !isAnonymous && (
          quotaExhausted ? (
            <div className="mb-5 flex items-start gap-2 rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">
              <span className="material-symbols-outlined text-[20px] shrink-0">hourglass_empty</span>
              <span>Kuota generate harian habis ({DAILY_LIMIT}/hari). Bisa generate lagi mulai <strong>{quotaResetText}</strong>.</span>
            </div>
          ) : (
            <p className="text-xs text-on-surface-variant mb-5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              Sisa kuota hari ini: <strong>{quotaLeft}</strong> dari {DAILY_LIMIT} generate
            </p>
          )
        )}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-surface-container-high'}`} />
            </div>
          ))}
        </div>
        <p className="text-xs text-on-surface-variant mt-2">Langkah {step} dari 3</p>
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-7 animate-fade-in">
          {/* Buka riwayat sebagai panel; form generate di belakang tetap utuh. */}
          {history.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant hover:border-primary/50 hover:text-primary active:scale-95 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                Riwayat Generate ({history.length})
              </button>
            </div>
          )}
          {/* Pilihan mode belanja (notulen: di page generate ada pilihan belanja sendiri / di kami). */}
          <div className="bg-surface-container-low rounded-2xl p-5">
            <p className="text-sm font-semibold text-on-surface mb-3">Mau belanja gimana?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="material-symbols-outlined text-primary text-xl">shopping_cart</span>
                  <span className="font-bold text-primary text-sm">Belanja Sendiri</span>
                </div>
                <p className="text-xs text-on-surface-variant">AI susun menu, kamu belanja sendiri bahannya di pasar/toko.</p>
                <p className="text-[11px] text-primary font-semibold mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Sedang dipilih
                </p>
              </div>
              <button
                onClick={() => isAnonymous ? navigate('/auth') : setConfirmSwitchShop(true)}
                className="rounded-xl border border-outline-variant hover:border-primary/50 p-4 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-xl">local_shipping</span>
                  <span className="font-bold text-on-surface text-sm">Belanja Paket di Kami</span>
                </div>
                <p className="text-xs text-on-surface-variant">Pilih paket menu fiks, bahan kami siapkan & antar.</p>
                <p className="text-[11px] text-on-surface-variant font-semibold mt-2 flex items-center gap-1 group-hover:text-primary">
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  Lihat paket
                </p>
              </button>

              {/* Coming soon: kami masakkan FoodPrep sesuai hasil generate & antar
                  ke rumah. Belum siap — klik memunculkan toast "Coming soon". */}
              <button
                type="button"
                onClick={() => setShowFoodPrepSoon(true)}
                className="relative rounded-xl border border-dashed border-outline-variant bg-surface-container/40 p-4 text-left transition-colors hover:border-primary/50 cursor-pointer sm:col-span-2"
              >
                <span className="absolute right-3 top-3 rounded-full bg-secondary-container px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-secondary-container">
                  Coming soon
                </span>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="material-symbols-outlined text-on-surface-variant text-xl">shopping_bag</span>
                  <span className="font-bold text-on-surface text-sm">Belanja di Kami</span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Pilih Paket FoodPrep yang kami sediakan, kami antar sampai rumah! Kami antar FoodPrep sesuai yang kamu generate.
                </p>
              </button>
            </div>
          </div>

          <Field label="Periode plan">
            <Stepper
              value={periode}
              onDec={() => setPeriode(Math.max(1, periode - 1))}
              onInc={() => setPeriode(Math.min(PERIODE_MAX, periode + 1))}
              suffix="Hari"
            />
            <p className="text-xs text-on-surface-variant mt-2">Maksimal {PERIODE_MAX} hari.</p>
          </Field>

          <Field label="Jumlah porsi per jam makan">
            <Stepper value={porsi} onDec={() => setPorsi(Math.max(1, porsi - 1))} onInc={() => setPorsi(porsi + 1)} suffix="Porsi" />
            <p className="text-xs text-on-surface-variant mt-2">
              Porsi sekali makan (mis. 2 = buat 2 orang). Total masak otomatis dikali jumlah waktu makan.
            </p>
          </Field>

          <Field label="Berapa variasi menu dalam sehari?">
            <Stepper
              value={variasiPerHari}
              onDec={() => setVariasiPerHari(Math.max(1, variasiPerHari - 1))}
              onInc={() => setVariasiPerHari(Math.min(VARIASI_MAX, variasiPerHari + 1))}
              suffix="Variasi"
            />
            <p className="text-xs text-on-surface-variant mt-2">
              {mealCount}× makan/hari. {variasiPerHari === 1
                ? 'Masak 1 menu sekali, dipakai untuk semua waktu makan (foodprep).'
                : variasiPerHari >= mealCount
                  ? 'Tiap waktu makan menu berbeda.'
                  : `${variasiPerHari} menu berbeda, dipakai ulang menutup ${mealCount} waktu makan.`}
            </p>
          </Field>

          <Field label="Waktu makan per hari">
            <p className="text-xs text-on-surface-variant mb-2.5">
              Ketuk jam makan yang mau direncanakan. Boleh lebih dari satu.
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {MEAL_OPTIONS.map((opt) => (
                <MealBubble
                  key={opt.value}
                  option={opt}
                  selected={meals.includes(opt.value)}
                  onToggle={() => toggleMeal(opt.value)}
                />
              ))}
            </div>
            <p className="text-xs text-on-surface-variant mt-2">
              Terpilih: <strong>{mealCount}× makan/hari</strong>. Minimal satu.
            </p>
          </Field>

          <div className="flex justify-end pt-2">
            <button onClick={() => setStep(2)} className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer">
              Lanjut
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-7 animate-fade-in">
          <Field label="Preferensi diet (boleh pilih >1)">
            <div className="flex flex-wrap gap-2">
              {dietSample.map((opt) => (
                <Chip key={opt.value} active={diet.includes(opt.value)} onClick={() => toggleDiet(opt.value)}>
                  {opt.label}
                </Chip>
              ))}
              <button
                type="button"
                onClick={reshuffleDiet}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold border border-dashed border-primary/50 text-primary hover:bg-primary/5 active:scale-95 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">casino</span>
                Pilihan lain
              </button>
            </div>
            <p className="text-xs text-on-surface-variant mt-2">
              Pilih yang sesuai seleramu. Klik <strong>Pilihan lain</strong> buat lihat preferensi berbeda.
            </p>
          </Field>

          <Field label="Budget total">
            <div className="flex flex-wrap gap-2 mb-3">
              {BUDGET_PRESETS.map((b) => (
                <Chip key={b} active={budget === b} onClick={() => setBudget(b)}>{formatRupiah(b)}</Chip>
              ))}
            </div>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              // Tampilkan kosong saat 0 supaya placeholder muncul & tidak ada "0"
              // nyangkut di depan (mis. ngetik 700000 jadi 0700000). Input disaring
              // ke digit saja, lalu dikonversi via Number agar leading zero hilang.
              value={budget === 0 ? '' : budget}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setBudget(digits === '' ? 0 : Number(digits));
              }}
              className="w-full px-4 py-3 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              placeholder="Budget dalam Rupiah"
            />
          </Field>

          <Field label="Bahan yang sudah ada di rumah (opsional)">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={pantryInput}
                onChange={(e) => setPantryInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPantry(); } }}
                placeholder="mis. telur 5 butir"
                className="flex-1 px-4 py-3 rounded-xl bg-white border border-outline-variant text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
              <button onClick={addPantry} aria-label="Tambah bahan" className="w-12 h-12 shrink-0 rounded-xl bg-primary text-on-primary flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-95 transition">
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
            {pantry.length > 0 && (
              <ul className="space-y-1.5">
                {pantry.map((p, i) => (
                  <li key={i} className="flex items-center justify-between bg-surface-container-low rounded-xl px-4 py-2.5 text-sm">
                    <span className="text-on-surface">{p.name}{p.amount ? ` — ${p.amount} ${p.unit}` : ''}</span>
                    <button onClick={() => removePantry(i)} aria-label="Hapus" className="text-on-surface-variant hover:text-error cursor-pointer">
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <Field label="Catatan khusus (opsional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              rows={3}
              placeholder="mis. hindari pedas, pengen menu serba ayam, alergi seaafood"
              className="w-full px-4 py-3 rounded-xl bg-white border border-outline-variant text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
            <div className="flex items-center justify-between mt-1.5">
              {/* <p className="text-xs text-on-surface-variant">Sekadar penghalus — parameter di atas tetap yang utama.</p> */}
              <span className="text-xs text-on-surface-variant/70">{notes.length}/{NOTES_MAX}</span>
            </div>
          </Field>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="px-6 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm hover:bg-surface-container-low transition cursor-pointer">
              Kembali
            </button>
            <button onClick={() => setStep(3)} className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer">
              Lanjut
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-surface-container-low rounded-2xl p-6 space-y-3">
            <h3 className="font-headline-md text-headline-md text-primary mb-2">Ringkasan</h3>
            <SummaryRow label="Periode" value={`${periode} hari`} />
            <SummaryRow label="Porsi per jam makan" value={`${porsi} porsi`} />
            <SummaryRow
              label="Waktu makan"
              value={meals.map((m) => MEAL_OPTIONS.find((o) => o.value === m)?.label ?? m).join(', ')}
            />
            <SummaryRow
              label="Variasi menu"
              value={`${variasiPerHari} variasi/hari${variasiPerHari === 1 ? ' (masak sekali, seharian)' : ''}`}
            />
            <SummaryRow label="Diet" value={diet.length ? diet.map((v) => dietPool.find((d) => d.value === v)?.label ?? v).join(', ') : 'Tidak ada'} />
            <SummaryRow label="Budget" value={formatRupiah(budget)} />
            <SummaryRow label="Bahan di rumah" value={`${pantry.length} item`} />
            {notes.trim() && <SummaryRow label="Catatan khusus" value={notes.trim()} />}
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">
              <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2">
            <button onClick={() => setStep(2)} disabled={loading} className="px-6 py-3 border border-outline-variant text-on-surface-variant rounded-full font-semibold text-sm hover:bg-surface-container-low transition cursor-pointer disabled:opacity-50">
              Kembali
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  AI sedang menyusun…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  Generate Plan-ku
                </>
              )}
            </button>
          </div>
          {loading && (
            <p className="text-center text-xs text-on-surface-variant">
              AI sedang menyusun menu mingguanmu — ini bisa memakan beberapa detik…
            </p>
          )}
        </div>
      )}

      {/* Konfirmasi pindah ke "Belanja di Kami" — cegah keluar wizard tak sengaja */}
      <Modal isOpen={confirmSwitchShop} onClose={() => setConfirmSwitchShop(false)}>
        <div className="w-full max-w-sm bg-canvas-white rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col items-center text-center gap-1">
            <span className="material-symbols-outlined text-primary text-[32px] mb-1" aria-hidden="true">local_shipping</span>
            <h2 className="text-lg font-bold text-on-surface">Pindah ke Belanja di Kami?</h2>
            <p className="text-sm text-on-surface-variant">
              Kamu akan keluar dari wizard generate. Isian yang belum di-generate tidak akan tersimpan.
            </p>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setConfirmSwitchShop(false)}
              className="flex-1 min-h-11 rounded-full text-sm font-semibold text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => navigate('/shopping?tab=kami')}
              className="flex-1 min-h-11 rounded-full text-sm font-semibold text-on-primary bg-primary hover:opacity-90 transition-opacity cursor-pointer"
            >
              Ya, pindah
            </button>
          </div>
        </div>
      </Modal>

      {/* Teaser "Coming soon" — antar FoodPrep ke rumah sesuai hasil generate */}
      <Modal isOpen={showFoodPrepSoon} onClose={() => setShowFoodPrepSoon(false)}>
        <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-canvas-white shadow-xl">
          {/* Banner ilustratif di atas */}
          <div className="relative bg-primary/10 px-6 pt-8 pb-6 text-center">
            <span className="inline-flex items-center rounded-full bg-secondary-container px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-on-secondary-container">
              Coming soon
            </span>
            <div className="mt-4 flex justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-md">
                <span className="material-symbols-outlined text-[34px]">shopping_bag</span>
              </span>
            </div>
          </div>
          <div className="px-6 pb-6 pt-5 text-center">
            <h2 className="text-lg font-bold text-on-surface">Belanja di Kami</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Sebentar lagi! Kamu bisa pilih Paket FoodPrep yang kami sediakan, kami antar FoodPrep sesuai yang kamu generate. 🚚
            </p>
            <button
              onClick={() => setShowFoodPrepSoon(false)}
              className="mt-6 w-full min-h-11 rounded-full bg-primary text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition cursor-pointer"
            >
              Oke, ditunggu!
            </button>
          </div>
        </div>
      </Modal>

      {/* Panel riwayat generate — dibuka dari tombol "Riwayat Generate" di atas Step 1.
          Form generate di belakang tetap utuh saat panel ini ditutup. */}
      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)}>
        <div className="w-full max-w-md rounded-3xl bg-canvas-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/60 px-5 py-4">
            <h2 className="flex items-center gap-1.5 text-base font-bold text-on-surface">
              <span className="material-symbols-outlined text-[20px] text-primary">history</span>
              Hasil Generate Sebelumnya
            </h2>
            <button
              onClick={() => setShowHistory(false)}
              aria-label="Tutup"
              className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">Belum ada riwayat generate.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => { setShowHistory(false); navigate(`/generate/${h.id}`); }}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-outline-variant bg-white hover:border-primary/50 transition-colors text-left cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-primary shrink-0">restaurant_menu</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-on-surface truncate">
                        {h.input_json?.periode ? `${h.input_json.periode} hari` : 'Plan'}
                        {h.input_json?.porsi ? ` × ${h.input_json.porsi} porsi` : ''}
                      </span>
                      <span className="block text-xs text-on-surface-variant">
                        {new Date(h.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </span>
                    </span>
                    <button
                      onClick={(e) => handleDeleteHistory(h.id, e)}
                      className="p-1.5 rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors shrink-0 cursor-pointer"
                      title="Hapus riwayat"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-sm font-semibold text-on-surface mb-2.5">{label}</p>
      {children}
    </div>
  );
}

// Kartu pilih waktu makan bergaya "chat bubble": sudut sangat membulat dengan satu
// sudut bawah dipotong (rounded-bl-md) jadi terasa seperti gelembung chat, bukan
// kotak. Cara kerja sama seperti kartu sebelumnya — ikon, label, hint, dan ✓ di
// pojok saat aktif; multi-pilih.
function MealBubble({ option, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`relative flex flex-col items-center gap-1 rounded-3xl rounded-bl-md p-4 text-center transition-all cursor-pointer active:scale-95 ${selected
        ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
        : 'bg-surface-container hover:bg-surface-container-high'
        }`}
    >
      <span
        aria-hidden="true"
        className={`absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full transition-colors ${selected ? 'bg-primary text-on-primary' : 'bg-white/70 text-transparent'
          }`}
      >
        <span className="material-symbols-outlined text-[14px]">check</span>
      </span>
      <span className={`material-symbols-outlined text-[26px] ${selected ? 'text-primary' : 'text-on-surface-variant'}`}>
        {option.icon}
      </span>
      <span className={`text-sm font-semibold ${selected ? 'text-on-surface' : 'text-on-surface-variant'}`}>
        {option.label}
      </span>
      <span className="text-xs text-on-surface-variant">{option.hint}</span>
    </button>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all cursor-pointer ${active ? 'bg-primary text-on-primary border-primary' : 'bg-white text-on-surface-variant border-outline-variant hover:border-primary/50'
        }`}
    >
      {children}
    </button>
  );
}

function Stepper({ value, onDec, onInc, suffix }) {
  return (
    <div className="inline-flex items-center gap-2 bg-white border border-outline-variant p-1.5 rounded-2xl">
      <button onClick={onDec} aria-label="Kurangi" className="w-11 h-11 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-primary cursor-pointer active:scale-95 transition">
        <span className="material-symbols-outlined text-[22px]">remove</span>
      </button>
      <span className="min-w-24 text-center font-bold text-lg text-primary tabular-nums" aria-live="polite">
        {value} <span className="text-sm font-semibold text-on-surface-variant">{suffix}</span>
      </span>
      <button onClick={onInc} aria-label="Tambah" className="w-11 h-11 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-primary cursor-pointer active:scale-95 transition">
        <span className="material-symbols-outlined text-[22px]">add</span>
      </button>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-semibold text-on-surface text-right">{value}</span>
    </div>
  );
}
