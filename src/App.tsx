import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import StoresList from "./pages/stores/StoresList";
import Rentals from "./pages/stores/Rentals";
import NewStoreOpening from "./pages/stores/NewStoreOpening";
import Products from "./pages/assets/Products";
import AssetInventory from "./pages/assets/AssetInventory";
import SparesManagement from "./pages/assets/SparesManagement";
import ServiceContracts from "./pages/services/ServiceContracts";
import PreventiveMaintenance from "./pages/services/PreventiveMaintenance";
import IncidentManagement from "./pages/services/IncidentManagement";
import Vendors from "./pages/Vendors";
import PettyCash from "./pages/PettyCash";
import Utilities from "./pages/Utilities";
import Employees from "./pages/staff/Employees";
import Attendance from "./pages/staff/Attendance";
import Housekeeping from "./pages/Housekeeping";
import Security from "./pages/Security";
import Footfall from "./pages/Footfall";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stores" element={<StoresList />} />
            <Route path="/stores/rentals" element={<Rentals />} />
            <Route path="/stores/new-opening" element={<NewStoreOpening />} />
            <Route path="/assets/products" element={<Products />} />
            <Route path="/assets/inventory" element={<AssetInventory />} />
            <Route path="/assets/spares" element={<SparesManagement />} />
            <Route path="/services/contracts" element={<ServiceContracts />} />
            <Route path="/services/maintenance" element={<PreventiveMaintenance />} />
            <Route path="/services/incidents" element={<IncidentManagement />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/petty-cash" element={<PettyCash />} />
            <Route path="/utilities" element={<Utilities />} />
            <Route path="/staff/employees" element={<Employees />} />
            <Route path="/staff/attendance" element={<Attendance />} />
            <Route path="/housekeeping" element={<Housekeeping />} />
            <Route path="/security" element={<Security />} />
            <Route path="/footfall" element={<Footfall />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
