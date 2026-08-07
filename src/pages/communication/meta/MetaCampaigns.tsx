import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { BackButton } from "@/components/shared/BackButton";
import { Copy, Loader2, MoreHorizontal, Pause, Play, Plus, Rocket, Trash2 } from "lucide-react";

const OBJECTIVES = [
  ["awareness", "Awareness"], ["traffic", "Traffic"], ["engagement", "Engagement"],
  ["leads", "Leads"], ["sales", "Sales"], ["app_promotion", "App Promotion"], ["conversions", "Conversions"],
];
const SPECIAL_CATEGORIES = [["none", "None"], ["housing", "Housing"], ["employment", "Employment"], ["credit", "Credit"]];

const emptyForm = {
  name: "", objective: "awareness", buying_type: "auction", budget_type: "daily",
  budget_amount: "", status: "draft", special: "none", start_date: "", end_date: "",
};

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function MetaCampaigns() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("social_campaigns").select("*").eq("platform", "meta").order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      name: r.name, objective: r.objective, buying_type: r.buying_type, budget_type: r.budget_type,
      budget_amount: String(r.budget_amount ?? ""), status: r.status,
      special: r.special_ad_categories?.[0] || "none",
      start_date: r.start_date ? r.start_date.slice(0, 10) : "",
      end_date: r.end_date ? r.end_date.slice(0, 10) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Campaign name is required", variant: "destructive" }); return; }
    setSaving(true);
    const { data: conn } = await supabase.from("social_connections").select("id,default_ad_account_id").eq("platform", "meta").maybeSingle();
    const payload = {
      platform: "meta",
      connection_id: conn?.id ?? null,
      ad_account_id: conn?.default_ad_account_id ?? null,
      name: form.name.trim(),
      objective: form.objective,
      buying_type: form.buying_type,
      budget_type: form.budget_type,
      budget_amount: Number(form.budget_amount || 0),
      status: form.status,
      special_ad_categories: form.special === "none" ? [] : [form.special],
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
    };
    const { error } = editId
      ? await supabase.from("social_campaigns").update(payload).eq("id", editId)
      : await supabase.from("social_campaigns").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Campaign updated" : "Campaign created" });
    setOpen(false);
    load();
  };

  const callApi = async (action: string, campaign_id: string, okMsg: string) => {
    setBusyId(campaign_id);
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, payload: { campaign_id } } });
    setBusyId(null);
    if (error || data?.error) {
      toast({ title: "Action failed", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: okMsg, description: data?.campaign_id ? `Campaign ID: ${data.campaign_id}` : undefined });
    load();
  };

  const duplicate = async (r: any) => {
    const { id, external_id, published_at, created_at, updated_at, last_synced_at, ...rest } = r;
    const { error } = await supabase.from("social_campaigns").insert({ ...rest, name: `${r.name} (copy)`, status: "draft" });
    if (error) toast({ title: "Could not duplicate", description: error.message, variant: "destructive" });
    else { toast({ title: "Campaign duplicated" }); load(); }
  };

  const statusColor = (s: string) =>
    s === "active" ? "default" : s === "paused" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Plan campaigns as drafts and publish them to Meta when ready.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Create Campaign</Button>
      </div>

      <Card className="rounded-xl">
        <CardHeader><CardTitle>All Campaigns</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No campaigns yet. Create your first campaign.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Objective</TableHead>
                    <TableHead>Buying Type</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Meta ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => openEdit(r)}>
                      <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
                      <TableCell className="capitalize">{r.objective.replace("_", " ")}</TableCell>
                      <TableCell className="capitalize">{r.buying_type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="whitespace-nowrap">{inr(Number(r.budget_amount))} <span className="text-muted-foreground">/ {r.budget_type}</span></TableCell>
                      <TableCell><Badge variant={statusColor(r.status) as any} className="capitalize">{r.status}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.external_id || "—"}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={busyId === r.id}>
                              {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(r)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicate(r)} className="gap-2"><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => callApi("publish_campaign", r.id, r.external_id ? "Campaign republished" : "Campaign published")}
                              className="gap-2"
                            >
                              <Rocket className="h-4 w-4" /> {r.external_id ? "Republish Changes" : "Publish"}
                            </DropdownMenuItem>
                            {r.external_id && r.status === "active" && (
                              <DropdownMenuItem onClick={() => callApi("pause_campaign", r.id, "Campaign paused")} className="gap-2">
                                <Pause className="h-4 w-4" /> Pause
                              </DropdownMenuItem>
                            )}
                            {r.external_id && r.status !== "active" && (
                              <DropdownMenuItem onClick={() => callApi("resume_campaign", r.id, "Campaign resumed")} className="gap-2">
                                <Play className="h-4 w-4" /> Resume
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => callApi("delete_campaign", r.id, "Campaign deleted")}
                              className="gap-2 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? "Edit Campaign" : "Create Campaign"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Campaign Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="text-base" />
            </div>
            <div className="space-y-1.5">
              <Label>Campaign Objective</Label>
              <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OBJECTIVES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Buying Type</Label>
              <Select value={form.buying_type} onValueChange={(v) => setForm({ ...form, buying_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auction">Auction</SelectItem>
                  <SelectItem value="reach_and_frequency">Reach &amp; Frequency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Budget Type</Label>
              <Select value={form.budget_type} onValueChange={(v) => setForm({ ...form, budget_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Budget</SelectItem>
                  <SelectItem value="lifetime">Lifetime Budget</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Budget Amount (₹)</Label>
              <Input type="number" min="0" value={form.budget_amount}
                onChange={(e) => setForm({ ...form, budget_amount: e.target.value })} className="text-base" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Special Ad Categories</Label>
              <Select value={form.special} onValueChange={(v) => setForm({ ...form, special: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SPECIAL_CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="text-base" />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="text-base" />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editId ? "Save Changes" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}