import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Loader2, Briefcase, Users, UserCheck, Clock, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RequisitionFormDialog } from "@/components/recruitment/RequisitionFormDialog";
import { CandidateFormDialog } from "@/components/recruitment/CandidateFormDialog";
import { CandidateDetailsSheet } from "@/components/recruitment/CandidateDetailsSheet";

type Requisition = {
  id: string;
  title: string;
  department: string;
  position: string;
  number_of_openings: number;
  priority: string;
  status: string;
  target_join_date: string | null;
  created_at: string;
};

type Candidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  experience_years: number | null;
  expected_salary: number | null;
  requisition_id: string | null;
  created_at: string;
  current_company: string | null;
  current_designation: string | null;
};

const statusColors: Record<string, string> = {
  applied: "bg-blue-100 text-blue-800",
  screening: "bg-purple-100 text-purple-800",
  interview: "bg-amber-100 text-amber-800",
  selected: "bg-green-100 text-green-800",
  offer_sent: "bg-emerald-100 text-emerald-800",
  offer_accepted: "bg-teal-100 text-teal-800",
  joined: "bg-green-200 text-green-900",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-800",
};

export default function Recruitment() {
  const [tab, setTab] = useState("requisitions");
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reqDialogOpen, setReqDialogOpen] = useState(false);
  const [candidateDialogOpen, setCandidateDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [reqRes, candRes] = await Promise.all([
      supabase.from("job_requisitions").select("*").order("created_at", { ascending: false }),
      supabase.from("candidates").select("*").order("created_at", { ascending: false }),
    ]);
    if (reqRes.data) setRequisitions(reqRes.data);
    if (candRes.data) setCandidates(candRes.data);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const openReqs = requisitions.filter(r => r.status === "open").length;
    const totalCandidates = candidates.length;
    const inInterview = candidates.filter(c => c.status === "interview").length;
    const offered = candidates.filter(c => ["offer_sent", "offer_accepted"].includes(c.status)).length;
    return [
      { title: "Open Requisitions", value: openReqs.toString(), icon: Briefcase, iconColor: "bg-primary/10 text-primary" },
      { title: "Total Candidates", value: totalCandidates.toString(), icon: Users, iconColor: "bg-info/10 text-info" },
      { title: "In Interview", value: inInterview.toString(), icon: Clock, iconColor: "bg-warning/10 text-warning" },
      { title: "Offers Made", value: offered.toString(), icon: UserCheck, iconColor: "bg-success/10 text-success" },
    ];
  }, [requisitions, candidates]);

  const filteredRequisitions = requisitions.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getReqTitle = (reqId: string | null) => {
    if (!reqId) return "—";
    return requisitions.find(r => r.id === reqId)?.title || "—";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Recruitment</h1>
          <p className="text-muted-foreground">End-to-end hiring pipeline</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="requisitions">Requisitions</TabsTrigger>
            <TabsTrigger value="candidates">Candidates</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-[200px]"
              />
            </div>
            {tab === "candidates" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                  <SelectItem value="offer_sent">Offer Sent</SelectItem>
                  <SelectItem value="offer_accepted">Offer Accepted</SelectItem>
                  <SelectItem value="joined">Joined</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            )}
            {tab === "requisitions" ? (
              <Button className="gap-2" onClick={() => setReqDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New Requisition
              </Button>
            ) : (
              <Button className="gap-2" onClick={() => setCandidateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Candidate
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="requisitions" className="mt-4">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Openings</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequisitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No requisitions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequisitions.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.title}</TableCell>
                      <TableCell>{req.department}</TableCell>
                      <TableCell>{req.position}</TableCell>
                      <TableCell>{req.number_of_openings}</TableCell>
                      <TableCell>
                        <Badge variant={req.priority === "high" ? "destructive" : req.priority === "medium" ? "default" : "secondary"}>
                          {req.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{req.target_join_date ? new Date(req.target_join_date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={req.status === "open" ? "default" : req.status === "closed" ? "secondary" : "outline"}>
                          {req.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="candidates" className="mt-4">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Requisition</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Current Company</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No candidates found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCandidates.map((cand) => (
                    <TableRow
                      key={cand.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCandidate(cand.id)}
                    >
                      <TableCell className="font-medium">{cand.name}</TableCell>
                      <TableCell>{getReqTitle(cand.requisition_id)}</TableCell>
                      <TableCell>{cand.experience_years != null ? `${cand.experience_years} yrs` : "—"}</TableCell>
                      <TableCell className="capitalize">{cand.source || "—"}</TableCell>
                      <TableCell>{cand.current_company || "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[cand.status] || "bg-gray-100 text-gray-800"}`}>
                          {cand.status.replace("_", " ")}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <RequisitionFormDialog
        open={reqDialogOpen}
        onOpenChange={setReqDialogOpen}
        onSuccess={fetchData}
      />

      <CandidateFormDialog
        open={candidateDialogOpen}
        onOpenChange={setCandidateDialogOpen}
        requisitions={requisitions}
        onSuccess={fetchData}
      />

      {selectedCandidate && (
        <CandidateDetailsSheet
          candidateId={selectedCandidate}
          open={!!selectedCandidate}
          onOpenChange={(open) => !open && setSelectedCandidate(null)}
          requisitions={requisitions}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}
