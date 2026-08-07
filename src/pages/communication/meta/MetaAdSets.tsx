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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { BackButton } from "@/components/shared/BackButton";
import { Loader2, MoreHorizontal, Pause, Play, Plus, Rocket, Trash2 } from "lucide-react";

const OPTIMIZATION_GOALS = [
  ["IMPRESSIONS", "Impressions"],
  ["REACH", "Reach"],
  ["LINK_CLICKS", "Link Clicks"],
  ["POST_ENGAGEMENT", "Post Engagement"],
  ["THRUPLAY", "Video Views (ThruPlay)"],
  ["OFFSITE_CONVERSIONS", "Conversions"],
  ["LEAD_GENERATION", "Leads"],
  ["APP_INSTALLS", "App Installs"],
  ["LANDING_PAGE_VIEWS", "Landing Page Views"],
];

const BILLING_EVENTS = [
  ["IMPRESSIONS", "Impressions"],
  ["LINK_CLICKS", "Link Clicks"],
  ["POST_ENGAGEMENT", "Post Engagement"],
  ["THRUPLAY", "ThruPlay"],
];

const BID_STRATEGIES = [
  ["LOWEST_COST_WITHOUT_CAP", "Lowest Cost"],
  ["LOWEST_COST_WITH_BID_CAP", "Lowest Cost with Bid Cap"],
  ["COST_CAP", "Cost Cap"],
  ["LOWEST_COST_WITH_MIN_ROAS", "Lowest Cost with Min ROAS"],
];

const PLACEMENTS = [
  ["FACEBOOK_FEED", "Facebook Feed"],
  ["INSTAGRAM_FEED", "Instagram Feed"],
  ["FACEBOOK_STORIES", "Facebook Stories"],
  ["INSTAGRAM_STORIES", "Instagram Stories"],
  ["REELS", "Reels"],
];

const AGE_RANGES = [
  ["18-24", "18-24"],
  ["25-34", "25-34"],
  ["35-44", "35-44"],
  ["45-54", "45-54"],
  ["55-64", "55-64"],
  ["65+", "65+"],
];

