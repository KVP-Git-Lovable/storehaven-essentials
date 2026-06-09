import { Sparkles } from "lucide-react";

export function AIInsightsCard({ insights }: { insights: string[] }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">AI Insights</h3>
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      {insights.length === 0 ? (
        <p className="text-xs text-muted-foreground">Insights will appear as data accumulates.</p>
      ) : (
        <ul className="space-y-1.5">
          {insights.slice(0, 3).map((i, idx) => (
            <li key={idx} className="text-xs text-foreground flex items-start gap-1.5">
              <span className="text-primary mt-0.5">•</span>
              <span>{i}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}