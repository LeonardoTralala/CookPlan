import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { usePlan } from "../hooks/usePlan.js";
import { getRecipeById } from "../services/recipeService.js";
import { importSharedPlan, getCurrentPlan, setSlot, getCurrentWeekStart } from "../services/planService.js";

// Halaman tujuan redirect setelah login OAuth (Google). Rute ini PUBLIK dan
// sengaja TIDAK diproteksi: saat browser kembali dari Google, URL membawa
// "?code=..." yang masih perlu ditukar Supabase (detectSessionInUrl) menjadi
// sesi. Bila kita mendarat langsung di rute terproteksi seperti /catalog,
// ProtectedRoute akan melempar ke /auth dan membuang "?code" sebelum pertukaran
// selesai — sehingga login gagal. Di sini kita cukup menunggu sesi siap, lalu
// arahkan ke aplikasi.
export default function AuthCallback() {
  const { loading, isFullUser } = useAuth();
  const { showToast, refreshPlan } = usePlan();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && isFullUser) {
      const pendingToken = sessionStorage.getItem("pending_import_token");
      const pendingRecipeAction = sessionStorage.getItem("pending_recipe_action");

      if (pendingToken) {
        sessionStorage.removeItem("pending_import_token");
        importSharedPlan(pendingToken)
          .then(async () => {
            await refreshPlan();
            showToast("Rencana makan mingguan berhasil diimpor ke jadwal kamu! 🎉");
            navigate("/planner", { replace: true });
          })
          .catch((err) => {
            showToast(err?.message || "Gagal mengimpor rencana yang dibagikan.", { variant: "error" });
            navigate("/catalog", { replace: true });
          });
      } else if (pendingRecipeAction) {
        sessionStorage.removeItem("pending_recipe_action");
        (async () => {
          try {
            const actionData = JSON.parse(pendingRecipeAction);
            if (actionData?.type === "add_to_plan" && actionData?.recipeId) {
              const recipe = await getRecipeById(actionData.recipeId);
              if (recipe) {
                const currentWeekKey = getCurrentWeekStart();
                const { planId } = await getCurrentPlan(currentWeekKey);
                const targetDay = actionData.day || "Senin";
                const targetMeal = actionData.meal || "breakfast";
                const targetServings = actionData.servings || recipe.baseServings || 2;
                await setSlot(planId, recipe, targetDay, targetMeal, targetServings);
                await refreshPlan(currentWeekKey);
                showToast(`Resep ${recipe.title} berhasil ditambahkan ke jadwal ${targetDay} kamu! 🎉`, { variant: "success" });
              }
            }
            navigate("/planner", { replace: true, state: { from: "/planner" } });
          } catch (err) {
            showToast(err?.message || "Gagal menambahkan resep ke jadwal.", { variant: "error" });
            navigate("/catalog", { replace: true });
          }
        })();
      } else {
        navigate("/catalog", { replace: true });
      }
    }
  }, [loading, isFullUser, navigate, refreshPlan, showToast]);

  // Pertukaran kode tak kunjung menghasilkan sesi penuh → balik ke login.
  if (timedOut && !isFullUser) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-white">
      <span className="material-symbols-outlined animate-spin text-3xl text-primary" aria-hidden="true">
        progress_activity
      </span>
      <span className="sr-only">Menyelesaikan proses masuk…</span>
    </div>
  );
}
