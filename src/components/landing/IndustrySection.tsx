import { Building2, ShoppingCart, Coffee, Pill, Smartphone, Shirt } from "lucide-react";

const industries = [
  {
    icon: Coffee,
    name: "Food & Beverage",
    description: "Restaurants, cafes, QSR chains, and ice cream parlours.",
    features: ["Expiry tracking", "FIFO management", "Kitchen display"],
  },
  {
    icon: ShoppingCart,
    name: "Retail Chains",
    description: "Supermarkets, convenience stores, and retail outlets.",
    features: ["POS integration", "Stock replenishment", "Planogram compliance"],
  },
  {
    icon: Shirt,
    name: "Fashion & Apparel",
    description: "Clothing stores, shoe outlets, and fashion boutiques.",
    features: ["Visual merchandising", "Season management", "Size tracking"],
  },
  {
    icon: Smartphone,
    name: "Electronics",
    description: "Mobile stores, electronics retail, and appliance showrooms.",
    features: ["Asset tracking", "Warranty management", "Demo units"],
  },
  {
    icon: Pill,
    name: "Pharmacy",
    description: "Pharmacy chains and healthcare retail outlets.",
    features: ["Batch tracking", "Expiry alerts", "Cold chain"],
  },
  {
    icon: Building2,
    name: "Multi-Brand Retail",
    description: "Department stores and multi-brand outlets.",
    features: ["Multi-tenant", "Brand compliance", "Space management"],
  },
];

export function IndustrySection() {
  return (
    <section id="industries" className="py-20 md:py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-800" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-amber-400 font-semibold text-sm uppercase tracking-wider mb-3">
            Industry Solutions
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Built for Your Industry
          </h2>
          <p className="text-lg text-slate-400">
            Pre-configured workflows and features designed for specific industry needs. Get started faster with industry best practices built-in.
          </p>
        </div>

        {/* Industry Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {industries.map((industry, index) => (
            <div
              key={index}
              className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 hover:border-amber-500/30 transition-all duration-300 group"
            >
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
                <industry.icon className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{industry.name}</h3>
              <p className="text-sm text-slate-400 mb-4">{industry.description}</p>
              <div className="flex flex-wrap gap-2">
                {industry.features.map((feature, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 bg-slate-700/50 text-slate-300 rounded-full"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
