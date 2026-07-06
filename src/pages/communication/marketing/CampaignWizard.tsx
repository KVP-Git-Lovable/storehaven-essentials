import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { AudienceBuilder, type AudienceConfig } from "@/components/journey/AudienceBuilder";
import { RichEmailEditor } from "@/components/marketing/RichEmailEditor";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Save, Send, Eye, TestTube2, ShieldAlert, Loader2 } from "lucide-react";

const STEPS = ["Details", "Audience", "Designer", "Review", "Schedule"] as const;

interface Props {
  campaignId: string | null;
  templateId?: string | null;
  onDone: () => void;
  onCancel: () => void;
}

type Sender = { id: string; from_email: string; from_name: string; reply_to?: string; type: "sender" | "domain" };

export function CampaignWizard({ campaignId, templateId, onDone, onCancel }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [audience, setAudience] = useState<AudienceConfig>({ segments: [], combinator: "union" });
  const [html, setHtml] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [testEmails, setTestEmails] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Load senders
  const { data: sendersData, isLoading: sendersLoading, refetch: refetchSenders } = useQuery({
    queryKey: ["sg-senders"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sendgrid-senders", { body: {} });
      if (error) throw error;
      return data as { verifiedSenders: Sender[]; domains: any[]; hasAny: boolean };
    },
  });
  const senders: Sender[] = sendersData?.verifiedSenders || [];
  const hasSender = !!sendersData?.hasAny;

  // Load existing campaign
  useEffect(() => {
    if (!campaignId) return;
    (async () => {
      const { data } = await (supabase as any).from("email_marketing_campaigns").select("*").eq("id", campaignId).maybeSingle();
      if (!data) return;
      setName(data.name || "");
      setSubject(data.subject || "");
      setPreviewText(data.preview_text || "");
      setFromName(data.from_name || "");
      setFromEmail(data.from_email || "");
      setReplyTo(data.reply_to || "");
      setHtml(data.html || "");
      setAudience(data.audience_config || { segments: [], combinator: "union" });
      setTimezone(data.timezone || timezone);
      if (data.scheduled_at) {
        const d = new Date(data.scheduled_at);
        setScheduleMode("later");
        setScheduleDate(d.toISOString().slice(0, 10));
        setScheduleTime(d.toTimeString().slice(0, 5));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Load template preset
  useEffect(() => {
    if (!templateId) return;
    (async () => {
      const { data } = await (supabase as any).from("email_marketing_templates").select("*").eq("id", templateId).maybeSingle();
      if (!data) return;
      if (!subject) setSubject(data.subject || "");
      if (!previewText) setPreviewText(data.preview_text || "");
      if (!html) setHtml(data.html || "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // Live audience preview
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  useEffect(() => {
    const valid = (audience.segments || []).filter((s) => s.list_view_id);
    if (!valid.length) { setAudienceCount(null); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase.functions.invoke("journey-actions", {
        body: { action: "audience-preview", audience_config: { ...audience, segments: valid } },
      });
      if (alive) setAudienceCount(data?.final ?? null);
    })();
    return () => { alive = false; };
  }, [audience]);

  const canNext = useMemo(() => {
    if (step === 0) return name.trim() && subject.trim() && fromName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail);
    if (step === 1) return (audience.segments || []).some((s) => s.list_view_id);
    if (step === 2) return html.replace(/<[^>]+>/g, "").trim().length > 10;
    if (step === 3) return true;
    if (step === 4) {
      if (scheduleMode === "later") return !!scheduleDate && !!scheduleTime;
      return true;
    }
    return true;
  }, [step, name, subject, fromName, fromEmail, audience, html, scheduleMode, scheduleDate, scheduleTime]);

  const saveDraft = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data: userRes } = await supabase.auth.getUser();
      const payload: any = {
        name: name.trim(),
        subject: subject.trim(),
        preview_text: previewText || null,
        from_name: fromName.trim(),
        from_email: fromEmail.trim().toLowerCase(),
        reply_to: replyTo.trim() || null,
        html,
        audience_config: audience,
        timezone,
      };
      if (campaignId) {
        const { error } = await (supabase as any).from("email_marketing_campaigns").update(payload).eq("id", campaignId);
        if (error) throw error;
        return campaignId;
      } else {
        payload.status = "draft";
        payload.created_by = userRes.user?.id || null;
        const { data, error } = await (supabase as any).from("email_marketing_campaigns").insert(payload).select("id").single();
        if (error) throw error;
        return (data as any).id;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-campaigns"] }); toast({ title: "Draft saved" }); },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      const list = testEmails.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
      if (!list.length) throw new Error("Enter at least one test recipient");
      const id = await saveDraft.mutateAsync();
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("marketing-campaign-test", {
        body: { campaign_id: id, recipients: list, sent_by: userRes.user?.id || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => toast({ title: "Test email sent" }),
    onError: (e: Error) => toast({ title: "Test send failed", description: e.message, variant: "destructive" }),
  });

  const launch = useMutation({
    mutationFn: async () => {
      const id = await saveDraft.mutateAsync();
      let sched: string | null = null;
      if (scheduleMode === "later") {
        // Compose an ISO string in the given tz; simple approach uses local time then toISOString
        const local = new Date(`${scheduleDate}T${scheduleTime}:00`);
        if (local.getTime() < Date.now() + 60_000) throw new Error("Scheduled time must be at least 1 minute in the future");
        sched = local.toISOString();
      }
      const { data, error } = await supabase.functions.invoke("marketing-campaign-launch", {
        body: {
          campaign_id: id,
          send_now: scheduleMode === "now",
          scheduled_at: sched,
          app_base_url: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-campaigns"] });
      toast({ title: "Campaign launched", description: scheduleMode === "now" ? "Sending now via SendGrid" : "Scheduled" });
      onDone();
    },
    onError: (e: Error) => toast({ title: "Launch failed", description: e.message, variant: "destructive" }),
  });

  const largeAudience = (audienceCount || 0) > 1000;
  const confirmMatches = !largeAudience || confirmText.trim().toUpperCase() === "SEND";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={onCancel}><ArrowLeft className="h-4 w-4 mr-1" />Back to campaigns</Button>
          <h2 className="text-xl font-semibold mt-2">{campaignId ? "Edit campaign" : "New campaign"}</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending || !name.trim()}>
          <Save className="h-4 w-4 mr-2" />Save draft
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className={`px-3 py-1.5 rounded-full text-xs border ${i === step ? "bg-primary text-primary-foreground border-primary" : i < step ? "bg-muted" : "text-muted-foreground"}`}
            onClick={() => setStep(i)}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {!hasSender && !sendersLoading && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-medium">No verified sender in SendGrid</div>
              <div className="text-muted-foreground">
                Verify at least one sender identity (or authenticate a domain) in SendGrid to launch campaigns. You can still save a draft.
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetchSenders()}>Recheck</Button>
          </CardContent>
        </Card>
      )}

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Campaign details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. October offers" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Subject line</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject shown in inbox" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Preview text</Label>
              <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Short preview shown after the subject" />
            </div>
            <div className="space-y-1.5">
              <Label>From name</Label>
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Brand or person name" />
            </div>
            <div className="space-y-1.5">
              <Label>From email</Label>
              <Select value={fromEmail} onValueChange={(v) => {
                setFromEmail(v);
                const s = senders.find((x) => x.from_email === v);
                if (s) { if (!fromName) setFromName(s.from_name || ""); if (!replyTo && s.reply_to) setReplyTo(s.reply_to); }
              }}>
                <SelectTrigger><SelectValue placeholder={sendersLoading ? "Loading..." : "Select a verified sender"} /></SelectTrigger>
                <SelectContent>
                  {senders.map((s) => (
                    <SelectItem key={s.id} value={s.from_email}>
                      {s.from_name ? `${s.from_name} <${s.from_email}>` : s.from_email}
                    </SelectItem>
                  ))}
                  {senders.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No verified senders yet</div>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Reply-to email (optional)</Label>
              <Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="replies@yourbrand.com" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audience</CardTitle>
            <CardDescription>Reuses your saved List Views (Customers, Leads, Orders).</CardDescription>
          </CardHeader>
          <CardContent>
            <AudienceBuilder value={audience} onChange={setAudience} />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email designer</CardTitle>
            <CardDescription>Rich HTML with merge variables. A compliance footer is added automatically at send time.</CardDescription>
          </CardHeader>
          <CardContent>
            <RichEmailEditor value={html} onChange={setHtml} minHeight={420} />
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Review</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div><div className="text-muted-foreground text-xs">Sender</div><div>{fromName} &lt;{fromEmail}&gt;</div></div>
              <div><div className="text-muted-foreground text-xs">Reply-to</div><div>{replyTo || "—"}</div></div>
              <div className="md:col-span-2"><div className="text-muted-foreground text-xs">Subject</div><div className="font-medium">{subject}</div></div>
              {previewText && <div className="md:col-span-2"><div className="text-muted-foreground text-xs">Preview text</div><div>{previewText}</div></div>}
              <div><div className="text-muted-foreground text-xs">Estimated recipients</div><div className="font-semibold">{audienceCount != null ? audienceCount.toLocaleString() : "—"}</div></div>
              <div><div className="text-muted-foreground text-xs">Timezone</div><div>{timezone}</div></div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4 mr-2" />Preview email</Button>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2"><TestTube2 className="h-4 w-4" /><span className="text-sm font-medium">Send test email</span></div>
              <Textarea rows={2} placeholder="test1@example.com, test2@example.com" value={testEmails} onChange={(e) => setTestEmails(e.target.value)} />
              <div className="flex justify-end">
                <Button size="sm" onClick={() => sendTest.mutate()} disabled={sendTest.isPending || !hasSender}>
                  {sendTest.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Send test
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Test sends never affect campaign analytics.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={scheduleMode} onValueChange={(v) => setScheduleMode(v as any)}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="now" id="sm-now" /><span>Send now</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="later" id="sm-later" /><span>Schedule for later</span>
              </label>
            </RadioGroup>

            {scheduleMode === "later" && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Timezone</Label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
              </div>
            )}

            {audienceCount != null && (
              <div className="text-sm text-muted-foreground">
                Estimated recipients: <Badge variant="outline">{audienceCount.toLocaleString()}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!canNext}>
            Next<ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={() => setConfirmOpen(true)} disabled={!canNext || !hasSender}>
            <Send className="h-4 w-4 mr-2" />
            {scheduleMode === "now" ? "Send campaign" : "Schedule campaign"}
          </Button>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl h-[80vh]">
          <DialogHeader><DialogTitle>Email preview</DialogTitle></DialogHeader>
          <iframe title="preview" srcDoc={html} className="w-full h-full border rounded" />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmText(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm launch</DialogTitle>
            <DialogDescription>Review your campaign before we hand it to SendGrid.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {name}</div>
            <div><span className="text-muted-foreground">Audience:</span> {audienceCount?.toLocaleString() || "—"} contacts</div>
            <div><span className="text-muted-foreground">When:</span> {scheduleMode === "now" ? "Immediately" : `${scheduleDate} ${scheduleTime} ${timezone}`}</div>
          </div>
          {largeAudience && (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-sm">
              This is a large audience. Type <b>SEND</b> to confirm.
              <Input className="mt-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={() => { setConfirmOpen(false); launch.mutate(); }}
              disabled={launch.isPending || !confirmMatches}
            >
              {launch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Confirm launch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CampaignWizard;
