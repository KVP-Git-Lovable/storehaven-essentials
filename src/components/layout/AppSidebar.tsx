import { useState, useMemo } from "react";
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
  Settings,
  PanelLeftClose,
  PanelLeft,
  CalendarCheck,
} from "lucide-react";
import quickappLogo from "@/assets/quickapp-logo.png";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { useAttendanceRole } from "@/hooks/useAttendanceRole";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
}

const navigation: NavItem[] = [
  { title: "Home", href: "/dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { title: "AI Insights", href: "/ai-insights", icon: Brain, moduleKey: "dashboard" },
  {
    title: "Dashboards",
    icon: BarChart3,
    moduleKey: "dashboards",
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
  { title: "New Store Opening", href: "/stores/new-opening", icon: Building2, moduleKey: "stores.nso" },
  {
    title: "Store Management",
    icon: Store,
    moduleKey: "stores",
    children: [
      { title: "All Stores", href: "/stores", moduleKey: "stores.all" },
      { title: "Rentals & Leases", href: "/stores/rentals", moduleKey: "stores.rentals" },
      { title: "Store Budget", href: "/stores/budget", moduleKey: "stores.budget" },
      { title: "Store Maintenance Tasks", href: "/operations/adherence", moduleKey: "operations.adherence" },
      { title: "Store Heatmap", href: "/operations/heatmap", moduleKey: "operations.heatmap" },
      { title: "Footfall", href: "/footfall", moduleKey: "footfall" },
      { title: "Petty Cash", href: "/petty-cash", moduleKey: "pettycash" },
      { title: "Store Targets", href: "/stores/targets", moduleKey: "stores.all" },
    ],
  },
  {
    title: "Visual Merch (VM)",
    icon: BarChart3,
    moduleKey: "vm",
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
  { title: "Vendors", href: "/vendors", icon: Building2, moduleKey: "vendors" },
  {
    title: "Attendance",
    icon: CalendarCheck,
    moduleKey: "staff",
    children: [
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
    title: "Inventory",
    icon: Boxes,
    moduleKey: "inventory",
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
  const [openMenus, setOpenMenus] = useState<string[]>(["Store Management", "Assets & Vendors"]);

  // Filter navigation based on permissions
  const filteredNavigation = useMemo(() => {
    if (loading) return [];
    
    return navigation
      .map((item) => {
        // Special handling for Attendance module - filter children based on role
        if (item.title === "Attendance" && item.children) {
          const filteredChildren = item.children.filter(
            (child) => child.moduleKey && visibleAttendanceMenus.includes(child.moduleKey)
          );
          if (filteredChildren.length === 0) return null;
          return { ...item, children: filteredChildren };
        }

        // Check if user has access to this module
        if (item.moduleKey && !isAdmin && !hasPermission(item.moduleKey, "view")) {
          // Check if any children are accessible
          if (item.children) {
            const accessibleChildren = item.children.filter(
              (child) => !child.moduleKey || hasPermission(child.moduleKey, "view")
            );
            if (accessibleChildren.length === 0) return null;
            return { ...item, children: accessibleChildren };
          }
          return null;
        }

        // Filter children
        if (item.children) {
          const accessibleChildren = item.children.filter(
            (child) => !child.moduleKey || isAdmin || hasPermission(child.moduleKey, "view")
          );
          if (accessibleChildren.length === 0 && !item.href) return null;
          return { ...item, children: accessibleChildren };
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

  const handleNavClick = () => {
    if (isMobile) {
      onOpenChange(false);
    }
  };

  const sidebarContent = (
    <>
      <div className={cn(
        "flex h-14 md:h-16 items-center justify-between gap-2 border-b border-sidebar-border",
        collapsed ? "px-2" : "px-4 md:px-6"
      )}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 overflow-hidden">
            <img src={quickappLogo} alt="StoreOps" className="h-6 w-6 object-contain" />
          </div>
          {!collapsed && <span className="font-display text-lg font-semibold">StoreOps</span>}
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
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
                        onClick={handleNavClick}
                        className={cn(
                          "flex items-center justify-center rounded-lg p-2.5 transition-colors",
                          isActive(item.href)
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                ) : (
                  <NavLink
                    to={item.href}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 md:py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </NavLink>
                )
              ) : collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.children?.[0]?.href || item.children?.[0]?.subChildren?.[0]?.href || "/"}
                      onClick={handleNavClick}
                      className={cn(
                        "flex w-full items-center justify-center rounded-lg p-2.5 transition-colors",
                        isChildActive(item.children)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
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
                      <item.icon className="h-4 w-4" />
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
                                    onClick={handleNavClick}
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
                            onClick={handleNavClick}
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
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <div className="flex flex-col h-full">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>
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
