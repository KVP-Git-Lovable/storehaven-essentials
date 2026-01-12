import { useState, useEffect } from "react";
import { Plus, Loader2, Wallet, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Vendor = {
  id: string;
  name: string;
};

type PettyCashExpense = {
  id: string;
  petty_cash_id: string;
  description: string;
  expense_type: string;
  amount: number;
  date: string;
  vendor_id: string | null;
  spent_by: string;
  payment_status: string;
  notes: string | null;
  vendor?: Vendor;
};

type PettyCash = {
  id: string;
  store_id: string;
  amount: number;
  date: string;
  description: string | null;
  created_by: string;
  expenses?: PettyCashExpense[];
  total_spent?: number;
  available?: number;
};

type StorePettyCashTabProps = {
  storeId: string;
};

const expenseTypes = ["Maintenance", "Supplies", "Transport", "Refreshments", "Utilities", "Office", "Miscellaneous"];
const paymentStatuses = ["pending", "paid", "approved", "rejected"];

export function StorePettyCashTab({ storeId }: StorePettyCashTabProps) {
  const [pettyCashList, setPettyCashList] = useState<PettyCash[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pcDialogOpen, setPcDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedPettyCashId, setSelectedPettyCashId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [pcForm, setPcForm] = useState({ amount: "", date: format(new Date(), "yyyy-MM-dd"), description: "" });
  const [expenseForm, setExpenseForm] = useState({
    description: "", expense_type: "", amount: "", date: format(new Date(), "yyyy-MM-dd"),
    vendor_id: "", spent_by: "", payment_status: "pending", notes: ""
  });

  useEffect(() => {
    fetchData();
  }, [storeId]);

  const fetchData = async () => {
    setLoading(true);
    const [pcRes, expensesRes, vendorsRes] = await Promise.all([
      supabase.from("petty_cash").select("*").eq("store_id", storeId).order("date", { ascending: false }),
      supabase.from("petty_cash_expenses").select("*, vendor:vendors(id, name)"),
      supabase.from("vendors").select("id, name").order("name"),
    ]);

    if (pcRes.error) {
      toast({ title: "Error", description: "Failed to load petty cash", variant: "destructive" });
    } else {
      const expenses = (expensesRes.data || []) as PettyCashExpense[];
      const enrichedPC = (pcRes.data || []).map(pc => {
        const pcExpenses = expenses.filter(e => e.petty_cash_id === pc.id);
        const totalSpent = pcExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        return {
          ...pc,
          expenses: pcExpenses,
          total_spent: totalSpent,
          available: Number(pc.amount) - totalSpent,
        };
      });
      setPettyCashList(enrichedPC);
    }
    setVendors(vendorsRes.data || []);
    setLoading(false);
  };

  const handleAddPettyCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pcForm.amount || !pcForm.date) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("petty_cash").insert({
      store_id: storeId,
      amount: parseFloat(pcForm.amount),
      date: pcForm.date,
      description: pcForm.description || null,
      created_by: "Current User",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add petty cash", variant: "destructive" });
    } else {
      toast({ title: "Petty cash added" });
      setPcForm({ amount: "", date: format(new Date(), "yyyy-MM-dd"), description: "" });
      setPcDialogOpen(false);
      fetchData();
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.expense_type || !expenseForm.amount || !expenseForm.date || !expenseForm.spent_by || !selectedPettyCashId) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("petty_cash_expenses").insert({
      petty_cash_id: selectedPettyCashId,
      description: expenseForm.description,
      expense_type: expenseForm.expense_type,
      amount: parseFloat(expenseForm.amount),
      date: expenseForm.date,
      vendor_id: expenseForm.vendor_id || null,
      spent_by: expenseForm.spent_by,
      payment_status: expenseForm.payment_status,
      notes: expenseForm.notes || null,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add expense", variant: "destructive" });
    } else {
      toast({ title: "Expense added" });
      setExpenseForm({
        description: "", expense_type: "", amount: "", date: format(new Date(), "yyyy-MM-dd"),
        vendor_id: "", spent_by: "", payment_status: "pending", notes: ""
      });
      setExpenseDialogOpen(false);
      setSelectedPettyCashId(null);
      fetchData();
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const { error } = await supabase.from("petty_cash_expenses").delete().eq("id", expenseId);
    if (!error) {
      toast({ title: "Expense deleted" });
      fetchData();
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const openExpenseDialog = (pcId: string) => {
    setSelectedPettyCashId(pcId);
    setExpenseDialogOpen(true);
  };

  const totalAllocated = pettyCashList.reduce((sum, pc) => sum + Number(pc.amount), 0);
  const totalSpent = pettyCashList.reduce((sum, pc) => sum + (pc.total_spent || 0), 0);
  const totalAvailable = totalAllocated - totalSpent;

  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Petty Cash</h2>
        <Dialog open={pcDialogOpen} onOpenChange={setPcDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Petty Cash</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>Add Petty Cash</DialogTitle></DialogHeader>
            <form onSubmit={handleAddPettyCash} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (₹) *</Label>
                  <Input type="number" placeholder="Enter amount" value={pcForm.amount}
                    onChange={(e) => setPcForm(prev => ({ ...prev, amount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={pcForm.date}
                    onChange={(e) => setPcForm(prev => ({ ...prev, date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Notes about this petty cash" value={pcForm.description}
                  onChange={(e) => setPcForm(prev => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setPcDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Add</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Allocated</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">₹{totalAllocated.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Spent</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-destructive">₹{totalSpent.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Available</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-green-600">₹{totalAvailable.toLocaleString()}</p></CardContent>
        </Card>
      </div>

      {/* Petty Cash List with Expenses */}
      <div className="space-y-3">
        {pettyCashList.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 border rounded-xl bg-card">No petty cash records</div>
        ) : (
          pettyCashList.map((pc) => (
            <Collapsible key={pc.id} open={expandedItems.has(pc.id)} onOpenChange={() => toggleExpand(pc.id)}>
              <div className="border rounded-xl bg-card overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      {expandedItems.has(pc.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Wallet className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">₹{Number(pc.amount).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(pc.date), "PP")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm">Spent: <span className="text-destructive font-medium">₹{(pc.total_spent || 0).toLocaleString()}</span></p>
                        <p className="text-sm">Available: <span className="text-green-600 font-medium">₹{(pc.available || 0).toLocaleString()}</span></p>
                      </div>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openExpenseDialog(pc.id); }}>
                        <Plus className="h-3 w-3 mr-1" />Expense
                      </Button>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-4 py-3">
                    {!pc.expenses || pc.expenses.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No expenses recorded</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Spent By</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pc.expenses.map((exp) => (
                            <TableRow key={exp.id}>
                              <TableCell>{format(new Date(exp.date), "PP")}</TableCell>
                              <TableCell className="font-medium">{exp.description}</TableCell>
                              <TableCell><Badge variant="outline">{exp.expense_type}</Badge></TableCell>
                              <TableCell>{exp.vendor?.name || "-"}</TableCell>
                              <TableCell>{exp.spent_by}</TableCell>
                              <TableCell>
                                <Badge variant={exp.payment_status === "paid" || exp.payment_status === "approved" ? "default" : "secondary"}>
                                  {exp.payment_status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium text-destructive">-₹{Number(exp.amount).toLocaleString()}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(exp.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))
        )}
      </div>

      {/* Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={(o) => { setExpenseDialogOpen(o); if (!o) setSelectedPettyCashId(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input placeholder="What was this expense for?" value={expenseForm.description}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expense Type *</Label>
                <Select value={expenseForm.expense_type} onValueChange={(v) => setExpenseForm(prev => ({ ...prev, expense_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {expenseTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={expenseForm.date}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input type="number" placeholder="Amount" value={expenseForm.amount}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Spent By *</Label>
                <Input placeholder="Name" value={expenseForm.spent_by}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, spent_by: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select value={expenseForm.vendor_id || "_none"} onValueChange={(v) => setExpenseForm(prev => ({ ...prev, vendor_id: v === "_none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={expenseForm.payment_status} onValueChange={(v) => setExpenseForm(prev => ({ ...prev, payment_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentStatuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Additional notes" value={expenseForm.notes}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setExpenseDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Add Expense</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
