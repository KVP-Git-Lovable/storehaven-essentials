import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { PWAInstallPrompt } from "./components/pwa/PWAInstallPrompt";
import { PageLoader } from "./components/shared/PageLoader";

// Eager imports for primary entry points
const LandingPage = lazy(() => import("./pages/landing/LandingPage"));
import Login from "./pages/auth/Login";

// Lazy imports for all other pages
const Install = lazy(() => import("./pages/Install"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const StoresList = lazy(() => import("./pages/stores/StoresList"));
const StoreDetails = lazy(() => import("./pages/stores/StoreDetails"));
const Rentals = lazy(() => import("./pages/stores/Rentals"));
const NewStoreOpening = lazy(() => import("./pages/stores/NewStoreOpening"));
const NSOChecklistDetails = lazy(() => import("./pages/stores/NSOChecklistDetails"));
const StorePlans = lazy(() => import("./pages/stores/StorePlans"));
const StorePlanDetails = lazy(() => import("./pages/stores/StorePlanDetails"));
const Franchisees = lazy(() => import("./pages/stores/Franchisees"));
const FranchiseeDetails = lazy(() => import("./pages/stores/FranchiseeDetails"));
const StoreTargets = lazy(() => import("./pages/stores/StoreTargets"));
const StoreTargetDetails = lazy(() => import("./pages/stores/StoreTargetDetails"));
const StoreTargetDashboard = lazy(() => import("./pages/stores/StoreTargetDashboard"));
const AssetMaster = lazy(() => import("./pages/assets/AssetMaster"));
const AssetMasterDetails = lazy(() => import("./pages/assets/AssetMasterDetails"));
const AssetInventory = lazy(() => import("./pages/assets/AssetInventory"));
const AssetDetails = lazy(() => import("./pages/assets/AssetDetails"));
const ServiceContracts = lazy(() => import("./pages/services/ServiceContracts"));
const ServiceContractDetails = lazy(() => import("./pages/services/ServiceContractDetails"));
const PreventiveMaintenance = lazy(() => import("./pages/services/PreventiveMaintenance"));
const ServiceTickets = lazy(() => import("./pages/services/ServiceTickets"));
const KnowledgeBase = lazy(() => import("./pages/services/KnowledgeBase"));
const Vendors = lazy(() => import("./pages/Vendors"));
const PettyCash = lazy(() => import("./pages/PettyCash"));
const Utilities = lazy(() => import("./pages/Utilities"));
const Employees = lazy(() => import("./pages/staff/Employees"));
const EmployeeDetailsPage = lazy(() => import("./pages/staff/EmployeeDetails"));
const Recruitment = lazy(() => import("./pages/staff/Recruitment"));
const RequisitionDetails = lazy(() => import("./pages/staff/RequisitionDetails"));
const EmployeeFeedback = lazy(() => import("./pages/staff/EmployeeFeedback"));
const PerformanceReviews = lazy(() => import("./pages/staff/PerformanceReviews"));
const PerformanceManagement = lazy(() => import("./pages/staff/PerformanceManagement"));
const TrainingPrograms = lazy(() => import("./pages/staff/TrainingPrograms"));
const LearningManagement = lazy(() => import("./pages/staff/LearningManagement"));
const EmployeeOffboarding = lazy(() => import("./pages/staff/EmployeeOffboarding"));
const Attendance = lazy(() => import("./pages/staff/Attendance"));
const LeaveManagement = lazy(() => import("./pages/staff/LeaveManagement"));
const Regularization = lazy(() => import("./pages/staff/Regularization"));
const LeaveBalances = lazy(() => import("./pages/staff/LeaveBalances"));
const Holidays = lazy(() => import("./pages/staff/Holidays"));
const WorkingDays = lazy(() => import("./pages/staff/WorkingDays"));
const AttendancePolicy = lazy(() => import("./pages/staff/AttendancePolicy"));
const SecurityDashboard = lazy(() => import("./pages/security/SecurityDashboard"));
const SecurityGuards = lazy(() => import("./pages/security/SecurityGuards"));
const SecurityRoster = lazy(() => import("./pages/security/SecurityRoster"));
const PatrolPoints = lazy(() => import("./pages/security/PatrolPoints"));
const PatrolScan = lazy(() => import("./pages/security/PatrolScan"));
const GuardFeedback = lazy(() => import("./pages/security/GuardFeedback"));
const Gamification = lazy(() => import("./pages/security/Gamification"));
const Footfall = lazy(() => import("./pages/Footfall"));
const MeterMaster = lazy(() => import("./pages/master/MeterMaster"));
const DepartmentMaster = lazy(() => import("./pages/master/DepartmentMaster"));
const PositionMaster = lazy(() => import("./pages/master/PositionMaster"));
const CategoryMaster = lazy(() => import("./pages/master/CategoryMaster"));
const AssetDefinitionMaster = lazy(() => import("./pages/master/AssetDefinitionMaster"));
const NSOChecklistMaster = lazy(() => import("./pages/master/NSOChecklistMaster"));
const PMChecklistMaster = lazy(() => import("./pages/master/PMChecklistMaster"));
const StoreBudgetMaster = lazy(() => import("./pages/master/StoreBudgetMaster"));
const SqFtBudgetMaster = lazy(() => import("./pages/master/SqFtBudgetMaster"));
const StoreBudgets = lazy(() => import("./pages/stores/StoreBudgets"));
const StoreBudgetDetails = lazy(() => import("./pages/stores/StoreBudgetDetails"));
const StoreBudgetDashboard = lazy(() => import("./pages/stores/StoreBudgetDashboard"));
const Planograms = lazy(() => import("./pages/vm/Planograms"));
const ComplianceTasks = lazy(() => import("./pages/vm/ComplianceTasks"));
const ReviewSubmissions = lazy(() => import("./pages/vm/ReviewSubmissions"));
const InventoryItems = lazy(() => import("./pages/inventory/InventoryItems"));
const Requisitions = lazy(() => import("./pages/inventory/Requisitions"));
const ShipmentTracking = lazy(() => import("./pages/inventory/ShipmentTracking"));
const GoodsReceipt = lazy(() => import("./pages/inventory/GoodsReceipt"));
const StockAudit = lazy(() => import("./pages/inventory/StockAudit"));
const ConsumptionLog = lazy(() => import("./pages/inventory/ConsumptionLog"));
const ExpiryManagement = lazy(() => import("./pages/inventory/ExpiryManagement"));
const ReturnToVendor = lazy(() => import("./pages/inventory/ReturnToVendor"));
const StoreTransfers = lazy(() => import("./pages/inventory/StoreTransfers"));
const LowStockAlerts = lazy(() => import("./pages/inventory/LowStockAlerts"));
const TaskMaster = lazy(() => import("./pages/operations/TaskMaster"));
const RoleMaster = lazy(() => import("./pages/operations/RoleMaster"));
const TaskTemplates = lazy(() => import("./pages/operations/TaskTemplates"));
const TaskAdherence = lazy(() => import("./pages/operations/TaskAdherence"));
const StoreHeatmap = lazy(() => import("./pages/operations/StoreHeatmap"));
const PointOfSale = lazy(() => import("./pages/pos/PointOfSale"));
const OrderHistory = lazy(() => import("./pages/pos/OrderHistory"));
const Schemes = lazy(() => import("./pages/pos/Schemes"));
const ProductMaster = lazy(() => import("./pages/pos/ProductMaster"));
const POSDashboard = lazy(() => import("./pages/pos/POSDashboard"));
const ReturnsProcessing = lazy(() => import("./pages/pos/ReturnsProcessing"));
const CashierSessions = lazy(() => import("./pages/pos/CashierSessions"));
const Users = lazy(() => import("./pages/admin/Users"));
const UserRoles = lazy(() => import("./pages/admin/UserRoles"));
const UserHierarchy = lazy(() => import("./pages/admin/UserHierarchy"));
const RolePermissions = lazy(() => import("./pages/admin/RolePermissions"));
const Profile = lazy(() => import("./pages/admin/Profile"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const CompanyInformation = lazy(() => import("./pages/admin/CompanyInformation"));
const NotFound = lazy(() => import("./pages/NotFound"));
const VendorContractView = lazy(() => import("./pages/vendor/VendorContractView"));
const AssetManagementDashboard = lazy(() => import("./pages/dashboards/AssetManagementDashboard"));
const InventoryDashboard = lazy(() => import("./pages/dashboards/InventoryDashboard"));
const EmployeesDashboard = lazy(() => import("./pages/dashboards/EmployeesDashboard"));
const AssetServiceDashboard = lazy(() => import("./pages/dashboards/AssetServiceDashboard"));
const Store360Dashboard = lazy(() => import("./pages/dashboards/Store360Dashboard"));
const VMDashboard = lazy(() => import("./pages/dashboards/VMDashboard"));
const NSODashboard = lazy(() => import("./pages/dashboards/NSODashboard"));
const AIInsights = lazy(() => import("./pages/AIInsights"));
const IncidentManagement = lazy(() => import("./pages/services/IncidentManagement"));
const PhotoSubmission = lazy(() => import("./pages/vm/PhotoSubmission"));
const WhatsAppTemplates = lazy(() => import("./pages/communication/WhatsAppTemplates"));
const WhatsAppTemplateDetails = lazy(() => import("./pages/communication/WhatsAppTemplateDetails"));
const MessageLog = lazy(() => import("./pages/communication/MessageLog"));
const JourneyList = lazy(() => import("./pages/communication/JourneyList"));
const CommunicationCalendar = lazy(() => import("./pages/communication/CommunicationCalendar"));
const JourneyBuilder = lazy(() => import("./pages/communication/JourneyBuilder"));
const JourneyAnalytics = lazy(() => import("./pages/communication/JourneyAnalytics"));
const ContactsManager = lazy(() => import("./pages/communication/ContactsManager"));
const WhatsAppCenter = lazy(() => import("./pages/communication/WhatsAppCenter"));
const WhatsAppConversations = lazy(() => import("./pages/communication/WhatsAppConversations"));
const WhatsAppConfig = lazy(() => import("./pages/communication/WhatsAppConfig"));
const VoiceCenter = lazy(() => import("./pages/communication/VoiceCenter"));
const EmailCenter = lazy(() => import("./pages/communication/EmailCenter"));
const ListViewsList = lazy(() => import("./pages/listviews/ListViewsList"));
const ListViewBuilder = lazy(() => import("./pages/listviews/ListViewBuilder"));
const TxnLeadsList = lazy(() => import("./pages/transactions/LeadsList"));
const TxnCustomersList = lazy(() => import("./pages/transactions/CustomersList"));
const TxnProductsList = lazy(() => import("./pages/transactions/ProductsList"));
const TxnOrdersList = lazy(() => import("./pages/transactions/OrdersList"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PWAInstallPrompt />
          <Suspense fallback={<PageLoader />}>
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
                <Route path="/services/incidents" element={<IncidentManagement />} />
                <Route path="/services/knowledge-base" element={<KnowledgeBase />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route path="/petty-cash" element={<PettyCash />} />
                <Route path="/utilities" element={<Utilities />} />
                <Route path="/staff/employees" element={<Employees />} />
                <Route path="/staff/employees/:id" element={<EmployeeDetailsPage />} />
                <Route path="/staff/recruitment" element={<Recruitment />} />
                <Route path="/staff/recruitment/:id" element={<RequisitionDetails />} />
                <Route path="/staff/performance" element={<PerformanceManagement />} />
                <Route path="/staff/performance-reviews" element={<PerformanceReviews />} />
                <Route path="/staff/training" element={<TrainingPrograms />} />
                <Route path="/staff/lms" element={<LearningManagement />} />
                <Route path="/staff/feedback" element={<EmployeeFeedback />} />
                <Route path="/staff/offboarding" element={<EmployeeOffboarding />} />
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
                <Route path="/communication/templates" element={<WhatsAppTemplates />} />
                <Route path="/communication/templates/:id" element={<WhatsAppTemplateDetails />} />
                <Route path="/communication/messages" element={<MessageLog />} />
                <Route path="/communication/journeys" element={<JourneyList />} />
                <Route path="/communication/journeys/:id" element={<JourneyBuilder />} />
                <Route path="/communication/journeys/:id/analytics" element={<JourneyAnalytics />} />
                <Route path="/communication/calendar" element={<CommunicationCalendar />} />
                <Route path="/communication/contacts" element={<ContactsManager />} />
                <Route path="/communication/whatsapp" element={<WhatsAppCenter />} />
                <Route path="/communication/whatsapp/conversations" element={<WhatsAppConversations />} />
                <Route path="/communication/whatsapp/config" element={<WhatsAppConfig />} />
                <Route path="/communication/voice" element={<VoiceCenter />} />
                <Route path="/communication/email" element={<EmailCenter />} />
                <Route path="/list-views" element={<ListViewsList />} />
                <Route path="/list-views/:id" element={<ListViewBuilder />} />
                <Route path="/transactions/leads" element={<TxnLeadsList />} />
                <Route path="/transactions/customers" element={<TxnCustomersList />} />
                <Route path="/transactions/products" element={<TxnProductsList />} />
                <Route path="/transactions/orders" element={<TxnOrdersList />} />
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
                <Route path="/vm/photos" element={<PhotoSubmission />} />
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
                <Route path="/admin/company" element={<CompanyInformation />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
