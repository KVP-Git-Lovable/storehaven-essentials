import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BackButton } from "@/components/shared/BackButton";
import { toast } from "@/hooks/use-toast";
import { Loader2, MoreHorizontal, Pause, Play, Plus, Rocket, Trash2 } from "lucide-react";

const emptyForm = { ad_set_id: "", name: "", primary_text: "", headline: "", description: "", destination_url: "", media_url: "", call_to_action: "LEARN_MORE", status: "paused" };

export default function MetaAds() {
  const [rows, setRows] = useState<any[]>([]);
  const [adsets, setAdsets] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const [{ data: ads }, { data: sets }] = await Promise.all([
      supabase.from("social_ads").select("*").order("created_at", { ascending: false }),
      supabase.from("social_ad_sets").select("id,name,external_id").order("created_at", { ascending: false }),
    ]);
    setRows(ads || []);
    setAdsets(sets || []);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (row: any) => {
    setEditId(row.id);
    setForm({ ad_set_id: row.ad_set_id, name: row.name, primary_text: row.primary_text || "", headline: row.headline || "", description: row.description || "", destination_url: row.destination_url || "", media_url: row.media?.url || "", call_to_action: row.call_to_action || "LEARN_MORE", status: row.status || "paused" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.ad_set_id || !form.name.trim() || !form.destination_url.trim()) {
      toast({ title: "Ad Set, name and destination URL are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { ...form, platform: "meta", name: form.name.trim(), media: form.media_url ? { url: form.media_url } : {}, creative_type: "link" };
    delete (payload as any).media_url;
    const { error } = editId
      ? await supabase.from("social_ads").update(payload).eq("id", editId)
      : await supabase.from("social_ads").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Ad updated" : "Ad created" });
    setOpen(false);
    load();
  };

  const callApi = async (action: string, ad_id: string, message: string) => {
    setBusyId(ad_id);
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, payload: { ad_id } } });
    setBusyId(null);
    if (error || data?.error) { toast({ title: "Action failed", description: data?.error || error?.message, variant: "destructive" }); return; }
    toast({ title: message });
    load();
  };

  return <div className="space-y-6">
    <BackButton />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-semibold md:text-3xl">Ads</h1><p className="mt-1 text-muted-foreground">Create ads and republish edited creative details to Meta.</p></div>
      <Button onClick={() => { setEditId(null); setForm({ ...emptyForm }); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> Create Ad</Button>
    </div>
    <Card><CardHeader><CardTitle>All Ads</CardTitle></CardHeader><CardContent>
      {rows.length === 0 ? <p className="py-10 text-center text-muted-foreground">No ads yet.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Ad</TableHead><TableHead>Ad Set</TableHead><TableHead>Status</TableHead><TableHead>Meta ID</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
        {rows.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => openEdit(row)}><TableCell className="font-medium">{row.name}</TableCell><TableCell>{adsets.find((item) => item.id === row.ad_set_id)?.name || "—"}</TableCell><TableCell><Badge variant={row.status === "active" ? "default" : "secondary"}>{row.status}</Badge></TableCell><TableCell className="font-mono text-xs">{row.external_id || "—"}</TableCell><TableCell className="text-right" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={busyId === row.id}>{busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => openEdit(row)}>Edit</DropdownMenuItem><DropdownMenuItem className="gap-2" onClick={() => callApi("publish_ad", row.id, row.external_id ? "Ad republished" : "Ad published")}><Rocket className="h-4 w-4" />{row.external_id ? "Republish Changes" : "Publish"}</DropdownMenuItem>{row.external_id && (row.status === "active" ? <DropdownMenuItem className="gap-2" onClick={() => callApi("pause_ad", row.id, "Ad paused")}><Pause className="h-4 w-4" />Pause</DropdownMenuItem> : <DropdownMenuItem className="gap-2" onClick={() => callApi("resume_ad", row.id, "Ad resumed")}><Play className="h-4 w-4" />Resume</DropdownMenuItem>)}<DropdownMenuItem className="gap-2 text-destructive" onClick={() => callApi("delete_ad", row.id, "Ad deleted")}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}
      </TableBody></Table></div>}
    </CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editId ? "Edit Ad" : "Create Ad"}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2"><Label>Ad Set</Label><Select value={form.ad_set_id} onValueChange={(value) => setForm({ ...form, ad_set_id: value })}><SelectTrigger><SelectValue placeholder="Select a published ad set" /></SelectTrigger><SelectContent>{adsets.map((set) => <SelectItem key={set.id} value={set.id}>{set.name}{set.external_id ? "" : " (not published)"}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5 sm:col-span-2"><Label>Ad Name</Label><Input className="text-base" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label>Primary Text</Label><Textarea value={form.primary_text} onChange={(event) => setForm({ ...form, primary_text: event.target.value })} /></div>
      <div className="space-y-1.5"><Label>Headline</Label><Input className="text-base" value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} /></div>
      <div className="space-y-1.5"><Label>Call to Action</Label><Select value={form.call_to_action} onValueChange={(value) => setForm({ ...form, call_to_action: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LEARN_MORE">Learn More</SelectItem><SelectItem value="SHOP_NOW">Shop Now</SelectItem><SelectItem value="SIGN_UP">Sign Up</SelectItem><SelectItem value="CONTACT_US">Contact Us</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Input className="text-base" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label>Destination URL</Label><Input type="url" className="text-base" value={form.destination_url} onChange={(event) => setForm({ ...form, destination_url: event.target.value })} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label>Image URL (optional)</Label><Input type="url" className="text-base" value={form.media_url} onChange={(event) => setForm({ ...form, media_url: event.target.value })} /></div>
      <div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paused">Paused</SelectItem><SelectItem value="active">Active</SelectItem></SelectContent></Select></div>
    </div><DialogFooter className="sticky bottom-0 bg-background pt-3"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editId ? "Save Changes" : "Create Ad"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}