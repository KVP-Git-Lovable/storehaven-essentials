import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, Ticket, X, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type WARequest = {
  id: string;
  phone_number: string;
  customer_id: string | null;
  customer_name: string | null;
  request_type: string;
  message_text: string | null;
  city: string | null;
  conversation_phone: string;
  status: string;
  created_at: string;
};

const STATUS_OPTIONS = ["Open", "Converted", "Cleared"] as const;
const TYPE_SEED = ["Assistance", "Complaint", "Suggestion"] as const;

const statusVariant = (s: string) => {
  if (s === "Open") return "default";
  if (s === "Converted") return "secondary";
  return "outline";
};

interface Props {
  onOpenConversation: (phone: string) => void;
}

export default function WhatsAppRequestsTab({ onOpenConversation }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("Open");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["wa-requests", statusFilter, typeFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("whatsapp_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (typeFilter !== "all") q = q.eq("request_type", typeFilter);
      if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return data as WARequest[];
    },
  });

  // Realtime: refresh when new requests arrive or get updated.
  useEffect(() => {
    const channel = supabase
      .channel("wa-requests-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_requests" },
        () => qc.invalidateQueries({ queryKey: ["wa-requests"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>(TYPE_SEED);
    (requests ?? []).forEach((r) => r.request_type && set.add(r.request_type));
    return Array.from(set);
  }, [requests]);

  const filtered = useMemo(() => {
    if (!search.trim()) return requests ?? [];
    const q = search.toLowerCase();
    return (requests ?? []).filter(
      (r) =>
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        r.phone_number.toLowerCase().includes(q) ||
        (r.message_text ?? "").toLowerCase().includes(q)
    );
  }, [requests, search]);

  const updateStatus = async (id: string, status: "Converted" | "Cleared") => {
    const { error } = await supabase
      .from("whatsapp_requests")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["wa-requests"] });
    toast({
      title: status === "Converted" ? "Marked as converted" : "Request cleared",
      description:
        status === "Converted"
          ? "Ticketing integration coming soon."
          : "The request has been cleared.",
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, message..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Request type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No requests match the current filters.
            </div>
          ) : (
            <TooltipProvider delayDuration={150}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.customer_name || "—"}
                      </TableCell>
                      <TableCell>{r.phone_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.request_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate text-muted-foreground">
                              {r.message_text || "—"}
                            </div>
                          </TooltipTrigger>
                          {r.message_text && (
                            <TooltipContent className="max-w-sm">
                              <div className="whitespace-pre-wrap text-xs">
                                {r.message_text}
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(r.created_at), "dd MMM yyyy, h:mm a")}
                      </TableCell>
                      <TableCell>{r.city || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status) as any}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onOpenConversation(r.conversation_phone)}
                            title="View conversation"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                          {r.status === "Open" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(r.id, "Converted")}
                              >
                                <Ticket className="h-3.5 w-3.5 mr-1" />
                                Add to Ticket
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateStatus(r.id, "Cleared")}
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Clear
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
