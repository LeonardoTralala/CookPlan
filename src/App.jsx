import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { OnboardingGate } from './components/OnboardingGate.jsx';
import { AppShell } from './components/AppShell.jsx';
import { AdminLayout } from './components/AdminLayout.jsx';
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
const AuthCallback = lazy(() => import('./pages/AuthCallback.jsx'));
const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx').then((m) => ({ default: m.CatalogPage })));
const PlannerPage = lazy(() => import('./pages/PlannerPage.jsx').then((m) => ({ default: m.PlannerPage })));
const ShoppingPage = lazy(() => import('./pages/ShoppingPage.jsx').then((m) => ({ default: m.ShoppingPage })));
const UserProfile = lazy(() => import('./pages/UserProfile.jsx'));
const GeneratePlan = lazy(() => import('./pages/GeneratePlan.jsx').then((m) => ({ default: m.GeneratePlan })));
const GenerateResult = lazy(() => import('./pages/GenerateResult.jsx').then((m) => ({ default: m.GenerateResult })));
const Onboarding = lazy(() => import('./pages/Onboarding.jsx').then((m) => ({ default: m.Onboarding })));
const OrderPage = lazy(() => import('./pages/OrderPage.jsx').then((m) => ({ default: m.OrderPage })));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess.jsx').then((m) => ({ default: m.OrderSuccess })));
const AIProviders = lazy(() => import('./pages/admin/AIProviders.jsx').then((m) => ({ default: m.AIProviders })));
const RecipeManager = lazy(() => import('./pages/admin/RecipeManager.jsx').then((m) => ({ default: m.RecipeManager })));
const IngredientManager = lazy(() => import('./pages/admin/IngredientManager.jsx').then((m) => ({ default: m.IngredientManager })));
const PackageManager = lazy(() => import('./pages/admin/PackageManager.jsx').then((m) => ({ default: m.PackageManager })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx').then((m) => ({ default: m.AdminDashboard })));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders.jsx').then((m) => ({ default: m.AdminOrders })));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback.jsx').then((m) => ({ default: m.AdminFeedback })));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions.jsx').then((m) => ({ default: m.AdminSubscriptions })));
const SharedPlanPage = lazy(() => import('./pages/SharedPlanPage.jsx').then((m) => ({ default: m.SharedPlanPage })));
const SharedRecipePage = lazy(() => import('./pages/SharedRecipePage.jsx').then((m) => ({ default: m.SharedRecipePage })));
const RecipeFormPage = lazy(() => import('./pages/RecipeFormPage.jsx'));
const MyRecipesPage = lazy(() => import('./pages/MyRecipesPage.jsx'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage.jsx').then(m => ({ default: m.SubscriptionPage })));

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
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/share/plan/:shareToken" element={<SharedPlanPage />} />
          <Route path="/share/recipe/:recipeId" element={<SharedRecipePage />} />

          {/* Onboarding sekali: hanya akun penuh, TIDAK dibungkus OnboardingGate
              (mencegah redirect loop ke dirinya sendiri). */}
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<Onboarding />} />
          </Route>

          {/* Bisa dicoba tamu (sesi anonim) — generate & catalog.
              OnboardingGate: user PENUH tanpa persona diarahkan ke /onboarding;
              tamu dilewati. */}
          <Route element={<ProtectedRoute allowAnonymous />}>
            <Route element={<OnboardingGate />}>
              <Route path="/generate" element={<AppShell><GeneratePlan /></AppShell>} />
              <Route path="/generate/:planId" element={<AppShell><GenerateResult /></AppShell>} />
              <Route path="/catalog" element={<AppShell><CatalogPage /></AppShell>} />
            </Route>
          </Route>

          {/* Terproteksi (butuh akun penuh) + gate onboarding */}
          <Route element={<ProtectedRoute />}>
            <Route element={<OnboardingGate />}>
              <Route path="/order/:planId" element={<AppShell><OrderPage /></AppShell>} />
              <Route path="/order/sukses/:orderId" element={<AppShell><OrderSuccess /></AppShell>} />
              <Route path="/planner" element={<AppShell><PlannerPage /></AppShell>} />
              <Route path="/shopping" element={<AppShell><ShoppingPage /></AppShell>} />
              <Route path="/profile" element={<AppShell><UserProfile /></AppShell>} />
              <Route path="/subscription" element={<AppShell><SubscriptionPage /></AppShell>} />
              <Route path="/my-recipes" element={<AppShell><MyRecipesPage /></AppShell>} />
              <Route path="/recipes/create" element={<AppShell><RecipeFormPage /></AppShell>} />
              <Route path="/recipes/:id/edit" element={<AppShell><RecipeFormPage /></AppShell>} />
              <Route path="/admin" element={<AppShell><AdminLayout><AdminDashboard /></AdminLayout></AppShell>} />
              <Route path="/admin/ai" element={<AppShell><AdminLayout><AIProviders /></AdminLayout></AppShell>} />
              <Route path="/admin/recipes" element={<AppShell><AdminLayout><RecipeManager /></AdminLayout></AppShell>} />
              <Route path="/admin/ingredients" element={<AppShell><AdminLayout><IngredientManager /></AdminLayout></AppShell>} />
              <Route path="/admin/packages" element={<AppShell><AdminLayout><PackageManager /></AdminLayout></AppShell>} />
              <Route path="/admin/orders" element={<AppShell><AdminLayout><AdminOrders /></AdminLayout></AppShell>} />
              <Route path="/admin/feedback" element={<AppShell><AdminLayout><AdminFeedback /></AdminLayout></AppShell>} />
              <Route path="/admin/subscriptions" element={<AppShell><AdminLayout><AdminSubscriptions /></AdminLayout></AppShell>} />
            </Route>
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
