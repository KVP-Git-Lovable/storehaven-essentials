import { useState, useEffect } from "react";
import { Plus, Search, Wallet, TrendingDown, ChevronDown, ChevronRight, Loader2, Trash2, Store } from "lucide-react";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/dashboard/StatCard";
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
import { Link } from "react-router-dom";

type StoreType = {
  id: string;
  name: string;
};

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
  store?: StoreType;
  expenses?: PettyCashExpense[];
  total_spent?: number;
  available?: number;
};

const expenseTypes = ["Maintenance", "Supplies", "Transport", "Refreshments", "Utilities", "Office", "Miscellaneous"];
const paymentStatuses = ["pending", "paid", "approved", "rejected"];

export default function PettyCash() {
  const [searchQuery, setSearchQuery] = useState("");
  const [pettyCashList, setPettyCashList] = useState<PettyCash[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pcDialogOpen, setPcDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedPettyCashId, setSelectedPettyCashId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();

  const [pcForm, setPcForm] = useState({ store_id: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), description: "" });
  const [expenseForm, setExpenseForm] = useState({
    description: "", expense_type: "", amount: "", date: format(new Date(), "yyyy-MM-dd"),
    vendor_id: "", spent_by: "", payment_status: "pending", notes: ""
  });

  useEffect(() => {
    if (!accessLoading) {
      fetchData();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchData = async () => {
    setLoading(true);
    const storeIds = Array.from(accessibleStoreIds);
    
    // Build petty cash query with store filter
    let pcQuery = supabase.from("petty_cash").select("*").order("date", { ascending: false });
    if (!isAdmin && storeIds.length > 0) {
      pcQuery = pcQuery.in("store_id", storeIds);
    }
    
    const [pcRes, expensesRes, storesRes, vendorsRes] = await Promise.all([
      pcQuery,
      supabase.from("petty_cash_expenses").select("*, vendor:vendors(id, name)"),
      supabase.from("stores").select("id, name").order("name"),
      supabase.from("vendors").select("id, name").order("name"),
    ]);

    if (pcRes.error) {
      toast({ title: "Error", description: "Failed to load petty cash", variant: "destructive" });
    } else {
      const storesMap = new Map((storesRes.data || []).map(s => [s.id, s]));
      const expenses = (expensesRes.data || []) as PettyCashExpense[];
      const enrichedPC = (pcRes.data || []).map(pc => {
        const pcExpenses = expenses.filter(e => e.petty_cash_id === pc.id);
        const totalSpent = pcExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        return {
          ...pc,
          store: storesMap.get(pc.store_id),
          expenses: pcExpenses,
          total_spent: totalSpent,
          available: Number(pc.amount) - totalSpent,
        };
      });
      setPettyCashList(enrichedPC);
    }
    // Filter stores for non-admins
    const allStores = storesRes.data || [];
    setStores(isAdmin ? allStores : allStores.filter(s => accessibleStoreIds.has(s.id)));
    setVendors(vendorsRes.data || []);
    setLoading(false);
  };

  const handleAddPettyCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pcForm.store_id || !pcForm.amount || !pcForm.date) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("petty_cash").insert({
      store_id: pcForm.store_id,
      amount: parseFloat(pcForm.amount),
      date: pcForm.date,
      description: pcForm.description || null,
      created_by: "Current User",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add petty cash", variant: "destructive" });
    } else {
      toast({ title: "Petty cash added" });
      setPcForm({ store_id: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), description: "" });
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
  const totalTransactions = pettyCashList.reduce((sum, pc) => sum + (pc.expenses?.length || 0), 0);

  const filteredPettyCash = pettyCashList.filter((pc) =>
    pc.store?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pc.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    { title: "Total Allocated", value: `₹${(totalAllocated / 1000).toFixed(1)}K`, icon: Wallet, iconColor: "bg-primary/10 text-primary" },
    { title: "Total Spent", value: `₹${(totalSpent / 1000).toFixed(1)}K`, icon: TrendingDown, iconColor: "bg-destructive/10 text-destructive" },
    { title: "Available", value: `₹${(totalAvailable / 1000).toFixed(1)}K`, icon: Wallet, iconColor: "bg-green-100 text-green-600" },
    { title: "Transactions", value: totalTransactions.toString(), icon: Store, iconColor: "bg-info/10 text-info" },
  ];

  if (loading || accessLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Petty Cash Management</h1>
          <p className="text-muted-foreground">Track store-level petty cash and expenses</p>
        </div>
        <Dialog open={pcDialogOpen} onOpenChange={setPcDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Petty Cash
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Add Petty Cash</DialogTitle></DialogHeader>
            <form onSubmit={handleAddPettyCash} className="space-y-4">
              <div className="space-y-2">
                <Label>Store *</Label>
                <Select value={pcForm.store_id} onValueChange={(v) => setPcForm(prev => ({ ...prev, store_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by store or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Petty Cash List with Expenses */}
      <div className="space-y-3">
        {filteredPettyCash.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 border rounded-xl bg-card">No petty cash records</div>
        ) : (
          filteredPettyCash.map((pc) => (
            <Collapsible key={pc.id} open={expandedItems.has(pc.id)} onOpenChange={() => toggleExpand(pc.id)}>
              <div className="border rounded-xl bg-card overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      {expandedItems.has(pc.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Wallet className="h-5 w-5 text-primary" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">₹{Number(pc.amount).toLocaleString()}</p>
                          <Link to={`/stores/${pc.store_id}`} className="text-sm text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                            {pc.store?.name || "Unknown Store"}
                          </Link>
                        </div>
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
