import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Package,
  Users,
  DollarSign,
  Gauge,
  ClipboardList,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  children?: { title: string; href: string }[];
}

const navigation: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    title: "Point of Sale",
    icon: ShoppingCart,
    children: [
      { title: "Quick Sale", href: "/pos" },
      { title: "Product Master", href: "/pos/products" },
      { title: "Order History", href: "/pos/orders" },
      { title: "Schemes", href: "/pos/schemes" },
    ],
  },
  {
    title: "Store Management",
    icon: Store,
    children: [
      { title: "All Stores", href: "/stores" },
      { title: "Rentals & Leases", href: "/stores/rentals" },
      { title: "New Store Opening", href: "/stores/new-opening" },
    ],
  },
  {
    title: "Assets & Vendors",
    icon: Package,
    children: [
      { title: "Asset Master", href: "/assets/master" },
      { title: "Asset Register", href: "/assets/inventory" },
      { title: "Spares Management", href: "/assets/spares" },
      { title: "Service Contracts", href: "/services/contracts" },
      { title: "Preventive Maintenance", href: "/services/maintenance" },
      { title: "Service Tickets", href: "/services/tickets" },
      { title: "Knowledge Base", href: "/services/knowledge-base" },
    ],
  },
  { title: "Vendors", href: "/vendors", icon: Building2 },
  { title: "Petty Cash", href: "/petty-cash", icon: DollarSign },
  { title: "Utilities", href: "/utilities", icon: Gauge },
  {
    title: "Staff Management",
    icon: Users,
    children: [
      { title: "Employees", href: "/staff/employees" },
      { title: "Attendance & Leave", href: "/staff/attendance" },
    ],
  },
  {
    title: "Security",
    icon: ShieldCheck,
    children: [
      { title: "Dashboard", href: "/security" },
      { title: "Guards", href: "/security/guards" },
      { title: "Roster", href: "/security/roster" },
      { title: "Patrol Points", href: "/security/patrol-points" },
      { title: "Patrol Scan", href: "/security/scan" },
      { title: "Feedback", href: "/security/feedback" },
      { title: "Gamification", href: "/security/gamification" },
    ],
  },
  { title: "Footfall", href: "/footfall", icon: UserCheck },
  {
    title: "Visual Merchandising",
    icon: Eye,
    children: [
      { title: "Planograms", href: "/vm/planograms" },
      { title: "Compliance Tasks", href: "/vm/tasks" },
      { title: "Submit Photo", href: "/vm/submit" },
      { title: "Review Submissions", href: "/vm/review" },
    ],
  },
  {
    title: "Inventory",
    icon: Boxes,
    children: [
      { title: "Warehouses", href: "/inventory/warehouses" },
      { title: "Inventory Items", href: "/inventory/items" },
      { title: "Requisitions", href: "/inventory/requisitions" },
      { title: "Shipment Tracking", href: "/inventory/shipments" },
      { title: "Goods Receipt", href: "/inventory/grn" },
      { title: "Stock Audit", href: "/inventory/audit" },
      { title: "Consumption Log", href: "/inventory/consumption" },
      { title: "Expiry Management", href: "/inventory/expiry" },
      { title: "Return to Vendor", href: "/inventory/rtv" },
      { title: "Store Transfers", href: "/inventory/transfers" },
      { title: "Low Stock Alerts", href: "/inventory/alerts" },
    ],
  },
  {
    title: "Store Operations",
    icon: ClipboardCheck,
    children: [
      { title: "Task Master", href: "/operations/tasks" },
      { title: "Role Master", href: "/operations/roles" },
      { title: "Task Templates", href: "/operations/templates" },
      { title: "Task Adherence", href: "/operations/adherence" },
      { title: "Store Heatmap", href: "/operations/heatmap" },
    ],
  },
  {
    title: "Master",
    icon: Database,
    children: [
      { title: "Meter Master", href: "/master/meter" },
      { title: "Department Master", href: "/master/department" },
      { title: "Position Master", href: "/master/position" },
      { title: "Category Master", href: "/master/category" },
      { title: "Location Master", href: "/master/location" },
      { title: "NSO Checklist Master", href: "/master/nso-checklist" },
      { title: "PM Checklist Master", href: "/master/pm-checklist" },
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
  const [openMenus, setOpenMenus] = useState<string[]>(["Store Management", "Assets & Vendors"]);

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
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Store className="h-4 w-4 text-primary-foreground" />
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
          {navigation.map((item) => (
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
