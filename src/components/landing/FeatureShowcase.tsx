import { 
  Sparkles, 
  Zap, 
  Bell, 
  TrendingUp, 
  Map, 
  Camera,
  CheckCircle2 
} from "lucide-react";

const showcaseFeatures = [
  {
    icon: Sparkles,
    title: "AI-Powered Insights",
    description: "Not just data collection — AI-powered analytics that actively guide your team with smart recommendations, predictive insights, and next-best-actions.",
  },
  {
    icon: Zap,
    title: "Real-Time Operations",
    description: "Live dashboards with real-time updates across all stores. Track asset health, inventory levels, staff attendance, and security patrols instantly.",
  },
  {
    icon: Bell,
    title: "Smart Alerts & Notifications",
    description: "Proactive alerts for low stock, maintenance due, expiring contracts, and compliance issues. Never miss a critical operational event.",
  },
  {
    icon: TrendingUp,
    title: "Predictive Analytics",
    description: "AI-driven forecasting for inventory demand, asset failures, and staffing requirements. Plan ahead with confidence.",
  },
  {
    icon: Map,
    title: "Multi-Store Visibility",
    description: "Unified view across all your retail locations. Compare performance, share resources, and standardize operations company-wide.",
  },
  {
    icon: Camera,
    title: "Visual Compliance",
    description: "Photo-based verification with AI comparison against planograms. Ensure brand standards are maintained across every store.",
  },
];

export function FeatureShowcase() {
  return (
    <section id="solutions" className="py-20 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-amber-400 font-semibold text-sm uppercase tracking-wider mb-3">
            AI-First Platform
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Intelligent Tools That Guide, Not Just Track
          </h2>
          <p className="text-lg text-slate-400">
            Built on AI-first architecture, our platform goes beyond data collection. Every feature is designed to <span className="text-white font-medium">guide your operations team</span> with intelligent recommendations and actionable insights.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {showcaseFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-8 hover:border-amber-500/30 transition-all duration-300"
            >
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center mb-6">
                <feature.icon className="h-7 w-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="mt-20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 rounded-2xl border border-amber-500/20 p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "7+", label: "Integrated Dashboards" },
              { value: "100+", label: "Features & Tools" },
              { value: "Real-time", label: "Data Sync" },
              { value: "24/7", label: "AI Monitoring" },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-amber-400 mb-1">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
