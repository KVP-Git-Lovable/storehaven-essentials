import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Search } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { toast } from "sonner";

const segmentColors: Record<string, string> = {
  customer: "bg-green-100 text-green-800",
  prospect: "bg-blue-100 text-blue-800",
  esdb: "bg-purple-100 text-purple-800",
};

export default function ContactsManager() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState("all");
  const [form, setForm] = useState({
    name: "", email: "", phone: "", city: "", date_of_birth: "",
    last_purchase_date: "", segment_type: "customer",
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["journey-contacts", segFilter],
    queryFn: async () => {
      let q = supabase.from("journey_contacts").select("*").order("created_at", { ascending: false });
      if (segFilter !== "all") q = q.eq("segment_type", segFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = contacts.filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.city?.toLowerCase().includes(search.toLowerCase())
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("journey_contacts").insert({
        ...form,
        date_of_birth: form.date_of_birth || null,
        last_purchase_date: form.last_purchase_date || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact added");
      setShowAdd(false);
      setForm({ name: "", email: "", phone: "", city: "", date_of_birth: "", last_purchase_date: "", segment_type: "customer" });
      queryClient.invalidateQueries({ queryKey: ["journey-contacts"] });
    },
    onError: () => toast.error("Failed to add contact"),
  });

  const toggleOptOut = useMutation({
    mutationFn: async ({ id, opted_out }: { id: string; opted_out: boolean }) => {
      const { error } = await supabase.from("journey_contacts").update({ opted_out }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journey-contacts"] }),
  });

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">Manage your audience database for journey targeting</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" /> Add Contact</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={segFilter} onValueChange={setSegFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Segments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="prospect">Prospects</SelectItem>
            <SelectItem value="esdb">ESDB</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Opted Out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No contacts found</TableCell></TableRow>
            ) : filtered.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.city || "—"}</TableCell>
                <TableCell><Badge className={segmentColors[c.segment_type] || ""}>{c.segment_type}</Badge></TableCell>
                <TableCell>
                  <Switch checked={c.opted_out} onCheckedChange={(v) => toggleOptOut.mutate({ id: c.id, opted_out: v })} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Segment</Label>
                <Select value={form.segment_type} onValueChange={(v) => setForm({ ...form, segment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="esdb">ESDB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
              <div><Label>Last Purchase Date</Label><Input type="date" value={form.last_purchase_date} onChange={(e) => setForm({ ...form, last_purchase_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!form.name || !form.email || !form.phone || addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
