import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { PWAInstallPrompt } from "./components/pwa/PWAInstallPrompt";
import LandingPage from "./pages/landing/LandingPage";
import Login from "./pages/auth/Login";
import Install from "./pages/Install";
import Dashboard from "./pages/Dashboard";
import StoresList from "./pages/stores/StoresList";
import StoreDetails from "./pages/stores/StoreDetails";
import Rentals from "./pages/stores/Rentals";
import NewStoreOpening from "./pages/stores/NewStoreOpening";
import NSOChecklistDetails from "./pages/stores/NSOChecklistDetails";
import StorePlans from "./pages/stores/StorePlans";
import StorePlanDetails from "./pages/stores/StorePlanDetails";
import Franchisees from "./pages/stores/Franchisees";
import FranchiseeDetails from "./pages/stores/FranchiseeDetails";
import StoreTargets from "./pages/stores/StoreTargets";
import StoreTargetDetails from "./pages/stores/StoreTargetDetails";
import StoreTargetDashboard from "./pages/stores/StoreTargetDashboard";
import AssetMaster from "./pages/assets/AssetMaster";
import AssetMasterDetails from "./pages/assets/AssetMasterDetails";
import AssetInventory from "./pages/assets/AssetInventory";
import AssetDetails from "./pages/assets/AssetDetails";

import ServiceContracts from "./pages/services/ServiceContracts";
import ServiceContractDetails from "./pages/services/ServiceContractDetails";
import PreventiveMaintenance from "./pages/services/PreventiveMaintenance";
import ServiceTickets from "./pages/services/ServiceTickets";
import KnowledgeBase from "./pages/services/KnowledgeBase";
import Vendors from "./pages/Vendors";
import PettyCash from "./pages/PettyCash";
import Utilities from "./pages/Utilities";
import Employees from "./pages/staff/Employees";
import Recruitment from "./pages/staff/Recruitment";
import EmployeeFeedback from "./pages/staff/EmployeeFeedback";
import Attendance from "./pages/staff/Attendance";
import LeaveManagement from "./pages/staff/LeaveManagement";
import Regularization from "./pages/staff/Regularization";
import LeaveBalances from "./pages/staff/LeaveBalances";
import Holidays from "./pages/staff/Holidays";
import WorkingDays from "./pages/staff/WorkingDays";
import AttendancePolicy from "./pages/staff/AttendancePolicy";
import SecurityDashboard from "./pages/security/SecurityDashboard";
import SecurityGuards from "./pages/security/SecurityGuards";
import SecurityRoster from "./pages/security/SecurityRoster";
import PatrolPoints from "./pages/security/PatrolPoints";
import PatrolScan from "./pages/security/PatrolScan";
import GuardFeedback from "./pages/security/GuardFeedback";
import Gamification from "./pages/security/Gamification";
import Footfall from "./pages/Footfall";
import MeterMaster from "./pages/master/MeterMaster";
import DepartmentMaster from "./pages/master/DepartmentMaster";
import PositionMaster from "./pages/master/PositionMaster";
import CategoryMaster from "./pages/master/CategoryMaster";
import AssetDefinitionMaster from "./pages/master/AssetDefinitionMaster";

