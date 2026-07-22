import { useState, useMemo, useEffect, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Package,
  Users,
  ChevronDown,
  Building2,
  X,
  Database,
  Boxes,
  ShoppingCart,
  Brain,
  UserCog,
  BarChart3,
  ShieldCheck,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeft,
  CalendarCheck,
  Wrench,
  Rocket,
  Receipt,
} from "lucide-react";
import trayiLogoAsset from "@/assets/trayi-logo.jpeg.asset.json";
const trayiLogo = trayiLogoAsset.url;
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { useAttendanceRole } from "@/hooks/useAttendanceRole";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavChild {
  title: string;
  href?: string;
  moduleKey?: string;
  isSubSection?: boolean;
  subChildren?: NavChild[];
}

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  moduleKey?: string;
  children?: NavChild[];
  iconColor?: string;
}

const navigation: NavItem[] = [
  { title: "Home", href: "/dashboard", icon: LayoutDashboard, moduleKey: "dashboard", iconColor: "bg-indigo-500/15 text-indigo-400" },
  { title: "AI Insights", href: "/ai-insights", icon: Brain, moduleKey: "dashboard", iconColor: "bg-violet-500/15 text-violet-400" },
  {
    title: "Dashboards",
    icon: BarChart3,
    moduleKey: "dashboards",
    iconColor: "bg-sky-500/15 text-sky-400",
    children: [
      { title: "Asset Management", href: "/dashboards/assets", moduleKey: "dashboards.assets" },
      { title: "Inventory", href: "/dashboards/inventory", moduleKey: "dashboards.inventory" },
      { title: "Employees", href: "/dashboards/employees", moduleKey: "dashboards.employees" },
      { title: "Asset Service", href: "/dashboards/service", moduleKey: "dashboards.service" },
      { title: "Store 360", href: "/dashboards/store360", moduleKey: "dashboards.store360" },
      { title: "Visual Merchandising", href: "/dashboards/vm", moduleKey: "dashboards.vm" },
      { title: "New Store Opening", href: "/dashboards/nso", moduleKey: "dashboards.nso" },
    ],
  },
  {
    title: "Point of Sale",
    icon: ShoppingCart,
    moduleKey: "pos",
    iconColor: "bg-emerald-500/15 text-emerald-400",
    children: [
      { title: "POS Dashboard", href: "/pos/dashboard", moduleKey: "pos.quicksale" },
      { title: "Billing", href: "/pos", moduleKey: "pos.quicksale" },
      { title: "Order History", href: "/pos/orders", moduleKey: "pos.orders" },
      { title: "Returns & Refunds", href: "/pos/returns", moduleKey: "pos.orders" },
      { title: "Schemes", href: "/pos/schemes", moduleKey: "pos.schemes" },
      { title: "Cashier Sessions", href: "/pos/sessions", moduleKey: "pos.quicksale" },
      { title: "Product Master", href: "/pos/products", moduleKey: "pos.products" },
    ],
  },
  {
    title: "Transactions",
    icon: Receipt,
    moduleKey: "transactions",
    iconColor: "bg-amber-500/15 text-amber-400",
    children: [
      { title: "Leads", href: "/transactions/leads", moduleKey: "transactions.leads" },
      { title: "Customers", href: "/transactions/customers", moduleKey: "transactions.customers" },
      { title: "Products", href: "/transactions/products", moduleKey: "transactions.products" },
      { title: "Orders", href: "/transactions/orders", moduleKey: "transactions.orders" },
      { title: "Reports", href: "/transactions/reports", moduleKey: "transactions.orders" },
    ],
  },
  {
    title: "New Store Plan",
    icon: Rocket,
    moduleKey: "expansion",
    iconColor: "bg-rose-500/15 text-rose-400",
    children: [
      { title: "Store Plans", href: "/expansion/plans", moduleKey: "expansion.plans" },
      { title: "New Store Opening", href: "/stores/new-opening", moduleKey: "stores.nso" },
      { title: "Franchisees", href: "/expansion/franchisees", moduleKey: "expansion.franchisees" },
    ],
  },
  {
    title: "Store Management",
    icon: Store,
    moduleKey: "stores",
    iconColor: "bg-teal-500/15 text-teal-300",
    children: [
      { title: "Stores", href: "/stores", moduleKey: "stores.all" },
      { title: "Rentals & Leases", href: "/stores/rentals", moduleKey: "stores.rentals" },
      { title: "Store Targets", href: "/stores/targets", moduleKey: "stores.all" },
      { title: "Store Budget", href: "/stores/budget", moduleKey: "stores.budget" },
      { title: "Petty Cash", href: "/petty-cash", moduleKey: "pettycash" },
      { title: "Footfall", href: "/footfall", moduleKey: "footfall" },
    ],
  },
  {
    title: "Maintenance Tasks",
    icon: Wrench,
    moduleKey: "operations",
    iconColor: "bg-orange-500/15 text-orange-400",
    children: [
      { title: "Store Maintenance Tasks", href: "/operations/adherence", moduleKey: "operations.adherence" },
      { title: "Store Heatmap", href: "/operations/heatmap", moduleKey: "operations.heatmap" },
    ],
  },
  {
    title: "Visual Merch (VM)",
    icon: BarChart3,
    moduleKey: "vm",
    iconColor: "bg-pink-500/15 text-pink-400",
    children: [
      { title: "Planograms", href: "/vm/planograms", moduleKey: "vm.planograms" },
      { title: "Compliance Tasks", href: "/vm/tasks", moduleKey: "vm.tasks" },
      { title: "Compliance Audit", href: "/vm/review", moduleKey: "vm.review" },
    ],
  },
  {
    title: "Assets & Service",
    icon: Package,
    moduleKey: "assets",
    iconColor: "bg-cyan-500/15 text-cyan-400",
    children: [
      { title: "Asset Master", href: "/assets/master", moduleKey: "assets.master" },
      { title: "Asset Register", href: "/assets/inventory", moduleKey: "assets.register" },
      { title: "Service Contracts", href: "/services/contracts", moduleKey: "assets.contracts" },
      { title: "Preventive Maintenance", href: "/services/maintenance", moduleKey: "assets.maintenance" },
      { title: "Service Tickets", href: "/services/tickets", moduleKey: "assets.tickets" },
      { title: "Meter Readings", href: "/utilities", moduleKey: "utilities" },
      { title: "Knowledge Base", href: "/services/knowledge-base", moduleKey: "assets.knowledge" },
    ],
  },
  { title: "Vendors", href: "/vendors", icon: Building2, moduleKey: "vendors", iconColor: "bg-yellow-500/15 text-yellow-400" },
  {
    title: "Employee",
    icon: CalendarCheck,
    moduleKey: "staff",
    iconColor: "bg-fuchsia-500/15 text-fuchsia-400",
    children: [
      { title: "Employees", href: "/staff/employees", moduleKey: "staff.employees" },
      { title: "Recruitment", href: "/staff/recruitment", moduleKey: "staff.recruitment" },
      { title: "Performance", href: "/staff/performance", moduleKey: "staff.performance" },
      { title: "Learning (LMS)", href: "/staff/lms", moduleKey: "staff.lms" },
      { title: "Training Programs", href: "/staff/training", moduleKey: "staff.training" },
      { title: "Employee Feedback", href: "/staff/feedback", moduleKey: "staff.feedback" },
      { title: "Offboarding", href: "/staff/offboarding", moduleKey: "staff.offboarding" },
      { title: "Live Attendance", href: "/staff/attendance", moduleKey: "staff.attendance" },
      { title: "Leave Management", href: "/staff/leave", moduleKey: "staff.leave" },
      { title: "Regularization", href: "/staff/regularization", moduleKey: "staff.regularization" },
      { title: "Leave Balances", href: "/staff/leave-balances", moduleKey: "staff.leave-balances" },
      { title: "Holidays", href: "/staff/holidays", moduleKey: "staff.holidays" },
      { title: "Working Days", href: "/staff/working-days", moduleKey: "staff.working-days" },
      { title: "Attendance Policy", href: "/staff/policy", moduleKey: "staff.policy" },
    ],
  },
  {
    title: "Security",
    icon: ShieldCheck,
    moduleKey: "security",
    iconColor: "bg-red-500/15 text-red-400",
    children: [
      { title: "Dashboard", href: "/security", moduleKey: "security.dashboard" },
      { title: "Guards", href: "/security/guards", moduleKey: "security.guards" },
      { title: "Roster", href: "/security/roster", moduleKey: "security.roster" },
      { title: "Patrol Points", href: "/security/patrol-points", moduleKey: "security.patrol" },
      { title: "Patrol Scan", href: "/security/scan", moduleKey: "security.scan" },
      { title: "Feedback", href: "/security/feedback", moduleKey: "security.feedback" },
      { title: "Gamification", href: "/security/gamification", moduleKey: "security.gamification" },
    ],
  },
  {
    title: "Communication Center",
    icon: MessageSquare,
    moduleKey: "communication",
    iconColor: "bg-lime-500/15 text-lime-400",
    children: [
      { title: "WhatsApp", href: "/communication/whatsapp", moduleKey: "communication.whatsapp" },
      { title: "Voice", href: "/communication/voice", moduleKey: "communication.voice" },
      { title: "E-mail", href: "/communication/email", moduleKey: "communication.email" },
      { title: "Journey Builder", href: "/communication/journeys", moduleKey: "communication.journeys" },
      { title: "Calendar", href: "/communication/calendar", moduleKey: "communication.journeys" },
    ],
  },
  {
    title: "Inventory",
    icon: Boxes,
    moduleKey: "inventory",
    iconColor: "bg-green-500/15 text-green-400",
    children: [
      { title: "Inventory Items", href: "/inventory/items", moduleKey: "inventory.items" },
      { title: "Requisitions", href: "/inventory/requisitions", moduleKey: "inventory.requisitions" },
      { title: "Shipment Tracking", href: "/inventory/shipments", moduleKey: "inventory.shipments" },
      { title: "Goods Receipt", href: "/inventory/grn", moduleKey: "inventory.grn" },
      { title: "Stock Audit", href: "/inventory/audit", moduleKey: "inventory.audit" },
      { title: "Consumption Log", href: "/inventory/consumption", moduleKey: "inventory.consumption" },
      { title: "Expiry Management", href: "/inventory/expiry", moduleKey: "inventory.expiry" },
      { title: "Return to Vendor", href: "/inventory/rtv", moduleKey: "inventory.rtv" },
      { title: "Store Transfers", href: "/inventory/transfers", moduleKey: "inventory.transfers" },
      { title: "Low Stock Alerts", href: "/inventory/alerts", moduleKey: "inventory.alerts" },
    ],
  },
  {
    title: "Admin",
    icon: Settings,
    moduleKey: "admin",
    children: [
      { 
        title: "Master Data", 
        isSubSection: true,
        subChildren: [
          { title: "Meter Master", href: "/master/meter", moduleKey: "master.meter" },
          { title: "Department Master", href: "/master/department", moduleKey: "master.department" },
          { title: "Position Master", href: "/master/position", moduleKey: "master.position" },
          { title: "Category Master", href: "/master/category", moduleKey: "master.category" },
          { title: "Asset Definition Master", href: "/master/asset-definition", moduleKey: "master.category" },
          { title: "NSO Checklist Master", href: "/master/nso-checklist", moduleKey: "master.nso" },
          { title: "PM Checklist Master", href: "/master/pm-checklist", moduleKey: "master.pm" },
          { title: "Store Budget Master", href: "/master/store-budget", moduleKey: "master.budget" },
        ]
      },
      { 
        title: "Task Management", 
        isSubSection: true,
        subChildren: [
          { title: "Task Master", href: "/operations/tasks", moduleKey: "operations.tasks" },
          { title: "Role Master", href: "/operations/roles", moduleKey: "operations.roles" },
          { title: "Task Templates", href: "/operations/templates", moduleKey: "operations.templates" },
        ]
      },
      { 
        title: "User Management", 
        isSubSection: true,
        subChildren: [
          { title: "Users", href: "/admin/users", moduleKey: "usermanagement.users" },
          { title: "User Roles", href: "/admin/roles", moduleKey: "usermanagement.roles" },
          { title: "User Hierarchy", href: "/admin/hierarchy", moduleKey: "usermanagement.hierarchy" },
          { title: "Permission Set", href: "/admin/permissions", moduleKey: "usermanagement.permissions" },
        ]
      },
      { 
        title: "Company", 
        isSubSection: true,
        subChildren: [
          { title: "Company Information", href: "/admin/company" },
          { title: "Invoice Template", href: "/admin/company/invoice-template" },
        ]
      },
    ],
  },
];

interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function AppSidebar({ open, onOpenChange, collapsed = false, onCollapsedChange }: AppSidebarProps) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { hasPermission, isAdmin, loading } = usePermissions();
  const { profile } = useAuth();
  const { visibleAttendanceMenus } = useAttendanceRole();
  const { data: companyInfo } = useCompanyInfo();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  // Filter navigation based on permissions
  const filteredNavigation = useMemo(() => {
    if (loading) return [];

    return navigation
      .map((item) => {
        // Filter children/sub-sections strictly by Permission Set (no admin bypass for sidebar visibility)
        if (item.children) {
          const accessibleChildren = item.children
            .map((child) => {
              if (child.isSubSection && child.subChildren) {
                const accessibleSubs = child.subChildren.filter(
                  (sub) => !sub.moduleKey || hasPermission(sub.moduleKey, "view", { ignoreAdmin: true })
                );
                if (accessibleSubs.length === 0) return null;
                return { ...child, subChildren: accessibleSubs };
              }
              if (child.moduleKey && !hasPermission(child.moduleKey, "view", { ignoreAdmin: true })) {
                return null;
              }
              return child;
            })
            .filter(Boolean) as NavChild[];

          if (accessibleChildren.length === 0 && !item.href) return null;
          return { ...item, children: accessibleChildren };
        }

        // Leaf item
        if (item.moduleKey && !hasPermission(item.moduleKey, "view", { ignoreAdmin: true })) {
          return null;
        }
        return item;
      })
      .filter(Boolean) as NavItem[];
  }, [loading, isAdmin, hasPermission, visibleAttendanceMenus]);

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const isActive = (href?: string) => href ? location.pathname === href : false;
  const isChildActive = (children?: NavChild[]): boolean =>
    children?.some((child) => {
      if (child.href) return location.pathname === child.href;
      if (child.subChildren) return isChildActive(child.subChildren);
      return false;
    }) ?? false;

  // Backup: close mobile sheet on any route change (covers programmatic nav).
  useEffect(() => {
    if (isMobile && open) {
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile || !open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobile, open]);

  const handleNavTap = useCallback(
    (href?: string) => {
      if (!isMobile || !href) return;
      onOpenChange(false);
    },
    [isMobile, onOpenChange],
  );

  // Helper bound props for every clickable nav link on mobile.
  const navTapProps = (href?: string) => ({
    onClick: () => handleNavTap(href),
  });

  const sidebarContent = (
    <>
      <div className={cn(
        "flex h-14 md:h-16 items-center justify-between gap-2 border-b border-sidebar-border",
        collapsed ? "px-2" : "px-4 md:px-6"
      )}
      style={{ backgroundImage: "var(--sidebar-logo-gradient)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background overflow-hidden">
            <img src={companyInfo?.logo_url || trayiLogo} alt={companyInfo?.company_name || "Trayi"} className="h-8 w-8 object-contain" />
          </div>
          {!collapsed && <span className="font-display text-sm font-semibold tracking-wide whitespace-nowrap text-white drop-shadow">{(companyInfo?.company_name || "TRAYI JEWELLERS").toUpperCase()}</span>}
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 text-white hover:bg-white/10">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <nav className={cn("space-y-1", collapsed ? "p-2" : "p-3 md:p-4")}>
          {filteredNavigation.map((item) => (
            <div key={item.title}>
              {item.href ? (
                collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.href}
                        {...navTapProps(item.href)}
                        className={cn(
                          "flex items-center justify-center rounded-lg p-2.5 transition-colors",
                          isActive(item.href)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", item.iconColor || "bg-sidebar-accent text-sidebar-accent-foreground")}>
                          <item.icon className="h-4 w-4" />
                        </span>
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                ) : (
                  <NavLink
                    to={item.href}
                    {...navTapProps(item.href)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 md:py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", item.iconColor || "bg-sidebar-accent/60 text-sidebar-accent-foreground")}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    {item.title}
                  </NavLink>
                )
              ) : collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.children?.[0]?.href || item.children?.[0]?.subChildren?.[0]?.href || "/"}
                      {...navTapProps(item.children?.[0]?.href || item.children?.[0]?.subChildren?.[0]?.href)}
                      className={cn(
                        "flex w-full items-center justify-center rounded-lg p-2.5 transition-colors",
                        isChildActive(item.children)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", item.iconColor || "bg-sidebar-accent text-sidebar-accent-foreground")}>
                        <item.icon className="h-4 w-4" />
                      </span>
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <button
                    onClick={() => toggleMenu(item.title)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 md:py-2 text-sm font-medium transition-colors",
                      isChildActive(item.children)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", item.iconColor || "bg-sidebar-accent/60 text-sidebar-accent-foreground")}>
                        <item.icon className="h-4 w-4" />
                      </span>
                      {item.title}
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        openMenus.includes(item.title) && "rotate-180"
                      )}
                    />
                  </button>
                  {openMenus.includes(item.title) && item.children && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-4">
                      {item.children.map((child) => (
                        child.isSubSection ? (
                          <div key={child.title}>
                            <button
                              onClick={() => toggleMenu(child.title)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                                isChildActive(child.subChildren)
                                  ? "text-sidebar-accent-foreground"
                                  : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
                              )}
                            >
                              {child.title}
                              <ChevronDown
                                className={cn(
                                  "h-3 w-3 transition-transform",
                                  openMenus.includes(child.title) && "rotate-180"
                                )}
                              />
                            </button>
                            {openMenus.includes(child.title) && child.subChildren && (
                              <div className="ml-2 mt-1 space-y-1 border-l border-sidebar-border/50 pl-3">
                                {child.subChildren.map((subChild) => (
                                  <NavLink
                                    key={subChild.href}
                                    to={subChild.href!}
                                    {...navTapProps(subChild.href)}
                                    className={cn(
                                      "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                                      isActive(subChild.href)
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                                    )}
                                  >
                                    {subChild.title}
                                  </NavLink>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <NavLink
                            key={child.href}
                            to={child.href!}
                            {...navTapProps(child.href)}
                            className={cn(
                              "block rounded-lg px-3 py-2 text-sm transition-colors",
                              isActive(child.href)
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
                            )}
                          >
                            {child.title}
                          </NavLink>
                        )
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Collapse Toggle Button - Desktop Only */}
      {!isMobile && onCollapsedChange && (
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCollapsedChange(!collapsed)}
            className={cn(
              "w-full justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              !collapsed && "justify-start"
            )}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <>
        <div
          className={cn(
            "fixed inset-0 z-40 bg-foreground/80 transition-opacity duration-200",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
          aria-hidden={!open}
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {sidebarContent}
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {sidebarContent}
    </aside>
  );
}
