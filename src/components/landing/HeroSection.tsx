import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Sparkles, ChevronRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <Badge className="mb-6 bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-First Platform • Complete Store Operations Management
          </Badge>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            One Platform for
            <br />
            <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-transparent bg-clip-text">
              Complete Store Operations
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="text-lg md:text-xl text-slate-300 mb-4 max-w-3xl mx-auto">
            <span className="text-white font-semibold">Store Management</span> •{" "}
            <span className="text-white font-semibold">Assets & Service</span> •{" "}
            <span className="text-white font-semibold">Inventory</span> •{" "}
            <span className="text-white font-semibold">POS</span> •{" "}
            <span className="text-white font-semibold">Staff</span> •{" "}
            <span className="text-white font-semibold">Security</span>
          </p>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
            — all powered by AI that guides your team to operational excellence, not just collects data.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-semibold px-8 h-12 text-base"
            >
              Get Started Free
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white px-8 h-12 text-base"
            >
              <Play className="h-4 w-4 mr-2" />
              Watch Demo
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              100+ Stores Managed
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              Real-time Analytics
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              AI-Powered Insights
            </div>
          </div>
        </div>

        {/* Hero Image Placeholder - App Screenshot */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10" />
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
            <div className="bg-slate-800 px-4 py-3 flex items-center gap-2 border-b border-slate-700/50">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-slate-400">app.quickstoreops.com</span>
              </div>
            </div>
            <div className="aspect-[16/9] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <div className="text-center">
                <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-amber-400" />
                </div>
                <p className="text-slate-400 text-sm">Dashboard Preview</p>
                <p className="text-slate-500 text-xs mt-1">Interactive demo coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