const emptyForm = {
  campaign_id: "",
  name: "",
  optimization_goal: "LINK_CLICKS",
  billing_event: "LINK_CLICKS",
  bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  budget_type: "daily",
  budget_amount: "",
  start_date: "",
  end_date: "",
  age_min: "18",
  age_max: "65+",
  genders: [],
  locations: "",
  placements: [],
};

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function MetaAdSets() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: campaigns } = await supabase.from("social_campaigns").select("*").eq("platform", "meta").order("created_at", { ascending: false });
    setCampaigns(campaigns || []);

    const { data } = await supabase.from("social_ad_sets").select("*").order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setEditId(r.id);
    const targeting = r.targeting || {};
    setForm({
      campaign_id: r.campaign_id || "",
      name: r.name,
      optimization_goal: r.optimization_goal || "LINK_CLICKS",
      billing_event: r.billing_event || "LINK_CLICKS",
      bid_strategy: r.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
      budget_type: r.budget_type || "daily",
      budget_amount: String(r.budget_amount ?? ""),
      start_date: r.start_at ? r.start_at.slice(0, 10) : "",
      end_date: r.end_at ? r.end_at.slice(0, 10) : "",
      age_min: targeting.age_min || "18",
      age_max: targeting.age_max || "65+",
      genders: targeting.genders || [],
      locations: targeting.locations || "",
      placements: r.placements || [],
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.campaign_id.trim()) {
      toast({ title: "Please select a campaign", variant: "destructive" });
      return;
    }
    if (!form.name.trim()) {
      toast({ title: "Ad Set name is required", variant: "destructive" });
      return;
    }
    if (form.placements.length === 0) {
      toast({ title: "Please select at least one placement", variant: "destructive" });
      return;
    }

    setSaving(true);
    const targeting = {
      age_min: form.age_min,
      age_max: form.age_max,
      genders: form.genders,
      locations: form.locations,
    };

    const payload = {
      platform: "meta",
      campaign_id: form.campaign_id,
      name: form.name.trim(),
      optimization_goal: form.optimization_goal,
      billing_event: form.billing_event,
      bid_strategy: form.bid_strategy,
      budget_type: form.budget_type,
      budget_amount: Number(form.budget_amount || 0),
      start_at: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_at: form.end_date ? new Date(form.end_date).toISOString() : null,
      targeting,
      placements: form.placements,
      status: "draft",
    };

    const { error } = editId
      ? await supabase.from("social_ad_sets").update(payload).eq("id", editId)
      : await supabase.from("social_ad_sets").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editId ? "Ad Set updated" : "Ad Set created" });
    setOpen(false);
    load();
  };

  const callApi = async (action: string, adset_id: string, okMsg: string) => {
    setBusyId(adset_id);
    const { data, error } = await supabase.functions.invoke("meta-api", {
      body: { action, payload: { adset_id } }
    });
    setBusyId(null);
    if (error || data?.error) {
      toast({ title: "Action failed", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: okMsg });
    load();
  };

  const getCampaignName = (campaignId: string) => {
    return campaigns.find(c => c.id === campaignId)?.name || campaignId;
  };

  const statusColor = (s: string) =>
    s === "active" ? "default" : s === "paused" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Ad Sets</h1>
          <p className="text-muted-foreground mt-1">Create and manage ad sets with targeting and budget controls.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Create Ad Set</Button>
      </div>

      <Card className="rounded-xl">
        <CardHeader><CardTitle>All Ad Sets</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No ad sets yet. Create your first ad set.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad Set Name</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Optimization</TableHead>
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
                      <TableCell className="whitespace-nowrap">{getCampaignName(r.campaign_id)}</TableCell>
                      <TableCell className="capitalize">{r.optimization_goal.replace(/_/g, " ")}</TableCell>
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
                            <DropdownMenuItem
                              onClick={() => callApi("publish_adset", r.id, r.external_id ? "Ad Set republished" : "Ad Set published")}
                              className="gap-2"
                            >
                              <Rocket className="h-4 w-4" /> {r.external_id ? "Republish Changes" : "Publish"}
                            </DropdownMenuItem>
                            {r.external_id && r.status === "active" && (
                              <DropdownMenuItem onClick={() => callApi("pause_adset", r.id, "Ad Set paused")} className="gap-2">
                                <Pause className="h-4 w-4" /> Pause
                              </DropdownMenuItem>
                            )}
                            {r.external_id && r.status !== "active" && (
                              <DropdownMenuItem onClick={() => callApi("resume_adset", r.id, "Ad Set resumed")} className="gap-2">
                                <Play className="h-4 w-4" /> Resume
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => callApi("delete_adset", r.id, "Ad Set deleted")}
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
          <DialogHeader><DialogTitle>{editId ? "Edit Ad Set" : "Create Ad Set"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Campaign</Label>
              <Select value={form.campaign_id} onValueChange={(v) => setForm({ ...form, campaign_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select campaign..." /></SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Ad Set Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="text-base" />
            </div>
            <div className="space-y-1.5">
              <Label>Optimization Goal</Label>
              <Select value={form.optimization_goal} onValueChange={(v) => setForm({ ...form, optimization_goal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPTIMIZATION_GOALS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing Event</Label>
              <Select value={form.billing_event} onValueChange={(v) => setForm({ ...form, billing_event: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BILLING_EVENTS.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Bid Strategy</Label>
              <Select value={form.bid_strategy} onValueChange={(v) => setForm({ ...form, bid_strategy: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BID_STRATEGIES.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
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
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="text-base" />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="text-base" />
            </div>

            <div className="space-y-2 sm:col-span-2 border-t pt-4">
              <h3 className="font-medium text-sm">Targeting</h3>
            </div>

            <div className="space-y-1.5">
              <Label>Age Range (Min)</Label>
              <Select value={form.age_min} onValueChange={(v) => setForm({ ...form, age_min: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGE_RANGES.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Age Range (Max)</Label>
              <Select value={form.age_max} onValueChange={(v) => setForm({ ...form, age_max: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGE_RANGES.map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Gender</Label>
              <div className="flex gap-4">
                {["All", "Men", "Women"].map((g) => (
                  <div key={g} className="flex items-center gap-2">
                    <Checkbox
                      id={g}
                      checked={form.genders.includes(g) || (g === "All" && form.genders.length === 0)}
                      onCheckedChange={(checked) => {
                        if (g === "All") {
                          setForm({ ...form, genders: checked ? [] : ["All"] });
                        } else {
                          const genders = form.genders.length === 0 ? [] : form.genders;
                          setForm({
                            ...form,
                            genders: checked ? [...genders, g] : genders.filter(x => x !== g)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={g} className="text-sm">{g}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Locations (Countries/Cities)</Label>
              <Input value={form.locations} onChange={(e) => setForm({ ...form, locations: e.target.value })}
                placeholder="e.g., India, Mumbai, Delhi" className="text-base" />
              <p className="text-xs text-muted-foreground">Enter comma-separated list of countries or cities</p>
            </div>

            <div className="space-y-2 sm:col-span-2 border-t pt-4">
              <h3 className="font-medium text-sm">Placements</h3>
              <div className="grid grid-cols-2 gap-3">
                {PLACEMENTS.map(([v, l]) => (
                  <div key={v} className="flex items-center gap-2">
                    <Checkbox
                      id={v}
                      checked={form.placements.includes(v)}
                      onCheckedChange={(checked) => {
                        setForm({
                          ...form,
                          placements: checked
                            ? [...form.placements, v]
                            : form.placements.filter(x => x !== v)
                        });
                      }}
                    />
                    <Label htmlFor={v} className="text-sm">{l}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editId ? "Save Changes" : "Create Ad Set"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
