import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Copy,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  Check,
  Star,
} from "lucide-react";
import { toast } from "sonner";

type ComponentType = "CGST" | "SGST" | "IGST" | "CESS";

interface TaxComponent {
  component_type: ComponentType;
  percentage: number;
  is_enabled: boolean;
}

interface TaxMasterRecord {
  id: string;
  name: string;
  tax_type: string;
  description: string | null;
  hsn_code: string | null;
  is_active: boolean;
  is_default: boolean;
  apply_to_primary_orders: boolean;
  apply_to_secondary_orders: boolean;
  effective_from: string | null;
  effective_to: string | null;
  version: number;
  total_rate: number;
  product_count: number;
  components: TaxComponent[];
}

interface ItemRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  tax_master_id: string | null;
}

const DEFAULT_COMPONENTS: TaxComponent[] = [
  { component_type: "CGST", percentage: 0, is_enabled: false },
  { component_type: "SGST", percentage: 0, is_enabled: false },
  { component_type: "IGST", percentage: 0, is_enabled: false },
  { component_type: "CESS", percentage: 0, is_enabled: false },
];

const PAGE_SIZE = 50;

interface PanelState {
  loading: boolean;
  saving: boolean;
  search: string;
  page: number;
  total: number;
  rows: ItemRow[];
  selected: Set<string>;
  targetBracket: string;
}

const emptyPanel = (): PanelState => ({
  loading: false,
  saving: false,
  search: "",
  page: 0,
  total: 0,
  rows: [],
  selected: new Set(),
  targetBracket: "",
});