import NSOChecklistMaster from "./pages/master/NSOChecklistMaster";
import PMChecklistMaster from "./pages/master/PMChecklistMaster";
import StoreBudgetMaster from "./pages/master/StoreBudgetMaster";
import SqFtBudgetMaster from "./pages/master/SqFtBudgetMaster";
import StoreBudgets from "./pages/stores/StoreBudgets";
import StoreBudgetDetails from "./pages/stores/StoreBudgetDetails";
import StoreBudgetDashboard from "./pages/stores/StoreBudgetDashboard";
import Planograms from "./pages/vm/Planograms";
import ComplianceTasks from "./pages/vm/ComplianceTasks";
import ReviewSubmissions from "./pages/vm/ReviewSubmissions";
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
import PointOfSale from "./pages/pos/PointOfSale";
import OrderHistory from "./pages/pos/OrderHistory";
import Schemes from "./pages/pos/Schemes";
import ProductMaster from "./pages/pos/ProductMaster";
import POSDashboard from "./pages/pos/POSDashboard";
import ReturnsProcessing from "./pages/pos/ReturnsProcessing";
import CashierSessions from "./pages/pos/CashierSessions";
import Users from "./pages/admin/Users";
import UserRoles from "./pages/admin/UserRoles";
import UserHierarchy from "./pages/admin/UserHierarchy";
import RolePermissions from "./pages/admin/RolePermissions";
import Profile from "./pages/admin/Profile";
import Settings from "./pages/admin/Settings";
import NotFound from "./pages/NotFound";
import VendorContractView from "./pages/vendor/VendorContractView";
import AssetManagementDashboard from "./pages/dashboards/AssetManagementDashboard";
import InventoryDashboard from "./pages/dashboards/InventoryDashboard";
import EmployeesDashboard from "./pages/dashboards/EmployeesDashboard";
import AssetServiceDashboard from "./pages/dashboards/AssetServiceDashboard";
import Store360Dashboard from "./pages/dashboards/Store360Dashboard";
import VMDashboard from "./pages/dashboards/VMDashboard";
import NSODashboard from "./pages/dashboards/NSODashboard";
import AIInsights from "./pages/AIInsights";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PWAInstallPrompt />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/install" element={<Install />} />
            <Route path="/vendor/contract/:token" element={<VendorContractView />} />
            
            {/* Protected routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboards/assets" element={<AssetManagementDashboard />} />
              <Route path="/dashboards/inventory" element={<InventoryDashboard />} />
              <Route path="/dashboards/employees" element={<EmployeesDashboard />} />
              <Route path="/dashboards/service" element={<AssetServiceDashboard />} />
              <Route path="/dashboards/store360" element={<Store360Dashboard />} />
              <Route path="/dashboards/vm" element={<VMDashboard />} />
              <Route path="/dashboards/nso" element={<NSODashboard />} />
              <Route path="/ai-insights" element={<AIInsights />} />
              <Route path="/pos" element={<PointOfSale />} />
              <Route path="/pos/dashboard" element={<POSDashboard />} />
              <Route path="/pos/products" element={<ProductMaster />} />
              <Route path="/pos/orders" element={<OrderHistory />} />
              <Route path="/pos/returns" element={<ReturnsProcessing />} />
              <Route path="/pos/schemes" element={<Schemes />} />
              <Route path="/pos/sessions" element={<CashierSessions />} />
              <Route path="/stores" element={<StoresList />} />
              <Route path="/stores/:id" element={<StoreDetails />} />
              <Route path="/stores/rentals" element={<Rentals />} />
              <Route path="/stores/targets" element={<StoreTargets />} />
              <Route path="/stores/targets/dashboard" element={<StoreTargetDashboard />} />
              <Route path="/stores/targets/:id" element={<StoreTargetDetails />} />
              <Route path="/stores/targets/:id/details" element={<StoreTargetDetails />} />
              <Route path="/stores/budget" element={<StoreBudgets />} />
              <Route path="/stores/budget/dashboard" element={<StoreBudgetDashboard />} />
              <Route path="/stores/budget/:id" element={<StoreBudgetDetails />} />
              <Route path="/stores/new-opening" element={<NewStoreOpening />} />
              <Route path="/stores/new-opening/:id" element={<NSOChecklistDetails />} />
              <Route path="/assets/master" element={<AssetMaster />} />
              <Route path="/assets/master/:id" element={<AssetMasterDetails />} />
              <Route path="/assets/inventory" element={<AssetInventory />} />
              <Route path="/assets/inventory/:id" element={<AssetDetails />} />
              <Route path="/expansion/plans" element={<StorePlans />} />
              <Route path="/expansion/plans/:id" element={<StorePlanDetails />} />
              <Route path="/expansion/franchisees" element={<Franchisees />} />
              <Route path="/expansion/franchisees/:id" element={<FranchiseeDetails />} />
              
              <Route path="/services/contracts" element={<ServiceContracts />} />
              <Route path="/services/contracts/:id" element={<ServiceContractDetails />} />
              <Route path="/services/maintenance" element={<PreventiveMaintenance />} />
              <Route path="/services/tickets" element={<ServiceTickets />} />
              <Route path="/services/knowledge-base" element={<KnowledgeBase />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/petty-cash" element={<PettyCash />} />
              <Route path="/utilities" element={<Utilities />} />
              <Route path="/staff/employees" element={<Employees />} />
              <Route path="/staff/recruitment" element={<Recruitment />} />
              <Route path="/staff/feedback" element={<EmployeeFeedback />} />
              <Route path="/staff/attendance" element={<Attendance />} />
              <Route path="/staff/leave" element={<LeaveManagement />} />
              <Route path="/staff/regularization" element={<Regularization />} />
              <Route path="/staff/leave-balances" element={<LeaveBalances />} />
              <Route path="/staff/holidays" element={<Holidays />} />
              <Route path="/staff/working-days" element={<WorkingDays />} />
              <Route path="/staff/policy" element={<AttendancePolicy />} />
              <Route path="/security" element={<SecurityDashboard />} />
              <Route path="/security/guards" element={<SecurityGuards />} />
              <Route path="/security/roster" element={<SecurityRoster />} />
              <Route path="/security/patrol-points" element={<PatrolPoints />} />
              <Route path="/security/scan" element={<PatrolScan />} />
              <Route path="/security/feedback" element={<GuardFeedback />} />
              <Route path="/security/gamification" element={<Gamification />} />
              <Route path="/footfall" element={<Footfall />} />
              <Route path="/master/meter" element={<MeterMaster />} />
              <Route path="/master/department" element={<DepartmentMaster />} />
              <Route path="/master/position" element={<PositionMaster />} />
              <Route path="/master/category" element={<CategoryMaster />} />
              <Route path="/master/asset-definition" element={<AssetDefinitionMaster />} />
              
              <Route path="/master/nso-checklist" element={<NSOChecklistMaster />} />
              <Route path="/master/pm-checklist" element={<PMChecklistMaster />} />
              <Route path="/master/store-budget" element={<StoreBudgetMaster />} />
              <Route path="/master/sqft-budget" element={<SqFtBudgetMaster />} />
              <Route path="/vm/planograms" element={<Planograms />} />
              <Route path="/vm/tasks" element={<ComplianceTasks />} />
              <Route path="/vm/review" element={<ReviewSubmissions />} />
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
              <Route path="/admin/users" element={<Users />} />
              <Route path="/admin/roles" element={<UserRoles />} />
              <Route path="/admin/hierarchy" element={<UserHierarchy />} />
              <Route path="/admin/permissions" element={<RolePermissions />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
