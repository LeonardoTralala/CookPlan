import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AppShell } from './components/AppShell.jsx';
import { RouteFallback } from './components/RouteFallback.jsx';
import { Toast } from './components/Toast.jsx';
import { InstallPrompt } from './components/InstallPrompt.jsx';

// Code-splitting per route (React.lazy): hanya LandingPage + shell yang masuk
// bundle awal; sisanya dipecah jadi chunk terpisah & dimuat saat dibutuhkan.
// Named export dibungkus jadi { default } karena lazy() butuh default export.
const PreRegister = lazy(() => import('./pages/PreRegister.jsx').then((m) => ({ default: m.PreRegister })));
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

// Routing penuh CookPlan. Halaman publik (landing, pre-register, legal) + halaman
// aplikasi terproteksi (generate, katalog, planner, belanja, profil) di balik
// ProtectedRoute. Auth diaktifkan kembali setelah fase pre-register.
//
// Suspense berlapis: outer untuk route publik yang di-lazy (auth/legal/prereg);
// AppShell punya Suspense sendiri agar nav tetap terlihat saat konten protected
// page dimuat (tidak flicker tiap pindah tab).
function App() {
  const navigate = useNavigate();
  const handleNavigate = (path) => navigate(path === 'overview' ? '/' : `/${path}`);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Publik */}
          <Route path="/" element={<LandingPage onNavigate={handleNavigate} />} />
          <Route path="/register" element={<PreRegister onNavigate={handleNavigate} />} />
          <Route path="/privacy" element={<PrivacyPolicy onNavigate={handleNavigate} />} />
          <Route path="/help" element={<HelpCenter onNavigate={handleNavigate} />} />
          <Route path="/terms" element={<TermsOfService onNavigate={handleNavigate} />} />
          <Route path="/about" element={<TeamProfile onNavigate={handleNavigate} />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Terproteksi (butuh login) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/generate" element={<AppShell><GeneratePlan /></AppShell>} />
            <Route path="/generate/:planId" element={<AppShell><GenerateResult /></AppShell>} />
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
