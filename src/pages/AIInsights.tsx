import { useState } from "react";
import { 
  Brain, 
  Cpu, 
  TrendingUp, 
  AlertTriangle, 
  Wrench, 
  Package, 
  Users, 
  Store, 
  Calendar,
  Loader2,
  RefreshCw,
  Sparkles,
  Activity,
  ShoppingCart,
  Clock,
  Target,
  Zap
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type InsightType = 
  | "asset_health" 
  | "inventory_forecast" 
  | "ticket_resolution" 
  | "store_performance" 
  | "nso_risk" 
  | "employee_scheduling";

interface InsightCard {
  type: InsightType;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const insightCards: InsightCard[] = [
  {
    type: "asset_health",
    title: "Asset Health & Predictions",
    description: "Health scores, failure predictions, and PM recommendations",
    icon: Cpu,
    color: "text-blue-500"
  },
  {
    type: "inventory_forecast",
    title: "Inventory Forecasting",
    description: "Demand forecasting, auto-requisitions, and expiry alerts",
    icon: Package,
    color: "text-green-500"
  },
  {
    type: "store_performance",
    title: "Store Performance",
    description: "Weekly insights combining footfall, sales, and uptime",
    icon: Store,
    color: "text-purple-500"
  },
  {
    type: "nso_risk",
    title: "NSO Risk Assessment",
    description: "Project delay predictions and risk mitigation",
    icon: Calendar,
    color: "text-orange-500"
  },
  {
    type: "employee_scheduling",
    title: "Smart Scheduling",
    description: "Optimize staffing based on predicted footfall",
    icon: Users,
    color: "text-pink-500"
  }
];

export default function AIInsights() {
  const [loading, setLoading] = useState<InsightType | null>(null);
  const [insights, setInsights] = useState<Record<InsightType, any>>({} as any);
  const { toast } = useToast();

  const fetchInsights = async (type: InsightType) => {
    setLoading(type);
    try {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { type }
      });

      if (error) throw error;

      if (data.success) {
        setInsights(prev => ({ ...prev, [type]: data.insights }));
        toast({
          title: "AI Analysis Complete",
          description: `${type.replace("_", " ")} insights generated successfully`,
        });
      } else {
        throw new Error(data.error || "Failed to generate insights");
      }
    } catch (error: any) {
      console.error("AI insights error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate AI insights",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const renderAssetHealthInsights = (data: any) => {
    if (!data) return null;
    
    return (
      <div className="space-y-6">
        {data.summary && (
          <Card className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
                <p className="text-sm">{data.summary}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.healthScores && data.healthScores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                Asset Health Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {data.healthScores.slice(0, 10).map((asset: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{asset.assetName || `Asset ${i + 1}`}</p>
                        <p className="text-xs text-muted-foreground">{asset.reason}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={asset.score} className="w-20" />
                        <Badge variant={
                          asset.risk === "high" ? "destructive" :
                          asset.risk === "medium" ? "secondary" : "default"
                        }>
                          {asset.score}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {data.failurePredictions && data.failurePredictions.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Failure Predictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.failurePredictions.slice(0, 5).map((pred: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div>
                      <p className="font-medium">{pred.assetName}</p>
                      <p className="text-xs text-muted-foreground">{pred.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-destructive">{Math.round(pred.probability * 100)}% risk</p>
                      <p className="text-xs text-muted-foreground">By {pred.predictedDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.maintenanceRecommendations && data.maintenanceRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="h-5 w-5 text-amber-500" />
                PM Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.maintenanceRecommendations.slice(0, 5).map((rec: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{rec.assetName}</p>
                      <p className="text-sm text-muted-foreground">{rec.action}</p>
                    </div>
                    <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "secondary" : "outline"}>
                      {rec.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderInventoryInsights = (data: any) => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        {data.summary && (
          <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-green-500 mt-0.5" />
                <p className="text-sm">{data.summary}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.demandForecast && data.demandForecast.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Demand Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {data.demandForecast.slice(0, 10).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{item.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          7-day: {item.forecast7d} | 30-day: {item.forecast30d}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          item.trend === "increasing" ? "default" :
                          item.trend === "decreasing" ? "destructive" : "secondary"
                        }>
                          {item.trend}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(item.confidence * 100)}% conf
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {data.autoRequisitions && data.autoRequisitions.length > 0 && (
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-amber-500" />
                Auto-Requisition Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.autoRequisitions.slice(0, 5).map((req: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div>
                      <p className="font-medium">{req.itemName}</p>
                      <p className="text-xs text-muted-foreground">{req.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Order {req.recommendedQty} units</p>
                      <p className="text-xs text-muted-foreground">Current: {req.currentStock}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.expiryRisks && data.expiryRisks.length > 0 && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-destructive" />
                Expiry Risk Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.expiryRisks.slice(0, 5).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div>
                      <p className="font-medium">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">{item.recommendedAction}</p>
                    </div>
                    <Badge variant={item.riskLevel === "high" ? "destructive" : "secondary"}>
                      {item.riskLevel} risk
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.vendorInsights && data.vendorInsights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                Vendor Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.vendorInsights.slice(0, 5).map((vendor: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{vendor.vendorName}</p>
                      <p className="text-xs text-muted-foreground">{vendor.recommendation}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={vendor.performanceScore} className="w-16" />
                      <span className="font-medium">{vendor.performanceScore}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderStoreInsights = (data: any) => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        {data.summary && (
          <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-purple-500 mt-0.5" />
                <p className="text-sm">{data.summary}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.weeklyHighlights && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Top Performer</p>
                <p className="font-semibold text-green-600">{data.weeklyHighlights.topPerformer}</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Needs Attention</p>
                <p className="font-semibold text-amber-600">{data.weeklyHighlights.needsAttention}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Biggest Improvement</p>
                <p className="font-semibold text-blue-600">{data.weeklyHighlights.biggestImprovement}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {data.storeRankings && data.storeRankings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Store className="h-5 w-5 text-purple-500" />
                Store Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {data.storeRankings.map((store: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-muted-foreground">#{i + 1}</span>
                        <div>
                          <p className="font-medium">{store.storeName}</p>
                          <p className="text-xs text-muted-foreground">
                            Footfall: {store.footfallTrend} | Asset Health: {store.assetHealth}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={store.overallScore} className="w-16" />
                        <span className="font-medium">{store.overallScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Improvement Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.recommendations.slice(0, 5).map((rec: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium">{rec.storeName}</p>
                    <p className="text-sm text-muted-foreground">{rec.action}</p>
                    <p className="text-xs text-green-600 mt-1">Expected: {rec.expectedImpact}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderNSOInsights = (data: any) => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        {data.summary && (
          <Card className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-orange-500 mt-0.5" />
                <p className="text-sm">{data.summary}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.projectRisks && data.projectRisks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Project Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.projectRisks.map((project: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{project.storeName}</p>
                      <p className="text-xs text-muted-foreground">{project.reason}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        project.riskLevel === "high" ? "destructive" :
                        project.riskLevel === "medium" ? "secondary" : "default"
                      }>
                        {project.riskLevel} risk
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {project.predictedDelay ? `+${project.predictedDelay}` : "On track"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.criticalTasks && data.criticalTasks.length > 0 && (
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-500" />
                Critical Tasks to Monitor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.criticalTasks.slice(0, 5).map((task: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{task.taskName}</p>
                        <p className="text-xs text-muted-foreground">Phase: {task.phase}</p>
                      </div>
                      <Badge variant="outline">{task.riskFactor}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">💡 {task.mitigation}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.recommendations && data.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-orange-500">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderSchedulingInsights = (data: any) => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        {data.summary && (
          <Card className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 border-pink-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-pink-500 mt-0.5" />
                <p className="text-sm">{data.summary}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.peakHourAnalysis && data.peakHourAnalysis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-pink-500" />
                Peak Hour Staffing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.peakHourAnalysis.map((slot: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{slot.timeSlot}</p>
                      <p className="text-xs text-muted-foreground">Avg footfall: {slot.averageFootfall}</p>
                    </div>
                    <Badge>{slot.recommendedStaff} staff needed</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.schedulingRecommendations && data.schedulingRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Scheduling Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {data.schedulingRecommendations.map((rec: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{rec.storeName} - {rec.day}</p>
                        <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          <span className="text-muted-foreground">{rec.currentStaff}</span>
                          <span className="mx-1">→</span>
                          <span className="font-semibold text-green-600">{rec.recommendedStaff}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {data.workloadBalance && data.workloadBalance.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-500" />
                Workload Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.workloadBalance.slice(0, 5).map((emp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{emp.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{emp.action}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        <span className={emp.currentHours > emp.recommendedHours ? "text-destructive" : "text-muted-foreground"}>
                          {emp.currentHours}h
                        </span>
                        <span className="mx-1">→</span>
                        <span className="font-medium">{emp.recommendedHours}h</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderInsightContent = (type: InsightType) => {
    const data = insights[type];
    
    if (!data) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Click "Generate Insights" to analyze your data with AI</p>
        </div>
      );
    }

    if (data.parseError) {
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm whitespace-pre-wrap">{data.rawResponse}</p>
          </CardContent>
        </Card>
      );
    }

    switch (type) {
      case "asset_health":
        return renderAssetHealthInsights(data);
      case "inventory_forecast":
        return renderInventoryInsights(data);
      case "store_performance":
        return renderStoreInsights(data);
      case "nso_risk":
        return renderNSOInsights(data);
      case "employee_scheduling":
        return renderSchedulingInsights(data);
      default:
        return <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Insights Hub
          </h1>
          <p className="text-muted-foreground">
            Predictive analytics and intelligent recommendations powered by AI
          </p>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {insightCards.map((card) => (
          <Card 
            key={card.type}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => !loading && fetchInsights(card.type)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <card.icon className={`h-8 w-8 ${card.color}`} />
                {loading === card.type ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : insights[card.type] ? (
                  <Badge variant="outline" className="text-xs">Ready</Badge>
                ) : null}
              </div>
              <CardTitle className="text-sm mt-2">{card.title}</CardTitle>
              <CardDescription className="text-xs">{card.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Detailed Insights Tabs */}
      <Tabs defaultValue="asset_health" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="asset_health" className="text-xs">Assets</TabsTrigger>
          <TabsTrigger value="inventory_forecast" className="text-xs">Inventory</TabsTrigger>
          <TabsTrigger value="store_performance" className="text-xs">Stores</TabsTrigger>
          <TabsTrigger value="nso_risk" className="text-xs">NSO</TabsTrigger>
          <TabsTrigger value="employee_scheduling" className="text-xs">Scheduling</TabsTrigger>
        </TabsList>

        {insightCards.map((card) => (
          <TabsContent key={card.type} value={card.type} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <card.icon className={`h-5 w-5 ${card.color}`} />
                <h2 className="text-lg font-semibold">{card.title}</h2>
              </div>
              <Button 
                onClick={() => fetchInsights(card.type)}
                disabled={loading === card.type}
                size="sm"
              >
                {loading === card.type ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate Insights
                  </>
                )}
              </Button>
            </div>
            {renderInsightContent(card.type)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
