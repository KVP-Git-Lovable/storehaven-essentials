import { useState } from "react";
import { Plus, Search, Wallet, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { expenseSchema, type ExpenseFormData } from "@/lib/schemas";

const stores = ["Downtown Store", "Mall Outlet", "Airport Kiosk", "Suburban Store", "Highway Express"];
const expenseCategories = ["Maintenance", "Supplies", "Transport", "Refreshments", "Utilities", "Miscellaneous"];

const initialTransactions = [
  { id: "TXN-001", date: "2024-03-20", store: "Downtown Store", category: "Maintenance", description: "Plumbing repair", amount: -2500, type: "expense" },
  { id: "TXN-002", date: "2024-03-19", store: "Mall Outlet", category: "Supplies", description: "Cleaning supplies", amount: -1800, type: "expense" },
  { id: "TXN-003", date: "2024-03-18", store: "Downtown Store", category: "Replenishment", description: "Monthly top-up", amount: 10000, type: "credit" },
  { id: "TXN-004", date: "2024-03-17", store: "Airport Kiosk", category: "Transport", description: "Courier charges", amount: -650, type: "expense" },
  { id: "TXN-005", date: "2024-03-16", store: "Suburban Store", category: "Refreshments", description: "Staff tea/coffee", amount: -1200, type: "expense" },
];

const stats = [
  { title: "Total Balance", value: "₹1.25L", icon: Wallet, iconColor: "bg-primary/10 text-primary" },
  { title: "This Month Expenses", value: "₹45.2K", icon: TrendingDown, iconColor: "bg-destructive/10 text-destructive" },
  { title: "Replenishments", value: "₹50K", icon: TrendingUp, iconColor: "bg-success/10 text-success" },
  { title: "Transactions", value: "156", icon: Receipt, iconColor: "bg-info/10 text-info" },
];

export default function PettyCash() {
  const [searchQuery, setSearchQuery] = useState("");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      store: "",
      category: "",
      description: "",
      amount: 0,
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    const newTransaction = {
      id: `TXN-${String(transactions.length + 1).padStart(3, "0")}`,
      date: new Date().toISOString().split("T")[0],
      store: data.store,
      category: data.category,
      description: data.description,
      amount: -data.amount,
      type: "expense" as const,
    };
    setTransactions([newTransaction, ...transactions]);
    form.reset();
    setOpen(false);
    toast({
      title: "Expense recorded",
      description: `₹${data.amount.toLocaleString()} expense has been recorded.`,
    });
  };

  const filteredTransactions = transactions.filter(
    (txn) =>
      txn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.store.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Petty Cash Management</h1>
          <p className="text-muted-foreground">Track store-level expenses</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Record Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Record New Expense</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="store"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select store" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {stores.map((store) => (
                            <SelectItem key={store} value={store}>{store}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="What was this expense for?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter amount" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Record Expense</Button>
                </div>
              </form>
            </Form>
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
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell className="font-mono text-sm">{txn.id}</TableCell>
                <TableCell>{new Date(txn.date).toLocaleDateString()}</TableCell>
                <TableCell>{txn.store}</TableCell>
                <TableCell>
                  <Badge variant="outline">{txn.category}</Badge>
                </TableCell>
                <TableCell>{txn.description}</TableCell>
                <TableCell className={`text-right font-medium ${txn.amount > 0 ? "text-success" : "text-destructive"}`}>
                  {txn.amount > 0 ? "+" : ""}₹{Math.abs(txn.amount).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
