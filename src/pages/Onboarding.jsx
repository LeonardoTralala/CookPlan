import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { usePlan } from "../hooks/usePlan.js";
import { updateProfile } from "../services/profileService.js";
import { setCachedPersona } from "../utils/personaCache.js";
import { PERSONA_OPTIONS } from "../utils/persona.js";

// Onboarding sekali seumur hidup: pengguna baru memilih persona ("siapakah
// kamu"). Disimpan ke profiles.persona; setelah itu OnboardingGate tidak pernah
// mengarahkan ke sini lagi. Tujuan setelah simpan = halaman yang tadi dituju
// (location.state.from) atau /generate.
export function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { showToast } = usePlan();

  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  const dest = location.state?.from || "/generate";

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateProfile({ persona: selected });
      setCachedPersona(user?.id ?? null, selected); // lepas gate tanpa refetch
      navigate(dest, { replace: true });
    } catch (err) {
      showToast(err.message || "Gagal menyimpan. Coba lagi.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas-white flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-4xl text-primary mb-2">waving_hand</span>
          <h1 className="font-headline-lg text-headline-lg text-primary mb-2">Pilih profil yang menggambarkanmu:</h1>
          <p className="text-on-surface-variant text-body-md">
            Bantu kami menyesuaikan rekomendasi menu untukmu. Cukup pilih satu — bisa diubah nanti di Profil.
          </p>
        </div>

        <div className="space-y-3">
          {PERSONA_OPTIONS.map((opt) => {
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                aria-pressed={active}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${active
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant bg-surface-container-lowest hover:border-primary/50"
                  }`}
              >
                <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${active ? "bg-primary text-on-primary" : "bg-surface-cream text-primary"
                  }`}>
                  <span className="material-symbols-outlined">{opt.icon}</span>
                </span>
                <span className={`flex-1 font-semibold text-sm ${active ? "text-primary" : "text-on-surface"}`}>
                  {opt.label}
                </span>
                {active && (
                  <span className="material-symbols-outlined text-primary fill" aria-hidden="true">check_circle</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={!selected || saving}
          className="mt-8 w-full px-6 py-3.5 bg-primary text-on-primary rounded-full font-semibold text-sm hover:shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              Menyimpan...
            </>
          ) : (
            <>
              Lanjut
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default Onboarding;
