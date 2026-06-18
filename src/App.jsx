import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PrivacyPolicy } from './pages/PrivacyPolicy.jsx';
import { HelpCenter } from './pages/HelpCenter.jsx';
import { TermsOfService } from './pages/TermsOfService.jsx';
import { TeamProfile } from './pages/TeamProfile.jsx';
import AuthPage from './pages/AuthPage.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AppShell } from './components/AppShell.jsx';
import { CatalogPage } from './pages/CatalogPage.jsx';
import { PlannerPage } from './pages/PlannerPage.jsx';
import { ShoppingPage } from './pages/ShoppingPage.jsx';
import UserProfile from './pages/UserProfile.jsx';
import { GeneratePlan } from './pages/GeneratePlan.jsx';
import { GenerateResult } from './pages/GenerateResult.jsx';
import { OrderPage } from './pages/OrderPage.jsx';
import { AIProviders } from './pages/admin/AIProviders.jsx';
import { Toast } from './components/Toast.jsx';
import { InstallPrompt } from './components/InstallPrompt.jsx';

// Routing penuh CookPlan. Membuka aplikasi (root "/") langsung mengarahkan ke
// /generate; pengguna yang belum login akan dilempar ke /auth oleh
// ProtectedRoute. Halaman legal tetap publik; sisanya terproteksi.
function App() {
  const navigate = useNavigate();
  const handleNavigate = (path) => navigate(path === 'overview' ? '/' : `/${path}`);

  return (
    <>
      <Routes>
        {/* Membuka aplikasi langsung menuju generate */}
        <Route path="/" element={<Navigate to="/generate" replace />} />

        {/* Publik */}
        <Route path="/privacy" element={<PrivacyPolicy onNavigate={handleNavigate} />} />
        <Route path="/help" element={<HelpCenter onNavigate={handleNavigate} />} />
        <Route path="/terms" element={<TermsOfService onNavigate={handleNavigate} />} />
        <Route path="/about" element={<TeamProfile onNavigate={handleNavigate} />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

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
      <Toast />
      <InstallPrompt />
    </>
  );
}

export default App;
