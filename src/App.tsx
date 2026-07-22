import { Suspense } from "react";
import { lazyWithRetry } from "./lib/lazyRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./components/auth/AuthProvider";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { PWAInstallPrompt } from "./components/pwa/PWAInstallPrompt";
import { PageLoader } from "./components/shared/PageLoader";

// Eager imports for primary entry points
const LandingPage = lazyWithRetry(() => import("./pages/landing/LandingPage"), "LandingPage");
import Login from "./pages/auth/Login";

// Lazy imports for all other pages
const Install = lazyWithRetry(() => import("./pages/Install"), "Install");
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "Dashboard");
const StoresList = lazyWithRetry(() => import("./pages/stores/StoresList"), "StoresList");
const StoreDetails = lazyWithRetry(() => import("./pages/stores/StoreDetails"), "StoreDetails");
const Rentals = lazyWithRetry(() => import("./pages/stores/Rentals"), "Rentals");
const NewStoreOpening = lazyWithRetry(() => import("./pages/stores/NewStoreOpening"), "NewStoreOpening");
const NSOChecklistDetails = lazyWithRetry(() => import("./pages/stores/NSOChecklistDetails"), "NSOChecklistDetails");
const StorePlans = lazyWithRetry(() => import("./pages/stores/StorePlans"), "StorePlans");
const StorePlanDetails = lazyWithRetry(() => import("./pages/stores/StorePlanDetails"), "StorePlanDetails");
const Franchisees = lazyWithRetry(() => import("./pages/stores/Franchisees"), "Franchisees");
const FranchiseeDetails = lazyWithRetry(() => import("./pages/stores/FranchiseeDetails"), "FranchiseeDetails");
const StoreTargets = lazyWithRetry(() => import("./pages/stores/StoreTargets"), "StoreTargets");
const StoreTargetDetails = lazyWithRetry(() => import("./pages/stores/StoreTargetDetails"), "StoreTargetDetails");
const StoreTargetDashboard = lazyWithRetry(() => import("./pages/stores/StoreTargetDashboard"), "StoreTargetDashboard");
const AssetMaster = lazyWithRetry(() => import("./pages/assets/AssetMaster"), "AssetMaster");
const AssetMasterDetails = lazyWithRetry(() => import("./pages/assets/AssetMasterDetails"), "AssetMasterDetails");
const AssetInventory = lazyWithRetry(() => import("./pages/assets/AssetInventory"), "AssetInventory");
const AssetDetails = lazyWithRetry(() => import("./pages/assets/AssetDetails"), "AssetDetails");
const ServiceContracts = lazyWithRetry(() => import("./pages/services/ServiceContracts"), "ServiceContracts");
const ServiceContractDetails = lazyWithRetry(() => import("./pages/services/ServiceContractDetails"), "ServiceContractDetails");
const PreventiveMaintenance = lazyWithRetry(() => import("./pages/services/PreventiveMaintenance"), "PreventiveMaintenance");
const ServiceTickets = lazyWithRetry(() => import("./pages/services/ServiceTickets"), "ServiceTickets");
const KnowledgeBase = lazyWithRetry(() => import("./pages/services/KnowledgeBase"), "KnowledgeBase");
const Vendors = lazyWithRetry(() => import("./pages/Vendors"), "Vendors");
const PettyCash = lazyWithRetry(() => import("./pages/PettyCash"), "PettyCash");
const Utilities = lazyWithRetry(() => import("./pages/Utilities"), "Utilities");
const Employees = lazyWithRetry(() => import("./pages/staff/Employees"), "Employees");
const EmployeeDetailsPage = lazyWithRetry(() => import("./pages/staff/EmployeeDetails"), "EmployeeDetailsPage");
const Recruitment = lazyWithRetry(() => import("./pages/staff/Recruitment"), "Recruitment");
const RequisitionDetails = lazyWithRetry(() => import("./pages/staff/RequisitionDetails"), "RequisitionDetails");
const EmployeeFeedback = lazyWithRetry(() => import("./pages/staff/EmployeeFeedback"), "EmployeeFeedback");
const PerformanceReviews = lazyWithRetry(() => import("./pages/staff/PerformanceReviews"), "PerformanceReviews");
const PerformanceManagement = lazyWithRetry(() => import("./pages/staff/PerformanceManagement"), "PerformanceManagement");
const TrainingPrograms = lazyWithRetry(() => import("./pages/staff/TrainingPrograms"), "TrainingPrograms");
const LearningManagement = lazyWithRetry(() => import("./pages/staff/LearningManagement"), "LearningManagement");
const EmployeeOffboarding = lazyWithRetry(() => import("./pages/staff/EmployeeOffboarding"), "EmployeeOffboarding");
const Attendance = lazyWithRetry(() => import("./pages/staff/Attendance"), "Attendance");
const LeaveManagement = lazyWithRetry(() => import("./pages/staff/LeaveManagement"), "LeaveManagement");
const Regularization = lazyWithRetry(() => import("./pages/staff/Regularization"), "Regularization");
const LeaveBalances = lazyWithRetry(() => import("./pages/staff/LeaveBalances"), "LeaveBalances");
const Holidays = lazyWithRetry(() => import("./pages/staff/Holidays"), "Holidays");
const WorkingDays = lazyWithRetry(() => import("./pages/staff/WorkingDays"), "WorkingDays");
const AttendancePolicy = lazyWithRetry(() => import("./pages/staff/AttendancePolicy"), "AttendancePolicy");
const SecurityDashboard = lazyWithRetry(() => import("./pages/security/SecurityDashboard"), "SecurityDashboard");
const SecurityGuards = lazyWithRetry(() => import("./pages/security/SecurityGuards"), "SecurityGuards");
const SecurityRoster = lazyWithRetry(() => import("./pages/security/SecurityRoster"), "SecurityRoster");
const PatrolPoints = lazyWithRetry(() => import("./pages/security/PatrolPoints"), "PatrolPoints");
const PatrolScan = lazyWithRetry(() => import("./pages/security/PatrolScan"), "PatrolScan");
const GuardFeedback = lazyWithRetry(() => import("./pages/security/GuardFeedback"), "GuardFeedback");
const Gamification = lazyWithRetry(() => import("./pages/security/Gamification"), "Gamification");
const Footfall = lazyWithRetry(() => import("./pages/Footfall"), "Footfall");
const MeterMaster = lazyWithRetry(() => import("./pages/master/MeterMaster"), "MeterMaster");
const DepartmentMaster = lazyWithRetry(() => import("./pages/master/DepartmentMaster"), "DepartmentMaster");
const PositionMaster = lazyWithRetry(() => import("./pages/master/PositionMaster"), "PositionMaster");
const CategoryMaster = lazyWithRetry(() => import("./pages/master/CategoryMaster"), "CategoryMaster");
const AssetDefinitionMaster = lazyWithRetry(() => import("./pages/master/AssetDefinitionMaster"), "AssetDefinitionMaster");
const NSOChecklistMaster = lazyWithRetry(() => import("./pages/master/NSOChecklistMaster"), "NSOChecklistMaster");
const PMChecklistMaster = lazyWithRetry(() => import("./pages/master/PMChecklistMaster"), "PMChecklistMaster");
const StoreBudgetMaster = lazyWithRetry(() => import("./pages/master/StoreBudgetMaster"), "StoreBudgetMaster");
const SqFtBudgetMaster = lazyWithRetry(() => import("./pages/master/SqFtBudgetMaster"), "SqFtBudgetMaster");
const StoreBudgets = lazyWithRetry(() => import("./pages/stores/StoreBudgets"), "StoreBudgets");
const StoreBudgetDetails = lazyWithRetry(() => import("./pages/stores/StoreBudgetDetails"), "StoreBudgetDetails");
const StoreBudgetDashboard = lazyWithRetry(() => import("./pages/stores/StoreBudgetDashboard"), "StoreBudgetDashboard");
const Planograms = lazyWithRetry(() => import("./pages/vm/Planograms"), "Planograms");
const ComplianceTasks = lazyWithRetry(() => import("./pages/vm/ComplianceTasks"), "ComplianceTasks");
const ReviewSubmissions = lazyWithRetry(() => import("./pages/vm/ReviewSubmissions"), "ReviewSubmissions");
const InventoryItems = lazyWithRetry(() => import("./pages/inventory/InventoryItems"), "InventoryItems");
const PriceConfiguration = lazyWithRetry(() => import("./pages/inventory/PriceConfiguration"), "PriceConfiguration");
const Requisitions = lazyWithRetry(() => import("./pages/inventory/Requisitions"), "Requisitions");
const ShipmentTracking = lazyWithRetry(() => import("./pages/inventory/ShipmentTracking"), "ShipmentTracking");
const GoodsReceipt = lazyWithRetry(() => import("./pages/inventory/GoodsReceipt"), "GoodsReceipt");
const StockAudit = lazyWithRetry(() => import("./pages/inventory/StockAudit"), "StockAudit");
const ConsumptionLog = lazyWithRetry(() => import("./pages/inventory/ConsumptionLog"), "ConsumptionLog");
const ExpiryManagement = lazyWithRetry(() => import("./pages/inventory/ExpiryManagement"), "ExpiryManagement");
const ReturnToVendor = lazyWithRetry(() => import("./pages/inventory/ReturnToVendor"), "ReturnToVendor");
const StoreTransfers = lazyWithRetry(() => import("./pages/inventory/StoreTransfers"), "StoreTransfers");
const LowStockAlerts = lazyWithRetry(() => import("./pages/inventory/LowStockAlerts"), "LowStockAlerts");
const TaskMaster = lazyWithRetry(() => import("./pages/operations/TaskMaster"), "TaskMaster");
const RoleMaster = lazyWithRetry(() => import("./pages/operations/RoleMaster"), "RoleMaster");
const TaskTemplates = lazyWithRetry(() => import("./pages/operations/TaskTemplates"), "TaskTemplates");
const TaskAdherence = lazyWithRetry(() => import("./pages/operations/TaskAdherence"), "TaskAdherence");
const StoreHeatmap = lazyWithRetry(() => import("./pages/operations/StoreHeatmap"), "StoreHeatmap");
const PointOfSale = lazyWithRetry(() => import("./pages/pos/PointOfSale"), "PointOfSale");
const OrderHistory = lazyWithRetry(() => import("./pages/pos/OrderHistory"), "OrderHistory");
const Schemes = lazyWithRetry(() => import("./pages/pos/Schemes"), "Schemes");
const ProductMaster = lazyWithRetry(() => import("./pages/pos/ProductMaster"), "ProductMaster");
const POSDashboard = lazyWithRetry(() => import("./pages/pos/POSDashboard"), "POSDashboard");
const ReturnsProcessing = lazyWithRetry(() => import("./pages/pos/ReturnsProcessing"), "ReturnsProcessing");
const CashierSessions = lazyWithRetry(() => import("./pages/pos/CashierSessions"), "CashierSessions");
const Users = lazyWithRetry(() => import("./pages/admin/Users"), "Users");
const UserRoles = lazyWithRetry(() => import("./pages/admin/UserRoles"), "UserRoles");
const UserHierarchy = lazyWithRetry(() => import("./pages/admin/UserHierarchy"), "UserHierarchy");
const RolePermissions = lazyWithRetry(() => import("./pages/admin/RolePermissions"), "RolePermissions");
const Profile = lazyWithRetry(() => import("./pages/admin/Profile"), "Profile");
const Settings = lazyWithRetry(() => import("./pages/admin/Settings"), "Settings");
const CompanyInformation = lazyWithRetry(() => import("./pages/admin/CompanyInformation"), "CompanyInformation");
const InvoiceTemplatePage = lazyWithRetry(() => import("./pages/admin/InvoiceTemplate"), "InvoiceTemplate");
const WhatsAppPricing = lazyWithRetry(() => import("./pages/admin/WhatsAppPricing"), "WhatsAppPricing");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "NotFound");
const VendorContractView = lazyWithRetry(() => import("./pages/vendor/VendorContractView"), "VendorContractView");
const UnsubscribePage = lazyWithRetry(() => import("./pages/UnsubscribePage"), "UnsubscribePage");
const AssetManagementDashboard = lazyWithRetry(() => import("./pages/dashboards/AssetManagementDashboard"), "AssetManagementDashboard");
const InventoryDashboard = lazyWithRetry(() => import("./pages/dashboards/InventoryDashboard"), "InventoryDashboard");
const EmployeesDashboard = lazyWithRetry(() => import("./pages/dashboards/EmployeesDashboard"), "EmployeesDashboard");
const AssetServiceDashboard = lazyWithRetry(() => import("./pages/dashboards/AssetServiceDashboard"), "AssetServiceDashboard");
const Store360Dashboard = lazyWithRetry(() => import("./pages/dashboards/Store360Dashboard"), "Store360Dashboard");
const VMDashboard = lazyWithRetry(() => import("./pages/dashboards/VMDashboard"), "VMDashboard");
const NSODashboard = lazyWithRetry(() => import("./pages/dashboards/NSODashboard"), "NSODashboard");
const AIInsights = lazyWithRetry(() => import("./pages/AIInsights"), "AIInsights");
const IncidentManagement = lazyWithRetry(() => import("./pages/services/IncidentManagement"), "IncidentManagement");
const PhotoSubmission = lazyWithRetry(() => import("./pages/vm/PhotoSubmission"), "PhotoSubmission");
const WhatsAppTemplates = lazyWithRetry(() => import("./pages/communication/WhatsAppTemplates"), "WhatsAppTemplates");
const WhatsAppTemplateDetails = lazyWithRetry(() => import("./pages/communication/WhatsAppTemplateDetails"), "WhatsAppTemplateDetails");
const MessageLog = lazyWithRetry(() => import("./pages/communication/MessageLog"), "MessageLog");
const JourneyList = lazyWithRetry(() => import("./pages/communication/JourneyList"), "JourneyList");
const CommunicationCalendar = lazyWithRetry(() => import("./pages/communication/CommunicationCalendar"), "CommunicationCalendar");
const JourneyBuilder = lazyWithRetry(() => import("./pages/communication/JourneyBuilder"), "JourneyBuilder");
const JourneyAnalytics = lazyWithRetry(() => import("./pages/communication/JourneyAnalytics"), "JourneyAnalytics");
const JourneyConversations = lazyWithRetry(() => import("./pages/communication/JourneyConversations"), "JourneyConversations");
const JourneyRateLimitedFailures = lazyWithRetry(() => import("./pages/communication/JourneyRateLimitedFailures"), "JourneyRateLimitedFailures");
const JourneyStatusCodeFailures = lazyWithRetry(() => import("./pages/communication/JourneyStatusCodeFailures"), "JourneyStatusCodeFailures");
const ContactsManager = lazyWithRetry(() => import("./pages/communication/ContactsManager"), "ContactsManager");
const WhatsAppCenter = lazyWithRetry(() => import("./pages/communication/WhatsAppCenter"), "WhatsAppCenter");
const WhatsAppConversations = lazyWithRetry(() => import("./pages/communication/WhatsAppConversations"), "WhatsAppConversations");
const WhatsAppConfig = lazyWithRetry(() => import("./pages/communication/WhatsAppConfig"), "WhatsAppConfig");
const VoiceCenter = lazyWithRetry(() => import("./pages/communication/VoiceCenter"), "VoiceCenter");
const EmailCenter = lazyWithRetry(() => import("./pages/communication/EmailCenter"), "EmailCenter");
const ListViewsList = lazyWithRetry(() => import("./pages/listviews/ListViewsList"), "ListViewsList");
const ListViewBuilder = lazyWithRetry(() => import("./pages/listviews/ListViewBuilder"), "ListViewBuilder");
const TxnLeadsList = lazyWithRetry(() => import("./pages/transactions/LeadsList"), "TxnLeadsList");
const TxnCustomersList = lazyWithRetry(() => import("./pages/transactions/CustomersList"), "TxnCustomersList");
const TxnProductsList = lazyWithRetry(() => import("./pages/transactions/ProductsList"), "TxnProductsList");
const TxnOrdersList = lazyWithRetry(() => import("./pages/transactions/OrdersList"), "TxnOrdersList");
const TxnReports = lazyWithRetry(() => import("./pages/transactions/Reports"), "TxnReports");

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <PWAInstallPrompt />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/install" element={<Install />} />
              <Route path="/vendor/contract/:token" element={<VendorContractView />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />
              
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
                <Route path="/communication/journeys/:id/conversations" element={<JourneyConversations />} />
                <Route path="/communication/journeys/:id/rate-limited-failures" element={<JourneyRateLimitedFailures />} />
                <Route path="/communication/journeys/:id/status-code-failures" element={<JourneyStatusCodeFailures />} />
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
                <Route path="/transactions/reports" element={<TxnReports />} />
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
                <Route path="/inventory/price-configuration" element={<PriceConfiguration />} />
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
                <Route path="/admin/company/invoice-template" element={<InvoiceTemplatePage />} />
                <Route path="/admin/whatsapp-pricing" element={<WhatsAppPricing />} />
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
