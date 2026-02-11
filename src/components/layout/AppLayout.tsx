import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  
  // Initialize service worker and offline/online handlers
  useServiceWorker();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar 
        open={sidebarOpen} 
        onOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div className={cn(
        "transition-all duration-300 min-w-0",
        isMobile ? "ml-0" : sidebarCollapsed ? "ml-16" : "ml-64"
      )}>
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-2 sm:p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
