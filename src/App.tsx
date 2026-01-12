import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import StoresList from "./pages/stores/StoresList";
import StoreDetails from "./pages/stores/StoreDetails";
import Rentals from "./pages/stores/Rentals";
import NewStoreOpening from "./pages/stores/NewStoreOpening";
import Products from "./pages/assets/Products";
import AssetInventory from "./pages/assets/AssetInventory";
import AssetDetails from "./pages/assets/AssetDetails";
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
import MeterMaster from "./pages/master/MeterMaster";
import DepartmentMaster from "./pages/master/DepartmentMaster";
import PositionMaster from "./pages/master/PositionMaster";
import CategoryMaster from "./pages/master/CategoryMaster";
import LocationMaster from "./pages/master/LocationMaster";
import Planograms from "./pages/vm/Planograms";
import ComplianceTasks from "./pages/vm/ComplianceTasks";
import PhotoSubmission from "./pages/vm/PhotoSubmission";
import ReviewSubmissions from "./pages/vm/ReviewSubmissions";
import Warehouses from "./pages/inventory/Warehouses";
import InventoryItems from "./pages/inventory/InventoryItems";
import Requisitions from "./pages/inventory/Requisitions";
import ShipmentTracking from "./pages/inventory/ShipmentTracking";
import GoodsReceipt from "./pages/inventory/GoodsReceipt";
import StockAudit from "./pages/inventory/StockAudit";
import ConsumptionLog from "./pages/inventory/ConsumptionLog";
import ExpiryManagement from "./pages/inventory/ExpiryManagement";
import ReturnToVendor from "./pages/inventory/ReturnToVendor";
import StoreTransfers from "./pages/inventory/StoreTransfers";
import LowStockAlerts from "./pages/inventory/LowStockAlerts";
import TaskMaster from "./pages/operations/TaskMaster";
import RoleMaster from "./pages/operations/RoleMaster";
import TaskTemplates from "./pages/operations/TaskTemplates";
import TaskAdherence from "./pages/operations/TaskAdherence";
import StoreHeatmap from "./pages/operations/StoreHeatmap";
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
            <Route path="/stores/:id" element={<StoreDetails />} />
            <Route path="/stores/rentals" element={<Rentals />} />
            <Route path="/stores/new-opening" element={<NewStoreOpening />} />
            <Route path="/assets/products" element={<Products />} />
            <Route path="/assets/inventory" element={<AssetInventory />} />
            <Route path="/assets/inventory/:id" element={<AssetDetails />} />
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
            <Route path="/master/meter" element={<MeterMaster />} />
            <Route path="/master/department" element={<DepartmentMaster />} />
            <Route path="/master/position" element={<PositionMaster />} />
            <Route path="/master/category" element={<CategoryMaster />} />
            <Route path="/master/location" element={<LocationMaster />} />
            <Route path="/vm/planograms" element={<Planograms />} />
            <Route path="/vm/tasks" element={<ComplianceTasks />} />
            <Route path="/vm/submit" element={<PhotoSubmission />} />
            <Route path="/vm/review" element={<ReviewSubmissions />} />
            <Route path="/inventory/warehouses" element={<Warehouses />} />
            <Route path="/inventory/items" element={<InventoryItems />} />
            <Route path="/inventory/requisitions" element={<Requisitions />} />
            <Route path="/inventory/shipments" element={<ShipmentTracking />} />
            <Route path="/inventory/grn" element={<GoodsReceipt />} />
            <Route path="/inventory/audit" element={<StockAudit />} />
            <Route path="/inventory/consumption" element={<ConsumptionLog />} />
            <Route path="/inventory/expiry" element={<ExpiryManagement />} />
            <Route path="/inventory/rtv" element={<ReturnToVendor />} />
            <Route path="/inventory/transfers" element={<StoreTransfers />} />
            <Route path="/inventory/alerts" element={<LowStockAlerts />} />
            <Route path="/operations/tasks" element={<TaskMaster />} />
            <Route path="/operations/roles" element={<RoleMaster />} />
            <Route path="/operations/templates" element={<TaskTemplates />} />
            <Route path="/operations/adherence" element={<TaskAdherence />} />
            <Route path="/operations/heatmap" element={<StoreHeatmap />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
