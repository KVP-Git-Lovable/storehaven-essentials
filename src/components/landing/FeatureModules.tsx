import { 
  Store, 
  Package, 
  Wrench, 
  Users, 
  Shield, 
  ShoppingCart, 
  BarChart3,
  ClipboardCheck,
  ArrowRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";

const modules = [
  {
    icon: Store,
    title: "Store Management",
    description: "Complete control over your retail locations with rentals, budgets, targets, and new store openings.",
    features: [
      "Multi-store dashboard",
      "Rental & lease tracking",
      "Budget management",
      "Store targets & KPIs",
      "New store opening workflow",
    ],
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Package,
    title: "Asset & Service",
    description: "End-to-end asset lifecycle management with preventive maintenance and service ticketing.",
    features: [
      "Asset master catalog",
      "Asset register & tracking",
      "Service contracts",
      "Preventive maintenance",
      "Service tickets & SLAs",
    ],
    color: "from-purple-500 to-purple-600",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: ClipboardCheck,
    title: "Inventory Management",
    description: "Complete inventory control from requisitions to consumption with expiry management.",
    features: [
      "Stock requisitions",
      "Goods receipt (GRN)",
      "Store transfers",
      "Expiry management",
      "Low stock alerts",
    ],
    color: "from-green-500 to-green-600",
    bgColor: "bg-green-500/10",
  },
  {
    icon: ShoppingCart,
    title: "Point of Sale",
    description: "Modern POS system with schemes, loyalty programs, and comprehensive order management.",
    features: [
      "Quick sale terminal",
      "Product master",
      "Schemes & promotions",
      "Order history",
      "Returns processing",
    ],
    color: "from-amber-500 to-amber-600",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: Users,
    title: "Staff Management",
    description: "Employee lifecycle management with attendance tracking and face recognition.",
    features: [
      "Employee directory",
      "Attendance tracking",
      "Leave management",
      "Face recognition check-in",
      "Performance reviews",
    ],
    color: "from-pink-500 to-pink-600",
    bgColor: "bg-pink-500/10",
  },
  {
    icon: Shield,
    title: "Security Operations",
    description: "Guard management with patrol tracking, roster scheduling, and gamification.",
    features: [
      "Guard management",
      "Roster scheduling",
      "Patrol point scanning",
      "Real-time tracking",
      "Performance gamification",
    ],
    color: "from-red-500 to-red-600",
    bgColor: "bg-red-500/10",
  },
  {
    icon: BarChart3,
    title: "Visual Merchandising",
    description: "Planogram compliance with photo verification and AI-powered comparison.",
    features: [
      "Planogram management",
      "Compliance tasks",
      "Photo submissions",
      "AI comparison",
      "Compliance scoring",
    ],
    color: "from-cyan-500 to-cyan-600",
    bgColor: "bg-cyan-500/10",
  },
  {
    icon: Wrench,
    title: "Operations & Tasks",
    description: "Task management with templates, adherence tracking, and store heatmaps.",
    features: [
      "Task master",
      "Role-based tasks",
      "Task templates",
      "Adherence tracking",
      "Store heatmap analytics",
    ],
    color: "from-orange-500 to-orange-600",
    bgColor: "bg-orange-500/10",
  },
];

export function FeatureModules() {
  return (
    <section id="features" className="py-20 md:py-32 bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-amber-400 font-semibold text-sm uppercase tracking-wider mb-3">
            Complete Solution
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Everything You Need to Run Your Stores
          </h2>
          <p className="text-lg text-slate-400">
            8 integrated modules working together to give you complete visibility and control over every aspect of your retail operations.
          </p>
        </div>

        {/* Module Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {modules.map((module, index) => (
            <div
              key={index}
              className="group relative bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 hover:border-slate-600 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Icon */}
              <div className={`h-12 w-12 rounded-xl ${module.bgColor} flex items-center justify-center mb-4`}>
                <module.icon className={`h-6 w-6 bg-gradient-to-br ${module.color} text-transparent bg-clip-text`} style={{ color: module.color.includes('amber') ? '#f59e0b' : module.color.includes('blue') ? '#3b82f6' : module.color.includes('purple') ? '#a855f7' : module.color.includes('green') ? '#22c55e' : module.color.includes('pink') ? '#ec4899' : module.color.includes('red') ? '#ef4444' : module.color.includes('cyan') ? '#06b6d4' : '#f97316' }} />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-white mb-2">{module.title}</h3>
              <p className="text-sm text-slate-400 mb-4">{module.description}</p>

              {/* Features List */}
              <ul className="space-y-2">
                {module.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="h-1 w-1 rounded-full bg-slate-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Hover Arrow */}
              <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="h-5 w-5 text-amber-400" />
              </div>
            </div>
          ))}
        </div>

        {/* View All Features */}
        <div className="text-center mt-12">
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white">
            View All 100+ Features
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}
