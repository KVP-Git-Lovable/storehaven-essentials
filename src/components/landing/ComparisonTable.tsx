import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

const comparisonData = [
  { feature: "All-in-One Platform", us: true, others: "partial" },
  { feature: "AI-Powered Insights", us: true, others: false },
  { feature: "Real-Time Dashboards", us: true, others: "partial" },
  { feature: "Asset Management", us: true, others: false },
  { feature: "Service & Maintenance", us: true, others: false },
  { feature: "Inventory Control", us: true, others: true },
  { feature: "POS Integration", us: true, others: true },
  { feature: "Staff & Attendance", us: true, others: "partial" },
  { feature: "Security Operations", us: true, others: false },
  { feature: "Visual Merchandising", us: true, others: false },
  { feature: "Multi-Store Support", us: true, others: "partial" },
  { feature: "Mobile-First Design", us: true, others: "partial" },
];

export function ComparisonTable() {
  const renderStatus = (status: boolean | string) => {
    if (status === true) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    } else if (status === "partial") {
      return <MinusCircle className="h-5 w-5 text-yellow-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500/50" />;
    }
  };

  return (
    <section className="py-20 md:py-32 bg-slate-900/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-amber-400 font-semibold text-sm uppercase tracking-wider mb-3">
            Why Choose Us
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Not Just Another Tool — A Complete Platform
          </h2>
          <p className="text-lg text-slate-400">
            We built QuickStoreOps with a revolutionary approach: <span className="text-white font-medium">one unified platform</span> that replaces multiple disconnected tools.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 bg-slate-800 px-6 py-4 border-b border-slate-700/50">
            <div className="text-sm font-semibold text-slate-300">Feature</div>
            <div className="text-center">
              <span className="text-sm font-semibold text-amber-400">QuickStoreOps</span>
            </div>
            <div className="text-center">
              <span className="text-sm font-semibold text-slate-500">Others</span>
            </div>
          </div>

          {/* Rows */}
          {comparisonData.map((row, index) => (
            <div
              key={index}
              className={`grid grid-cols-3 px-6 py-4 ${
                index !== comparisonData.length - 1 ? "border-b border-slate-700/30" : ""
              }`}
            >
              <div className="text-sm text-slate-300">{row.feature}</div>
              <div className="flex justify-center">{renderStatus(row.us)}</div>
              <div className="flex justify-center">{renderStatus(row.others)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
