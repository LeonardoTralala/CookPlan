import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePlan, getGeneratedHistory, getTodayUsageCount, deleteGeneratedPlan } from '../services/aiService.js';
import { getActiveDietTags } from '../services/dietService.js';
import { usePlan } from '../hooks/usePlan.js';

// Fitur 1: Generate Foodplan & Foodprep. Wizard 3 langkah (mobile-first).
// Step 1: periode + porsi + waktu makan
// Step 2: diet + budget + bahan tersedia (pantry)
// Step 3: konfirmasi + generate

// Batas periode plan (hari). Maksimal 7 supaya selaras dengan kapasitas planner
// mingguan (Senin–Minggu) dan validasi server (validateInput).
const PERIODE_MAX = 7;

// Variasi menu per hari: berapa RESEP BERBEDA yang dimasak dalam sehari. Setiap
// hari tetap 3 waktu makan (breakfast/lunch/dinner); bila variasi < 3, resep yang
// sama dipakai ulang untuk mengisi waktu makan sisanya (konsep foodprep — masak
// sekali, makan beberapa kali). Maks 3 karena tidak mungkin > jumlah waktu makan.
const VARIASI_MAX = 3;
const MEAL_SLOTS_PER_DAY = 3;

// Opsi diet sekarang diambil dinamis dari tabel diet_tags (lihat dietService).
// Konstanta ini cuma FALLBACK bila fetch gagal / tabel belum di-push, supaya
// wizard tidak pernah kosong. Selaras dengan seed migrasi diet_tags.
const DEFAULT_DIET_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
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

export function GeneratePlan() {
  const navigate = useNavigate();
  const { showToast } = usePlan();

  const [step, setStep] = useState(1);
  const [periode, setPeriode] = useState(7);
  const [porsi, setPorsi] = useState(2);
  const [variasiPerHari, setVariasiPerHari] = useState(1);
  const [diet, setDiet] = useState(['halal']);
  const [budget, setBudget] = useState(200000);
  const [pantry, setPantry] = useState([]);
  const [pantryInput, setPantryInput] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [usageCount, setUsageCount] = useState(null);
  const [dietOptions, setDietOptions] = useState(DEFAULT_DIET_OPTIONS);

  // Riwayat generate + kuota harian (info, bukan blocker — server tetap validasi).
  // Opsi diet di-fetch dari diet_tags; gagal → tetap pakai fallback konstanta.
  useEffect(() => {
    let active = true;
    getGeneratedHistory(5, { successOnly: true })
      .then((rows) => { if (active) setHistory(rows); })
      .catch(() => { /* riwayat opsional, jangan ganggu wizard */ });
    getTodayUsageCount()
      .then((n) => { if (active) setUsageCount(n); })
      .catch(() => { /* idem */ });
    getActiveDietTags()
      .then((rows) => { if (active && rows.length) setDietOptions(rows); })
      .catch(() => { /* pakai DEFAULT_DIET_OPTIONS */ });
    return () => { active = false; };
  }, []);

  const toggleDiet = (value) => {
    setDiet((prev) => prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]);
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
    setLoading(true);
    setError('');
    try {
      // outputType selalu 'full' — pilihan jenis output dihapus dari wizard;
      // hasil selalu lengkap (menu + belanja + prep), Core Offer tetap tersedia.
      const result = await generatePlan({ periode, porsi, variasiPerHari, diet, budget, pantry, notes, outputType: 'full' });
      // Simpan hasil ke sessionStorage agar GenerateResult bisa baca tanpa refetch.
      sessionStorage.setItem(`plan_${result.planId}`, JSON.stringify(result));
      showToast('Plan berhasil dibuat! 🎉');
      // autoApply: hasil generate langsung diterapkan ke Rencana Masak Mingguan.
      navigate(`/generate/${result.planId}`, { state: { autoApply: true } });
    } catch (e) {
      setError(e.message || 'Gagal generate plan. Coba lagi.');
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
        {usageCount != null && (
          <p className="text-xs text-on-surface-variant/80 mb-5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            Sisa kuota hari ini: <strong>{Math.max(0, DAILY_LIMIT - usageCount)}</strong> dari {DAILY_LIMIT} generate
          </p>
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
              Tetap {MEAL_SLOTS_PER_DAY}× makan/hari. {variasiPerHari === 1
                ? 'Masak 1 menu sekali, dimakan pagi–siang–malam (foodprep).'
                : variasiPerHari >= MEAL_SLOTS_PER_DAY
                  ? 'Tiap waktu makan menu berbeda.'
                  : `${variasiPerHari} menu berbeda, dipakai ulang menutup ${MEAL_SLOTS_PER_DAY} waktu makan.`}
            </p>
          </Field>

          <div className="flex justify-end pt-2">
            <button onClick={() => setStep(2)} className="px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer">
              Lanjut
            </button>
          </div>

          {/* Riwayat generate — hasil lama tetap bisa dibuka lagi dari sini */}
          {history.length > 0 && (
            <div className="pt-4 border-t border-outline-variant/60">
              <h2 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px] text-primary">history</span>
                Hasil Generate Sebelumnya
              </h2>
              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => navigate(`/generate/${h.id}`)}
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
            </div>
          )}
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-7 animate-fade-in">
          <Field label="Preferensi diet (boleh pilih >1)">
            <div className="flex flex-wrap gap-2">
              {dietOptions.map((opt) => (
                <Chip key={opt.value} active={diet.includes(opt.value)} onClick={() => toggleDiet(opt.value)}>
                  {opt.label}
                </Chip>
              ))}
            </div>
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
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
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
              label="Variasi menu"
              value={`${variasiPerHari} variasi/hari${variasiPerHari === 1 ? ' (masak sekali, seharian)' : ''}`}
            />
            <SummaryRow label="Diet" value={diet.length ? diet.join(', ') : 'Tidak ada'} />
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
              Sonnet 4.5 thinking butuh beberapa detik untuk berpikir mendalam…
            </p>
          )}
        </div>
      )}
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
    <div className="flex items-center gap-4 bg-surface-container-low border border-outline-variant p-2 rounded-2xl justify-between max-w-xs">
      <button onClick={onDec} aria-label="Kurangi" className="w-11 h-11 rounded-xl bg-white border border-outline-variant flex items-center justify-center text-primary cursor-pointer active:scale-95 transition">
        <span className="material-symbols-outlined">remove</span>
      </button>
      <span className="font-bold text-lg text-primary" aria-live="polite">{value} {suffix}</span>
      <button onClick={onInc} aria-label="Tambah" className="w-11 h-11 rounded-xl bg-white border border-outline-variant flex items-center justify-center text-primary cursor-pointer active:scale-95 transition">
        <span className="material-symbols-outlined">add</span>
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
