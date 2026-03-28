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
import About from "./pages/About";
import { useIsMobileLayout } from "@/hooks/useCapacitor";
import Products from "./pages/Products";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProgramDetail from "./pages/ProgramDetail";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import AffiliateApply from "./pages/AffiliateApply";
import NotFound from "./pages/NotFound";
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

const AppRoutes = () => {
  const isMobile = useIsMobileLayout();

  return (
    <Routes>
      <Route path="/" element={isMobile ? <MobileHome /> : <Index />} />
      <Route path="/about" element={<About />} />
      <Route path="/produkter" element={<Products />} />
      <Route path="/login" element={<Login />} />
      <Route path="/program/:slug" element={<ProgramDetail />} />
      <Route path="/bli-affiliate" element={<AffiliateApply />} />
      <Route path="/affiliate" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
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
