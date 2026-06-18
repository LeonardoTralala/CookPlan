import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AppShell } from './components/AppShell.jsx';
import { RouteFallback } from './components/RouteFallback.jsx';
import { Toast } from './components/Toast.jsx';
import { InstallPrompt } from './components/InstallPrompt.jsx';

// Code-splitting per route (React.lazy): hanya shell yang masuk bundle awal;
// sisanya dipecah jadi chunk terpisah & dimuat saat dibutuhkan.
// Named export dibungkus jadi { default } karena lazy() butuh default export.
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx').then((m) => ({ default: m.PrivacyPolicy })));
const HelpCenter = lazy(() => import('./pages/HelpCenter.jsx').then((m) => ({ default: m.HelpCenter })));
const TermsOfService = lazy(() => import('./pages/TermsOfService.jsx').then((m) => ({ default: m.TermsOfService })));
const TeamProfile = lazy(() => import('./pages/TeamProfile.jsx').then((m) => ({ default: m.TeamProfile })));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx').then((m) => ({ default: m.CatalogPage })));
const PlannerPage = lazy(() => import('./pages/PlannerPage.jsx').then((m) => ({ default: m.PlannerPage })));
const ShoppingPage = lazy(() => import('./pages/ShoppingPage.jsx').then((m) => ({ default: m.ShoppingPage })));
const UserProfile = lazy(() => import('./pages/UserProfile.jsx'));
const GeneratePlan = lazy(() => import('./pages/GeneratePlan.jsx').then((m) => ({ default: m.GeneratePlan })));
const GenerateResult = lazy(() => import('./pages/GenerateResult.jsx').then((m) => ({ default: m.GenerateResult })));
const OrderPage = lazy(() => import('./pages/OrderPage.jsx').then((m) => ({ default: m.OrderPage })));
const AIProviders = lazy(() => import('./pages/admin/AIProviders.jsx').then((m) => ({ default: m.AIProviders })));

// Routing penuh CookPlan. Membuka aplikasi (root "/") langsung mengarahkan ke
// /generate; pengguna yang belum login akan dilempar ke /auth oleh
// ProtectedRoute. Halaman legal tetap publik; sisanya terproteksi.
//
// Suspense berlapis: outer untuk route publik yang di-lazy (auth/legal);
// AppShell punya Suspense sendiri agar nav tetap terlihat saat konten protected
// page dimuat (tidak flicker tiap pindah tab).
function App() {
  const navigate = useNavigate();
  const handleNavigate = (path) => navigate(path === 'overview' ? '/' : `/${path}`);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Membuka aplikasi langsung menuju generate */}
          <Route path="/" element={<Navigate to="/generate" replace />} />

          {/* Publik */}
          <Route path="/privacy" element={<PrivacyPolicy onNavigate={handleNavigate} />} />
          <Route path="/help" element={<HelpCenter onNavigate={handleNavigate} />} />
          <Route path="/terms" element={<TermsOfService onNavigate={handleNavigate} />} />
          <Route path="/about" element={<TeamProfile onNavigate={handleNavigate} />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Bisa dicoba tamu (sesi anonim) — generate + lihat hasil, limit 2x */}
          <Route element={<ProtectedRoute allowAnonymous />}>
            <Route path="/generate" element={<AppShell><GeneratePlan /></AppShell>} />
            <Route path="/generate/:planId" element={<AppShell><GenerateResult /></AppShell>} />
          </Route>

          {/* Terproteksi (butuh akun penuh) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/order/:planId" element={<AppShell><OrderPage /></AppShell>} />
            <Route path="/catalog" element={<AppShell><CatalogPage /></AppShell>} />
            <Route path="/planner" element={<AppShell><PlannerPage /></AppShell>} />
            <Route path="/shopping" element={<AppShell><ShoppingPage /></AppShell>} />
            <Route path="/profile" element={<AppShell><UserProfile /></AppShell>} />
            <Route path="/admin/ai" element={<AppShell><AIProviders /></AppShell>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toast />
      <InstallPrompt />
    </>
  );
}

export default App;
