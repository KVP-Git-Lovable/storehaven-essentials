import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { BackButton } from "@/components/shared/BackButton";
import { CheckCircle2, Facebook, Instagram, Loader2, Megaphone, RefreshCw, Unplug } from "lucide-react";

export interface MetaConnectionData {
  id: string;
  external_user_name: string | null;
  business_name: string | null;
  status: string;
  token_expires_at: string | null;
  default_page_id: string | null;
  default_instagram_id: string | null;
  default_ad_account_id: string | null;
}

export default function MetaConnection() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conn, setConn] = useState<MetaConnectionData | null>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [defaults, setDefaults] = useState({ page: "", ig: "", ad: "" });

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase
      .from("social_connections")
      .select("*")
      .eq("platform", "meta")
      .maybeSingle();
    setConn((c as any) ?? null);
    if (c) {
      const [{ data: p }, { data: a }] = await Promise.all([
        supabase.from("social_pages").select("*").eq("connection_id", c.id).order("page_name"),
        supabase.from("social_ad_accounts").select("*").eq("connection_id", c.id).order("name"),
      ]);
      setPages(p || []);
      setAccounts(a || []);
      setDefaults({
        page: (c as any).default_page_id || "",
        ig: (c as any).default_instagram_id || "",
        ad: (c as any).default_ad_account_id || "",
      });
    } else {
      setPages([]);
      setAccounts([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth-start", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.auth_url) throw new Error("Could not build the Facebook login URL");

      const popup = window.open(data.auth_url, "meta-oauth", "width=680,height=760");
      if (!popup) throw new Error("Please allow pop-ups to connect with Facebook");

      const onMessage = async (e: MessageEvent) => {
        if (e.data?.source !== "meta-oauth") return;
        window.removeEventListener("message", onMessage);
        setConnecting(false);
        if (e.data.ok) {
          toast({ title: "Connected successfully", description: "Your Meta Business account is linked." });
          load();
        } else {
          toast({ title: "Connection failed", description: String(e.data.error), variant: "destructive" });
        }
      };
      window.addEventListener("message", onMessage);

      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          load();
        }
      }, 1000);
    } catch (err: any) {
      setConnecting(false);
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    }
  };

  const saveConfig = async () => {
    if (!conn) return;
    setSaving(true);
    const { error } = await supabase
      .from("social_connections")
      .update({
        default_page_id: defaults.page || null,
        default_instagram_id: defaults.ig || null,
        default_ad_account_id: defaults.ad || null,
      })
      .eq("id", conn.id);
    setSaving(false);
    if (error) toast({ title: "Could not save", description: error.message, variant: "destructive" });
    else toast({ title: "Configuration saved" });
  };

  const disconnect = async () => {
    if (!conn) return;
    const { error } = await supabase.from("social_connections").delete().eq("id", conn.id);
    if (error) toast({ title: "Could not disconnect", description: error.message, variant: "destructive" });
    else { toast({ title: "Disconnected" }); load(); }
  };

  const igAccounts = pages.filter((p) => p.instagram_id);

  return (
    <div className="space-y-6">
      <BackButton />
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">Meta</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Meta Business account to publish Facebook posts, Instagram posts and create Facebook Ads.
        </p>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-primary" /> Meta Business Connection
          </CardTitle>
          <CardDescription>
            One secure sign-in links your Pages, Instagram accounts and Ad Accounts. No IDs or tokens to copy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !conn ? (
            <Button size="lg" onClick={connect} disabled={connecting} className="gap-2">
              {connecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Facebook className="h-5 w-5" />}
              Connect with Facebook
            </Button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="font-medium">Connected Successfully</span>
                {conn.status === "needs_reauth" && <Badge variant="destructive">Re-authentication required</Badge>}
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={connect} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Re-sync
                  </Button>
                  <Button variant="ghost" size="sm" onClick={disconnect} className="gap-2 text-destructive">
                    <Unplug className="h-4 w-4" /> Disconnect
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Facebook User</p>
                  <p className="font-medium">{conn.external_user_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Business Name</p>
                  <p className="font-medium">{conn.business_name || "—"}</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2"><Facebook className="h-4 w-4" /> Connected Facebook Pages</p>
                  {pages.length === 0 && <p className="text-sm text-muted-foreground">No pages found.</p>}
                  {pages.map((p) => (
                    <div key={p.id} className="rounded-lg border p-2 text-sm">{p.page_name}</div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2"><Instagram className="h-4 w-4" /> Connected Instagram Accounts</p>
                  {igAccounts.length === 0 && <p className="text-sm text-muted-foreground">No Instagram business accounts linked.</p>}
                  {igAccounts.map((p) => (
                    <div key={p.id} className="rounded-lg border p-2 text-sm">@{p.instagram_username || p.instagram_id}</div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2"><Megaphone className="h-4 w-4" /> Connected Ad Accounts</p>
                  {accounts.length === 0 && <p className="text-sm text-muted-foreground">No ad accounts found.</p>}
                  {accounts.map((a) => (
                    <div key={a.id} className="rounded-lg border p-2 text-sm">
                      {a.name} <span className="text-muted-foreground">({a.currency})</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Default Facebook Page</label>
                  <Select value={defaults.page} onValueChange={(v) => setDefaults((d) => ({ ...d, page: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select page" /></SelectTrigger>
                    <SelectContent>
                      {pages.map((p) => <SelectItem key={p.page_id} value={p.page_id}>{p.page_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Default Instagram Account</label>
                  <Select value={defaults.ig} onValueChange={(v) => setDefaults((d) => ({ ...d, ig: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {igAccounts.map((p) => (
                        <SelectItem key={p.instagram_id} value={p.instagram_id}>@{p.instagram_username || p.instagram_id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Default Ad Account</label>
                  <Select value={defaults.ad} onValueChange={(v) => setDefaults((d) => ({ ...d, ad: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select ad account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => <SelectItem key={a.ad_account_id} value={a.ad_account_id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={saveConfig} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Configuration
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}