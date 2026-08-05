import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSharedPlanByToken, importSharedPlan, getCurrentWeekStart } from "../services/planService.js";
import { useAuth } from "../hooks/useAuth.js";
import { usePlan } from "../hooks/usePlan.js";
import { AppShell } from "../components/AppShell.jsx";
import { SEOHead } from "../components/SEOHead.jsx";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MEAL_LABELS = { breakfast: "Sarapan", lunch: "Makan Siang", dinner: "Makan Malam" };

export function SharedPlanPage() {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const { isFullUser } = useAuth();
  const { showToast, refreshPlan } = usePlan();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharedData, setSharedData] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let active = true;
    getSharedPlanByToken(shareToken)
      .then((data) => {
        if (active) {
          setSharedData(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Gagal memuat rencana mingguan yang dibagikan.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [shareToken]);

  const currentWeekKey = getCurrentWeekStart();

  // Auto-import jika user baru saja login / daftar dari halaman ini
  useEffect(() => {
    if (!loading && sharedData && isFullUser) {
      const pendingToken = sessionStorage.getItem("pending_import_token");
      if (pendingToken === shareToken) {
        sessionStorage.removeItem("pending_import_token");
        importSharedPlan(shareToken, currentWeekKey)
          .then(async () => {
            await refreshPlan(currentWeekKey);
            showToast("Rencana makan mingguan berhasil diimpor ke jadwal kamu! 🎉", { variant: "success" });
            navigate("/planner", { replace: true });
          })
          .catch((err) => {
            showToast(err.message || "Gagal mengimpor rencana makan.", { variant: "error" });
          });
      }
    }
  }, [loading, sharedData, isFullUser, shareToken, currentWeekKey, refreshPlan, showToast, navigate]);

  const handleStartImport = async () => {
    if (!isFullUser) {
      // Belum login -> simpan token ke sessionStorage & lempar ke auth
      sessionStorage.setItem("pending_import_token", shareToken);
      showToast("Silakan masuk atau buat akun gratis untuk mengimpor rencana makan ini!", { variant: "info" });
      navigate("/auth", { state: { from: `/share/plan/${shareToken}` } });
      return;
    }

    // Sudah login -> langsung impor ke minggu ini
    setImporting(true);
    try {
      await importSharedPlan(shareToken, currentWeekKey);
      await refreshPlan(currentWeekKey);
      showToast("Rencana makan mingguan berhasil diimpor ke jadwal kamu!", { variant: "success" });
      navigate("/planner");
    } catch (err) {
      showToast(err.message || "Gagal mengimpor rencana makan.", { variant: "error" });
    } finally {
      setImporting(false);
    }
  };

  // Hitung total menu masakan
  let totalMeals = 0;

  if (sharedData?.plan) {
    for (const day of DAYS) {
      const slots = sharedData.plan[day];
      if (!slots) continue;
      for (const m of ["breakfast", "lunch", "dinner"]) {
        if (slots[m]) {
          totalMeals++;
        }
      }
    }
  }

  return (
    <AppShell>
      <SEOHead
        title={sharedData ? `Rencana Menu Masak Mingguan (${totalMeals} Menu) — CookPlan` : 'Rencana Menu Masak Mingguan — CookPlan'}
        description="Lihat rekomendasi rencana menu makan harian & mingguan yang dibagikan dari CookPlan. Lengkap dengan daftar masakan dan porsi."
        canonicalUrl={`https://cookplan.id/share/plan/${shareToken}`}
      />
      <div className="bg-canvas-white min-h-dvh font-sans text-on-surface pb-24">
        {/* Header Hero */}
        <section className="pt-8 pb-6 px-4 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs mb-3">
            <span className="material-symbols-outlined text-sm">share</span>
            Rencana Mingguan yang Dibagikan
          </div>
          <h1 className="font-headline-md text-3xl md:text-4xl text-primary tracking-tight mb-2">
            Rencana Masak Minggu Ini
          </h1>
          <p className="text-sm text-on-surface-variant max-w-lg mx-auto">
            Seseorang membagikan rencana makan minggu ini untuk kamu. Kamu bisa melihat detail resep dan langsung mengimpornya ke jadwal CookPlan kamu!
          </p>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary mb-3">progress_activity</span>
            <p className="text-sm text-on-surface-variant font-medium">Memuat rencana mingguan…</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto px-4 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-error mb-3">error_outline</span>
            <h2 className="font-bold text-lg text-on-surface mb-2">Rencana Tidak Ditemukan</h2>
            <p className="text-xs text-on-surface-variant mb-6">{error}</p>
            <button
              onClick={() => navigate("/planner")}
              className="px-6 py-2.5 bg-primary text-white rounded-full font-bold text-sm hover:bg-primary-container transition cursor-pointer"
            >
              Ke Planner Saya
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 space-y-6">
            {/* Action Bar (Top CTA) */}
            <div className="bg-surface-cream border border-outline-variant rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-base">
                    {totalMeals} Menu Masakan
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Salin ke jadwalmu & bebas edit/sesuaikan sesuai selera!
                  </p>
                </div>
              </div>

              <button
                onClick={handleStartImport}
                disabled={importing}
                className="w-full md:w-auto px-8 py-3.5 bg-primary text-white font-bold text-sm rounded-full hover:bg-primary-container active:scale-95 transition shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-xl">file_download</span>
                {importing ? "Mengimpor Rencana…" : "Salin ke Rencana Mingguan Saya"}
              </button>
            </div>

            {/* 7-Day Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DAYS.map((day) => {
                const daySlots = sharedData?.plan?.[day];
                const hasMeals = daySlots && Object.values(daySlots).some(Boolean);

                return (
                  <div key={day} className="bg-white border border-outline-variant rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2 mb-3">
                        <h3 className="font-bold text-primary text-base flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-lg">calendar_today</span>
                          {day}
                        </h3>
                        <span className="text-[11px] font-semibold text-on-surface-variant px-2 py-0.5 bg-surface-cream rounded-full">
                          {hasMeals ? `${Object.values(daySlots).filter(Boolean).length} Menu` : "Kosong"}
                        </span>
                      </div>

                      {!hasMeals ? (
                        <p className="text-xs text-on-surface-variant/60 italic py-4 text-center">Belum ada menu</p>
                      ) : (
                        <div className="space-y-2.5">
                          {["breakfast", "lunch", "dinner"].map((mType) => {
                            const slot = daySlots[mType];
                            if (!slot) return null;
                            return (
                              <div key={mType} className="flex items-center gap-3 p-2 rounded-xl bg-surface-cream/40 border border-outline-variant/40">
                                {slot.imageUrl && (
                                  <img
                                    src={slot.imageUrl}
                                    alt={slot.title}
                                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                                    onError={(e) => { e.currentTarget.src = "/img/recipe-placeholder.svg"; }}
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                                    {MEAL_LABELS[mType]} ({slot.servings} Porsi)
                                  </span>
                                  <h4 className="text-xs font-bold text-on-surface truncate">{slot.title}</h4>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Floating CTA */}
            <div className="text-center pt-4">
              <button
                onClick={handleStartImport}
                disabled={importing}
                className="px-10 py-4 bg-primary text-white font-extrabold text-base rounded-full hover:bg-primary-container active:scale-95 transition shadow-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">file_download</span>
                {importing ? "Mengimpor Rencana…" : "Salin ke Rencana Mingguan Saya"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default SharedPlanPage;

