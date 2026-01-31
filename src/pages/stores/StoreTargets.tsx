import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Target, 
  Plus, 
  Edit, 
  Eye,
  TrendingUp,
  Calendar,
  Store,
  CheckCircle,
  FileText
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
];

const currentYear = new Date().getFullYear();
const fiscalYears = [currentYear - 1, currentYear, currentYear + 1];

export default function StoreTargets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFY, setSelectedFY] = useState(currentYear.toString());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState("");
  const [annualTarget, setAnnualTarget] = useState("");

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch store targets
  const { data: targets = [], isLoading } = useQuery({
    queryKey: ["store-targets", selectedFY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_targets")
        .select(`
          *,
          store:stores(id, name),
          months:store_target_months(*)
        `)
        .eq("fiscal_year", parseInt(selectedFY))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch actual sales for comparison
  const { data: actualSales = [] } = useQuery({
    queryKey: ["store-actuals", selectedFY],
    queryFn: async () => {
      const fyStart = new Date(parseInt(selectedFY), 3, 1); // April 1
      const fyEnd = new Date(parseInt(selectedFY) + 1, 2, 31, 23, 59, 59); // March 31

      const { data, error } = await supabase
        .from("orders")
        .select("store_id, total_amount, created_at")
        .eq("status", "completed")
        .gte("created_at", fyStart.toISOString())
        .lte("created_at", fyEnd.toISOString());
      
      if (error) throw error;

      // Aggregate by store
      const storeActuals: Record<string, number> = {};
      data.forEach((order) => {
        if (order.store_id) {
          storeActuals[order.store_id] = (storeActuals[order.store_id] || 0) + Number(order.total_amount);
        }
      });

      return storeActuals;
    },
  });

  // Create target mutation
  const createTargetMutation = useMutation({
    mutationFn: async () => {
      const target = parseFloat(annualTarget);
      if (!selectedStore || !target) throw new Error("Please fill all fields");

      // Create target
      const { data: newTarget, error: targetError } = await supabase
        .from("store_targets")
        .insert({
          store_id: selectedStore,
          fiscal_year: parseInt(selectedFY),
          annual_target: target,
          status: "draft",
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (targetError) throw targetError;

      // Create equal monthly splits
      const monthlyTarget = target / 12;
      const monthlyData = MONTHS.map((_, index) => ({
        store_target_id: newTarget.id,
        month: index + 1,
        target_amount: monthlyTarget,
      }));

      const { error: monthsError } = await supabase
        .from("store_target_months")
        .insert(monthlyData as any);

      if (monthsError) throw monthsError;

      return newTarget;
    },
    onSuccess: () => {
      toast.success("Store target created");
      setIsCreateDialogOpen(false);
      setSelectedStore("");
      setAnnualTarget("");
      queryClient.invalidateQueries({ queryKey: ["store-targets"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create target");
    },
  });

  // Calculate progress percentage
  const getProgress = (storeId: string, annualTarget: number) => {
    const actual = Number((actualSales as Record<string, number>)[storeId] || 0);
    return annualTarget > 0 ? (actual / annualTarget) * 100 : 0;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "draft": return "bg-yellow-100 text-yellow-800";
      case "archived": return "bg-gray-100 text-gray-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const storesWithoutTargets = stores.filter(
    (store) => !targets.some((t: any) => t.store_id === store.id)
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Store Targets</h1>
          <p className="text-muted-foreground">Set and track annual sales targets by store</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedFY} onValueChange={setSelectedFY}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Fiscal Year" />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  FY {year}-{(year + 1).toString().slice(-2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => navigate("/stores/targets/dashboard")}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Target
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Annual Target</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{targets.reduce((sum, t: any) => sum + Number(t.annual_target), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{targets.length} stores</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actuals</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ₹{Object.values(actualSales as Record<string, number>).reduce((sum, v) => sum + v, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">YTD Sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Targets</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {targets.filter((t: any) => t.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">of {targets.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stores Without Target</CardTitle>
            <Store className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {storesWithoutTargets.length}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Targets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Store Targets - FY {selectedFY}-{(parseInt(selectedFY) + 1).toString().slice(-2)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Annual Target</TableHead>
                <TableHead className="text-right">YTD Actual</TableHead>
                <TableHead className="text-right">Achievement</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((target: any) => {
                const actual = actualSales[target.store_id as keyof typeof actualSales] || 0;
                const progress = getProgress(target.store_id, target.annual_target);
                
                return (
                  <TableRow key={target.id}>
                    <TableCell>
                      <div className="font-medium">{target.store?.name}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{Number(target.annual_target).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      ₹{Number(actual).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              progress >= 100 ? "bg-green-500" : 
                              progress >= 75 ? "bg-blue-500" : 
                              progress >= 50 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12">{progress.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getStatusColor(target.status)}>{target.status}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => navigate(`/stores/targets/${target.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => navigate(`/stores/targets/${target.id}/details`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {targets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No targets set for FY {selectedFY}-{(parseInt(selectedFY) + 1).toString().slice(-2)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Target Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Create Store Target
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Store</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {storesWithoutTargets.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fiscal Year</Label>
              <Input value={`FY ${selectedFY}-${(parseInt(selectedFY) + 1).toString().slice(-2)}`} disabled />
            </div>

            <div className="space-y-2">
              <Label>Annual Target (₹)</Label>
              <Input
                type="number"
                placeholder="Enter annual target amount"
                value={annualTarget}
                onChange={(e) => setAnnualTarget(e.target.value)}
              />
              {annualTarget && (
                <p className="text-xs text-muted-foreground">
                  Monthly target: ₹{(parseFloat(annualTarget) / 12).toLocaleString()} (equal split)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createTargetMutation.mutate()}
              disabled={!selectedStore || !annualTarget || createTargetMutation.isPending}
            >
              {createTargetMutation.isPending ? "Creating..." : "Create Target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
