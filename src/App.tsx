import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ImpersonationProvider } from "@/hooks/useImpersonation";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import Index from "./pages/Index";
import MobileHome from "./pages/mobile/MobileHome";
import MobileAccount from "./pages/mobile/MobileAccount";
import MobileCategory from "./pages/mobile/MobileCategory";
import MobilePrograms from "./pages/mobile/MobilePrograms";
import MobileProfile from "./pages/mobile/MobileProfile";
import MobileNotifications from "./pages/mobile/MobileNotifications";
import MobileSecurity from "./pages/mobile/MobileSecurity";
import About from "./pages/About";
import MobileAbout from "./pages/mobile/MobileAbout";
import { useIsMobileLayout } from "@/hooks/useCapacitor";
import Products from "./pages/Products";
import MobileShop from "./pages/mobile/MobileShop";
import MobileNews from "./pages/mobile/MobileNews";
import Login from "./pages/Login";
import MobileLogin from "./pages/mobile/MobileLogin";
import Dashboard from "./pages/Dashboard";
import ProgramDetail from "./pages/ProgramDetail";
import MobileProgramDetail from "./pages/mobile/MobileProgramDetail";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import AffiliateApply from "./pages/AffiliateApply";
import NotFound from "./pages/NotFound";
import FAQ from "./pages/FAQ";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPrograms from "./pages/admin/AdminPrograms";
import AdminAudio from "./pages/admin/AdminAudio";
import AdminPurchases from "./pages/admin/AdminPurchases";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminImportUsers from "./pages/admin/AdminImportUsers";
import AdminAffiliates from "./pages/admin/AdminAffiliates";
import AdminDiscountCodes from "./pages/admin/AdminDiscountCodes";
import AdminCategoryPurchases from "./pages/admin/AdminCategoryPurchases";
import AdminCategoryAccess from "./pages/admin/AdminCategoryAccess";
import AdminLoginHistory from "./pages/admin/AdminLoginHistory";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PaymentReturn from "./pages/PaymentReturn";

const AppRoutes = () => {
  const isMobile = useIsMobileLayout();

  return (
    <Routes>
      <Route path="/" element={isMobile ? <MobileHome /> : <Index />} />
      <Route path="/about" element={<About />} />
      <Route path="/produkter" element={isMobile ? <MobileShop /> : <Products />} />
      <Route path="/login" element={isMobile ? <MobileLogin /> : <Login />} />
      <Route path="/kategori/:slug" element={<MobileCategory />} />
      <Route path="/aktuellt" element={<MobileNews />} />
      <Route path="/program/:slug" element={isMobile ? <MobileProgramDetail /> : <ProgramDetail />} />
      <Route path="/bli-affiliate" element={<AffiliateApply />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/villkor" element={<Terms />} />
      <Route path="/integritetspolicy" element={<PrivacyPolicy />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/kop-bekraftelse" element={<ProtectedRoute><PaymentReturn /></ProtectedRoute>} />
      <Route path="/affiliate" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
      <Route path="/mitt-konto" element={<ProtectedRoute>{isMobile ? <MobileAccount /> : <Dashboard />}</ProtectedRoute>} />
      <Route path="/mitt-konto/profil" element={<ProtectedRoute><MobileProfile /></ProtectedRoute>} />
      <Route path="/mitt-konto/notiser" element={<ProtectedRoute><MobileNotifications /></ProtectedRoute>} />
      <Route path="/mitt-konto/sakerhet" element={<ProtectedRoute><MobileSecurity /></ProtectedRoute>} />
      <Route path="/mina-program" element={<ProtectedRoute>{isMobile ? <MobilePrograms /> : <Dashboard />}</ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="programs" element={<AdminPrograms />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="audio" element={<AdminAudio />} />
        <Route path="purchases" element={<AdminPurchases />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="import" element={<AdminImportUsers />} />
        <Route path="affiliates" element={<AdminAffiliates />} />
        <Route path="rabattkoder" element={<AdminDiscountCodes />} />
        <Route path="kategori-kop" element={<AdminCategoryPurchases />} />
        <Route path="kategori-tilldelning" element={<AdminCategoryAccess />} />
        <Route path="login-historik" element={<AdminLoginHistory />} />
        <Route path="analys" element={<AdminAnalytics />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ImpersonationProvider>
            <TooltipProvider>
              <ImpersonationBanner />
              <Toaster />
              <Sonner />
              <AppRoutes />
            </TooltipProvider>
          </ImpersonationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
