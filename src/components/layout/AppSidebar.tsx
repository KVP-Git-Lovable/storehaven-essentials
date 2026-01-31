import { useState, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Package,
  Users,
  DollarSign,
  Gauge,
  ShieldCheck,
  ChevronDown,
  UserCheck,
  Building2,
  X,
  Database,
  Eye,
  Boxes,
  ClipboardCheck,
  ShoppingCart,
  UserCog,
} from "lucide-react";
import quickappLogo from "@/assets/quickapp-logo.png";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissions } from "@/hooks/usePermissions";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavChild {
  title: string;
  href: string;
  moduleKey?: string;
}

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  moduleKey?: string;
  children?: NavChild[];
}

const navigation: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, moduleKey: "dashboard" },
  {
    title: "Point of Sale",
    icon: ShoppingCart,
    moduleKey: "pos",
    children: [
      { title: "Quick Sale", href: "/pos", moduleKey: "pos.quicksale" },
      { title: "Product Master", href: "/pos/products", moduleKey: "pos.products" },
      { title: "Order History", href: "/pos/orders", moduleKey: "pos.orders" },
      { title: "Schemes", href: "/pos/schemes", moduleKey: "pos.schemes" },
    ],
  },
  {
    title: "Store Management",
    icon: Store,
    moduleKey: "stores",
    children: [
      { title: "All Stores", href: "/stores", moduleKey: "stores.all" },
      { title: "Rentals & Leases", href: "/stores/rentals", moduleKey: "stores.rentals" },
      { title: "New Store Opening", href: "/stores/new-opening", moduleKey: "stores.nso" },
    ],
  },
  {
    title: "Assets & Vendors",
    icon: Package,
    moduleKey: "assets",
    children: [
      { title: "Asset Master", href: "/assets/master", moduleKey: "assets.master" },
      { title: "Asset Register", href: "/assets/inventory", moduleKey: "assets.register" },
      { title: "Service Contracts", href: "/services/contracts", moduleKey: "assets.contracts" },
      { title: "Preventive Maintenance", href: "/services/maintenance", moduleKey: "assets.maintenance" },
      { title: "Service Tickets", href: "/services/tickets", moduleKey: "assets.tickets" },
      { title: "Knowledge Base", href: "/services/knowledge-base", moduleKey: "assets.knowledge" },
    ],
  },
  { title: "Vendors", href: "/vendors", icon: Building2, moduleKey: "vendors" },
  { title: "Petty Cash", href: "/petty-cash", icon: DollarSign, moduleKey: "pettycash" },
  { title: "Utilities", href: "/utilities", icon: Gauge, moduleKey: "utilities" },
  {
    title: "Staff Management",
    icon: Users,
    moduleKey: "staff",
    children: [
      { title: "Employees", href: "/staff/employees", moduleKey: "staff.employees" },
      { title: "Attendance & Leave", href: "/staff/attendance", moduleKey: "staff.attendance" },
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
  { title: "Footfall", href: "/footfall", icon: UserCheck, moduleKey: "footfall" },
  {
    title: "Visual Merchandising",
    icon: Eye,
    moduleKey: "vm",
    children: [
      { title: "Planograms", href: "/vm/planograms", moduleKey: "vm.planograms" },
      { title: "Compliance Tasks", href: "/vm/tasks", moduleKey: "vm.tasks" },
      { title: "Submit Photo", href: "/vm/submit", moduleKey: "vm.submit" },
      { title: "Review Submissions", href: "/vm/review", moduleKey: "vm.review" },
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
    title: "Store Operations",
    icon: ClipboardCheck,
    moduleKey: "operations",
    children: [
      { title: "Task Master", href: "/operations/tasks", moduleKey: "operations.tasks" },
      { title: "Role Master", href: "/operations/roles", moduleKey: "operations.roles" },
      { title: "Task Templates", href: "/operations/templates", moduleKey: "operations.templates" },
      { title: "Task Adherence", href: "/operations/adherence", moduleKey: "operations.adherence" },
      { title: "Store Heatmap", href: "/operations/heatmap", moduleKey: "operations.heatmap" },
    ],
  },
  {
    title: "Master",
    icon: Database,
    moduleKey: "master",
    children: [
      { title: "Meter Master", href: "/master/meter", moduleKey: "master.meter" },
      { title: "Department Master", href: "/master/department", moduleKey: "master.department" },
      { title: "Position Master", href: "/master/position", moduleKey: "master.position" },
      { title: "Category Master", href: "/master/category", moduleKey: "master.category" },
      { title: "Location Master", href: "/master/location", moduleKey: "master.location" },
      { title: "NSO Checklist Master", href: "/master/nso-checklist", moduleKey: "master.nso" },
      { title: "PM Checklist Master", href: "/master/pm-checklist", moduleKey: "master.pm" },
    ],
  },
  {
    title: "User Management",
    icon: UserCog,
    moduleKey: "usermanagement",
    children: [
      { title: "Users", href: "/admin/users", moduleKey: "usermanagement.users" },
      { title: "User Roles", href: "/admin/roles", moduleKey: "usermanagement.roles" },
      { title: "User Hierarchy", href: "/admin/hierarchy", moduleKey: "usermanagement.hierarchy" },
      { title: "Permission Set", href: "/admin/permissions", moduleKey: "usermanagement.permissions" },
    ],
  },
];

interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppSidebar({ open, onOpenChange }: AppSidebarProps) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { hasPermission, isAdmin, loading } = usePermissions();
  const [openMenus, setOpenMenus] = useState<string[]>(["Store Management", "Assets & Vendors"]);

  // Filter navigation based on permissions
  const filteredNavigation = useMemo(() => {
    if (loading) return [];
    
    return navigation
      .map((item) => {
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
  }, [loading, isAdmin, hasPermission]);

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isChildActive = (children?: { href: string }[]) =>
    children?.some((child) => location.pathname === child.href);

  const handleNavClick = () => {
    if (isMobile) {
      onOpenChange(false);
    }
  };

  const sidebarContent = (
    <>
      <div className="flex h-14 md:h-16 items-center justify-between gap-2 border-b border-sidebar-border px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 overflow-hidden">
            <img src={quickappLogo} alt="StoreOps" className="h-6 w-6 object-contain" />
          </div>
          <span className="font-display text-lg font-semibold">StoreOps</span>
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-1 p-3 md:p-4">
          {filteredNavigation.map((item) => (
            <div key={item.title}>
              {item.href ? (
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
                        <NavLink
                          key={child.href}
                          to={child.href}
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
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      {sidebarContent}
    </aside>
  );
}
