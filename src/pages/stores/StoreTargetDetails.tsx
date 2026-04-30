import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Save, 
  Target, 
  Calendar, 
  Users, 
  Package,
  RefreshCw,
  CheckCircle
} from "lucide-react";

const MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
];

export default function StoreTargetDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [monthlyTargets, setMonthlyTargets] = useState<Record<number, string>>({});
  const [memberTargets, setMemberTargets] = useState<Record<string, string>>({});
  const [productTargets, setProductTargets] = useState<Record<string, { qty: string; amount: string }>>({});

  // Fetch target details
  const { data: target, isLoading } = useQuery({
    queryKey: ["store-target", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_targets")
        .select(`
          *,
          store:stores(id, name),
          months:store_target_months(*),
          members:store_target_members(*, employee:employees(id, name)),
          products:store_target_products(*, product:products(id, name, price))
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch store employees
  const { data: employees = [] } = useQuery({
    queryKey: ["store-employees", target?.store_id],
    queryFn: async () => {
      if (!target?.store_id) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("store_id", target.store_id)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!target?.store_id,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r, price: Number(r.selling_price ?? 0) }));
    },
  });

  // Initialize state from fetched data
  useEffect(() => {
    if (target) {
      // Monthly targets
      const months: Record<number, string> = {};
      target.months?.forEach((m: any) => {
        months[m.month] = m.target_amount.toString();
      });
      setMonthlyTargets(months);

      // Member targets
      const members: Record<string, string> = {};
      target.members?.forEach((m: any) => {
        members[m.employee_id] = m.target_amount.toString();
      });
      setMemberTargets(members);

      // Product targets
      const prods: Record<string, { qty: string; amount: string }> = {};
      target.products?.forEach((p: any) => {
        prods[p.product_id] = {
          qty: p.target_quantity.toString(),
          amount: p.target_amount.toString(),
        };
      });
      setProductTargets(prods);
    }
  }, [target]);

  // Save monthly targets
  const saveMonthlyMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(monthlyTargets).map(([month, amount]) => ({
        store_target_id: id,
        month: parseInt(month),
        target_amount: parseFloat(amount) || 0,
      }));

      // Delete existing and insert new
      await supabase.from("store_target_months").delete().eq("store_target_id", id);
      const { error } = await supabase.from("store_target_months").insert(updates as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Monthly targets saved");
      queryClient.invalidateQueries({ queryKey: ["store-target", id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save");
    },
  });

  // Save member targets
  const saveMembersMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(memberTargets)
        .filter(([_, amount]) => parseFloat(amount) > 0)
        .map(([employeeId, amount]) => ({
          store_target_id: id,
          employee_id: employeeId,
          target_amount: parseFloat(amount),
        }));

      await supabase.from("store_target_members").delete().eq("store_target_id", id);
      if (updates.length > 0) {
        const { error } = await supabase.from("store_target_members").insert(updates as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Member targets saved");
      queryClient.invalidateQueries({ queryKey: ["store-target", id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save");
    },
  });

  // Save product targets
  const saveProductsMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(productTargets)
        .filter(([_, data]) => parseFloat(data.amount) > 0)
        .map(([productId, data]) => ({
          store_target_id: id,
          product_id: productId,
          target_quantity: parseInt(data.qty) || 0,
          target_amount: parseFloat(data.amount),
        }));

      await supabase.from("store_target_products").delete().eq("store_target_id", id);
      if (updates.length > 0) {
        const { error } = await supabase.from("store_target_products").insert(updates as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Product targets saved");
      queryClient.invalidateQueries({ queryKey: ["store-target", id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save");
    },
  });

  // Activate target
  const activateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("store_targets")
        .update({ status: "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Target activated");
      queryClient.invalidateQueries({ queryKey: ["store-target", id] });
    },
  });

  // Distribute annual target equally
  const distributeEqually = () => {
    if (!target) return;
    const monthlyAmount = target.annual_target / 12;
    const newTargets: Record<number, string> = {};
    for (let i = 1; i <= 12; i++) {
      newTargets[i] = monthlyAmount.toFixed(2);
    }
    setMonthlyTargets(newTargets);
  };

  // Distribute among members equally
  const distributeMembersEqually = () => {
    if (!target || employees.length === 0) return;
    const memberAmount = target.annual_target / employees.length;
    const newTargets: Record<string, string> = {};
    employees.forEach((emp) => {
      newTargets[emp.id] = memberAmount.toFixed(2);
    });
    setMemberTargets(newTargets);
  };

  if (isLoading || !target) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const monthlyTotal = Object.values(monthlyTargets).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const memberTotal = Object.values(memberTargets).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const productTotal = Object.values(productTargets).reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/stores/targets")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{target.store?.name}</h1>
            <p className="text-muted-foreground">
              FY {target.fiscal_year}-{(target.fiscal_year + 1).toString().slice(-2)} Target: ₹{Number(target.annual_target).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={target.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
            {target.status}
          </Badge>
          {target.status === "draft" && (
            <Button onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Activate Target
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly" className="gap-2">
            <Calendar className="h-4 w-4" />
            Monthly Split
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Team Members
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
        </TabsList>

        {/* Monthly Split Tab */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Monthly Target Breakdown
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={distributeEqually}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Equal Split
                  </Button>
                  <Button size="sm" onClick={() => saveMonthlyMutation.mutate()} disabled={saveMonthlyMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                {MONTHS.map((month, index) => (
                  <div key={month} className="space-y-2">
                    <Label className="text-xs">{month}</Label>
                    <Input
                      type="number"
                      value={monthlyTargets[index + 1] || ""}
                      onChange={(e) => setMonthlyTargets({ ...monthlyTargets, [index + 1]: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Monthly Targets:</span>
                <span className={`font-bold ${Math.abs(monthlyTotal - target.annual_target) < 1 ? "text-green-600" : "text-orange-600"}`}>
                  ₹{monthlyTotal.toLocaleString()} / ₹{Number(target.annual_target).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Member Targets
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={distributeMembersEqually}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Equal Split
                  </Button>
                  <Button size="sm" onClick={() => saveMembersMutation.mutate()} disabled={saveMembersMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No employees assigned to this store
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead className="text-right">Annual Target (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.name}</TableCell>
                          <TableCell>{emp.position}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-32 ml-auto"
                              value={memberTargets[emp.id] || ""}
                              onChange={(e) => setMemberTargets({ ...memberTargets, [emp.id]: e.target.value })}
                              placeholder="0"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Separator className="my-4" />
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Member Targets:</span>
                    <span className={`font-bold ${Math.abs(memberTotal - target.annual_target) < 1 ? "text-green-600" : "text-orange-600"}`}>
                      ₹{memberTotal.toLocaleString()} / ₹{Number(target.annual_target).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Product-wise Targets
                </CardTitle>
                <Button size="sm" onClick={() => saveProductsMutation.mutate()} disabled={saveProductsMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Target Qty</TableHead>
                    <TableHead className="text-right">Target Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.slice(0, 20).map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell className="font-medium">{prod.name}</TableCell>
                      <TableCell>{prod.category}</TableCell>
                      <TableCell className="text-right">₹{prod.price}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-20 ml-auto"
                          value={productTargets[prod.id]?.qty || ""}
                          onChange={(e) => {
                            const qty = e.target.value;
                            const amount = (parseInt(qty) || 0) * prod.price;
                            setProductTargets({
                              ...productTargets,
                              [prod.id]: { qty, amount: amount.toString() },
                            });
                          }}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-28 ml-auto"
                          value={productTargets[prod.id]?.amount || ""}
                          onChange={(e) => setProductTargets({
                            ...productTargets,
                            [prod.id]: { ...productTargets[prod.id], amount: e.target.value },
                          })}
                          placeholder="0"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Product Targets:</span>
                <span className="font-bold">₹{productTotal.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