export default function TaxMaster() {
  const [taxes, setTaxes] = useState<TaxMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [panels, setPanels] = useState<Record<string, PanelState>>({});

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fName, setFName] = useState("");
  const [fType, setFType] = useState("GST");
  const [fHsn, setFHsn] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fActive, setFActive] = useState(true);
  const [fDefault, setFDefault] = useState(false);
  const [fPrimary, setFPrimary] = useState(true);
  const [fSecondary, setFSecondary] = useState(true);
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fComps, setFComps] = useState<TaxComponent[]>(DEFAULT_COMPONENTS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: masters, error } = await (supabase as any)
        .from("tax_masters")
        .select("*")
        .order("total_rate", { ascending: true });
      if (error) throw error;

      const ids = (masters || []).map((m: any) => m.id);
      const { data: comps } = ids.length
        ? await (supabase as any).from("tax_components").select("*").in("tax_master_id", ids)
        : { data: [] as any[] };

      const counts = await Promise.all(
        ids.map((id: string) =>
          (supabase as any)
            .from("inventory_items")
            .select("id", { count: "exact", head: true })
            .eq("tax_master_id", id)
            .then((r: any) => ({ id, count: r.count || 0 }))
        )
      );
      const countMap: Record<string, number> = {};
      counts.forEach((r: any) => (countMap[r.id] = r.count));

      const result: TaxMasterRecord[] = (masters || []).map((m: any) => ({
        ...m,
        product_count: countMap[m.id] || 0,
        components: (comps || [])
          .filter((c: any) => c.tax_master_id === m.id)
          .map((c: any) => ({
            component_type: c.component_type,
            percentage: Number(c.percentage),
            is_enabled: c.is_enabled,
          })),
      }));
      setTaxes(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to load tax masters");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updatePanel = (key: string, patch: Partial<PanelState>) => {
    setPanels((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyPanel()), ...patch } }));
  };

  const loadPanel = useCallback(
    async (key: string, bracketId: string) => {
      const cur = panels[key] ?? emptyPanel();
      updatePanel(key, { loading: true });
      try {
        const trimmed = cur.search.trim();
        const from = cur.page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let q = (supabase as any)
          .from("inventory_items")
          .select("id, name, sku, category, tax_master_id", { count: "exact" })
          .eq("tax_master_id", bracketId);
        if (trimmed) q = q.or(`name.ilike.%${trimmed}%,sku.ilike.%${trimmed}%`);
        const { data, count, error } = await q.order("name").range(from, to);
        if (error) throw error;

        updatePanel(key, {
          loading: false,
          total: count || 0,
          rows: (data || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            sku: r.sku,
            category: r.category,
            tax_master_id: r.tax_master_id,
          })),
        });
      } catch (e: any) {
        updatePanel(key, { loading: false });
        toast.error(`Failed to load items: ${e.message}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panels]
  );

  const toggleExpand = (bracketId: string) => {
    const isOpen = !!expanded[bracketId];
    setExpanded((prev) => ({ ...prev, [bracketId]: !isOpen }));
    if (!isOpen) {
      if (!panels[bracketId]) setPanels((prev) => ({ ...prev, [bracketId]: emptyPanel() }));
      setTimeout(() => loadPanel(bracketId, bracketId), 0);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFName("");
    setFType("GST");
    setFHsn("");
    setFDesc("");
    setFActive(true);
    setFDefault(false);
    setFPrimary(true);
    setFSecondary(true);
    setFFrom("");
    setFTo("");
    setFComps(DEFAULT_COMPONENTS.map((c) => ({ ...c })));
    setDialogOpen(true);
  };

  const openEdit = (t: TaxMasterRecord) => {
    setEditingId(t.id);
    setFName(t.name);
    setFType(t.tax_type);
    setFHsn(t.hsn_code || "");
    setFDesc(t.description || "");
    setFActive(t.is_active);
    setFDefault(t.is_default);
    setFPrimary(t.apply_to_primary_orders);
    setFSecondary(t.apply_to_secondary_orders);
    setFFrom(t.effective_from || "");
    setFTo(t.effective_to || "");
    setFComps(
      DEFAULT_COMPONENTS.map((dc) => {
        const existing = t.components.find((c) => c.component_type === dc.component_type);
        return existing ? { ...existing } : { ...dc };
      })
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!fName.trim()) {
      toast.error("Tax name is required");
      return;
    }
    if (!fComps.some((c) => c.is_enabled)) {
      toast.error("Enable at least one tax component");
      return;
    }
    setSaving(true);
    try {
      // If this becomes default, clear other defaults
      if (fDefault) {
        await (supabase as any)
          .from("tax_masters")
          .update({ is_default: false })
          .neq("id", editingId || "00000000-0000-0000-0000-000000000000");
      }

      const payload = {
        name: fName.trim(),
        tax_type: fType,
        description: fDesc || null,
        hsn_code: fHsn.trim() || null,
        is_active: fActive,
        is_default: fDefault,
        apply_to_primary_orders: fPrimary,
        apply_to_secondary_orders: fSecondary,
        effective_from: fFrom || null,
        effective_to: fTo || null,
      };

      let masterId = editingId;
      if (editingId) {
        const { error } = await (supabase as any)
          .from("tax_masters")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        await (supabase as any).from("tax_components").delete().eq("tax_master_id", editingId);
      } else {
        const { data, error } = await (supabase as any)
          .from("tax_masters")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        masterId = data.id;
      }

      const { error: cErr } = await (supabase as any).from("tax_components").insert(
        fComps.map((c) => ({
          tax_master_id: masterId,
          component_type: c.component_type,
          percentage: c.percentage,
          is_enabled: c.is_enabled,
        }))
      );
      if (cErr) throw cErr;

      toast.success(editingId ? "Tax updated" : "Tax created");
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save tax");
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async (t: TaxMasterRecord) => {
    try {
      const { data: nm, error } = await (supabase as any)
        .from("tax_masters")
        .insert({
          name: `${t.name} (Clone)`,
          tax_type: t.tax_type,
          description: t.description,
          hsn_code: t.hsn_code,
          is_active: false,
          is_default: false,
          apply_to_primary_orders: t.apply_to_primary_orders,
          apply_to_secondary_orders: t.apply_to_secondary_orders,
          cloned_from_id: t.id,
          version: t.version + 1,
        })
        .select()
        .single();
      if (error) throw error;
      await (supabase as any).from("tax_components").insert(
        t.components.map((c) => ({
          tax_master_id: nm.id,
          component_type: c.component_type,
          percentage: c.percentage,
          is_enabled: c.is_enabled,
        }))
      );
      toast.success("Tax cloned");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Clone failed");
    }
  };

  const toggleActive = async (t: TaxMasterRecord) => {
    try {
      const { error } = await (supabase as any)
        .from("tax_masters")
        .update({ is_active: !t.is_active })
        .eq("id", t.id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    }
  };

  const setAsDefault = async (t: TaxMasterRecord) => {
    try {
      await (supabase as any).from("tax_masters").update({ is_default: false }).neq("id", t.id);
      const { error } = await (supabase as any)
        .from("tax_masters")
        .update({ is_default: true })
        .eq("id", t.id);
      if (error) throw error;
      toast.success(`${t.name} is now the default slab`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to set default");
    }
  };

  const bulkMove = async (bracketId: string) => {
    const p = panels[bracketId];
    if (!p || p.selected.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    if (!p.targetBracket) {
      toast.error("Choose a target slab");
      return;
    }
    updatePanel(bracketId, { saving: true });
    try {
      const { error } = await (supabase as any)
        .from("inventory_items")
        .update({ tax_master_id: p.targetBracket })
        .in("id", Array.from(p.selected));
      if (error) throw error;
      toast.success(`Moved ${p.selected.size} item(s)`);
      updatePanel(bracketId, { saving: false, selected: new Set() });
      await Promise.all([loadPanel(bracketId, bracketId), load()]);
    } catch (e: any) {
      updatePanel(bracketId, { saving: false });
      toast.error(e.message || "Move failed");
    }
  };

  const renderPanel = (bracketId: string) => {
    const p = panels[bracketId] ?? emptyPanel();
    const hasNext = (p.page + 1) * PAGE_SIZE < p.total;
    const from = p.rows.length === 0 ? 0 : p.page * PAGE_SIZE + 1;
    const to = p.page * PAGE_SIZE + p.rows.length;
    return (
      <div className="mt-4 border-t pt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Search item name or SKU..."
              value={p.search}
              onChange={(e) => {
                updatePanel(bracketId, { search: e.target.value, page: 0 });
                setTimeout(() => loadPanel(bracketId, bracketId), 0);
              }}
            />
          </div>
          <Select
            value={p.targetBracket}
            onValueChange={(v) => updatePanel(bracketId, { targetBracket: v })}
          >
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="Move to slab..." />
            </SelectTrigger>
            <SelectContent>
              {taxes
                .filter((t) => t.is_active && t.id !== bracketId)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.total_rate}%)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={p.saving || p.selected.size === 0 || !p.targetBracket}
            onClick={() => bulkMove(bracketId)}
          >
            {p.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Move ${p.selected.size}`}
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={p.rows.length > 0 && p.selected.size === p.rows.length}
                    onCheckedChange={(v) => {
                      const s = new Set<string>();
                      if (v) p.rows.forEach((r) => s.add(r.id));
                      updatePanel(bracketId, { selected: s });
                    }}
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading...
                  </TableCell>
                </TableRow>
              ) : p.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No items in this slab.
                  </TableCell>
                </TableRow>
              ) : (
                p.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox
                        checked={p.selected.has(r.id)}
                        onCheckedChange={(v) => {
                          const s = new Set(p.selected);
                          if (v) s.add(r.id);
                          else s.delete(r.id);
                          updatePanel(bracketId, { selected: s });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Check className="h-4 w-4 text-primary" />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.sku || "—"}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.category || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {p.total > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {from}–{to} of {p.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={p.page === 0}
                onClick={() => {
                  updatePanel(bracketId, { page: p.page - 1 });
                  setTimeout(() => loadPanel(bracketId, bracketId), 0);
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => {
                  updatePanel(bracketId, { page: p.page + 1 });
                  setTimeout(() => loadPanel(bracketId, bracketId), 0);
                }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Master</h1>
          <p className="text-muted-foreground">
            Configure GST/IGST tax rates, HSN codes and map to products
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Tax
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading tax masters...
        </div>
      ) : taxes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No tax slabs yet. Click <span className="font-medium">Create Tax</span> to add one.
        </Card>
      ) : (
        <div className="space-y-3">
          {taxes.map((t) => {
            const isOpen = !!expanded[t.id];
            return (
              <Card key={t.id} className="p-4">
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(t.id)}
                        className="flex items-center gap-1 hover:underline"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-semibold text-lg">{t.name}</span>
                      </button>
                      <Badge variant={t.is_active ? "default" : "secondary"}>
                        {t.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {t.is_default && (
                        <Badge variant="outline" className="border-primary text-primary">
                          <Star className="h-3 w-3 mr-1 fill-primary" /> Default
                        </Badge>
                      )}
                      <Badge variant="outline">{t.tax_type}</Badge>
                      {t.hsn_code && (
                        <Badge variant="outline">HSN {t.hsn_code}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {t.components
                        .filter((c) => c.is_enabled)
                        .map((c) => (
                          <span
                            key={c.component_type}
                            className="rounded-md bg-muted px-2 py-0.5"
                          >
                            {c.component_type}: {c.percentage}%
                          </span>
                        ))}
                      <span className="rounded-md bg-primary/10 text-primary font-medium px-2 py-0.5">
                        Total: {t.total_rate}%
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {t.product_count} item{t.product_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {t.apply_to_primary_orders && (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3" /> Primary Orders
                        </span>
                      )}
                      {t.apply_to_secondary_orders && (
                        <span className="flex items-center gap-1">
                          <Check className="h-3 w-3" /> Secondary Orders
                        </span>
                      )}
                      {t.description && <span>· {t.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={t.is_active}
                      onCheckedChange={() => toggleActive(t)}
                      aria-label="Toggle active"
                    />
                    {!t.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAsDefault(t)}
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleClone(t)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {isOpen && renderPanel(t.id)}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Tax" : "Create Tax"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tax Name *</Label>
              <Input
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                placeholder="e.g. 3% GST 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tax Type</Label>
                <Select value={fType} onValueChange={setFType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GST">GST</SelectItem>
                    <SelectItem value="IGST">IGST</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>HSN Code</Label>
                <Input
                  value={fHsn}
                  onChange={(e) => setFHsn(e.target.value)}
                  placeholder="e.g. 71131930"
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={fDesc}
                onChange={(e) => setFDesc(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Effective From</Label>
                <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
              </div>
              <div>
                <Label>Effective To</Label>
                <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Tax Components</Label>
              <div className="space-y-2 rounded-md border p-3">
                {fComps.map((c, i) => (
                  <div key={c.component_type} className="flex items-center gap-3">
                    <Checkbox
                      checked={c.is_enabled}
                      onCheckedChange={(v) => {
                        const next = [...fComps];
                        next[i] = { ...c, is_enabled: !!v };
                        setFComps(next);
                      }}
                    />
                    <span className="w-16 font-medium text-sm">{c.component_type}</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={c.percentage}
                      onChange={(e) => {
                        const next = [...fComps];
                        next[i] = { ...c, percentage: Number(e.target.value) || 0 };
                        setFComps(next);
                      }}
                      className="w-32"
                    />
                    <span className="text-muted-foreground text-sm">%</span>
                  </div>
                ))}
                <div className="pt-2 text-sm font-medium border-t">
                  Total:{" "}
                  {fComps.filter((c) => c.is_enabled).reduce((s, c) => s + c.percentage, 0)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={fActive} onCheckedChange={setFActive} /> Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={fDefault} onCheckedChange={setFDefault} /> Set as default
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={fPrimary} onCheckedChange={setFPrimary} /> Apply to primary orders
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={fSecondary} onCheckedChange={setFSecondary} /> Apply to secondary orders
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}