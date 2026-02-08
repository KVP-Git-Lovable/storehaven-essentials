import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, MinusCircle, ClipboardCheck, AlertTriangle, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GRNLineItemsSection } from "./GRNLineItemsSection";

interface QACriteria {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_mandatory: boolean;
  sort_order: number;
}

interface QAResult {
  id: string;
  grn_id: string;
  criteria_id: string;
  result: string;
  remarks: string | null;
  checked_by: string | null;
  checked_at: string | null;
}

interface GRN {
  id: string;
  grn_number: string;
  store_id: string;
  status: string;
  qa_status: string;
  qa_overall_result: string | null;
  qa_performed_by: string | null;
  qa_notes: string | null;
  requires_manager_review: boolean;
  manager_decision: string | null;
  manager_decision_by: string | null;
  manager_comments: string | null;
  return_to_vendor_flagged: boolean;
  return_to_vendor_reason: string | null;
}

interface Props {
  grn: GRN;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function GRNQualityCheckDialog({ grn, open, onOpenChange, onComplete }: Props) {
  const [criteria, setCriteria] = useState<QACriteria[]>([]);
  const [results, setResults] = useState<Map<string, QAResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [qaNotes, setQaNotes] = useState(grn.qa_notes || "");
  const [qaPerformedBy, setQaPerformedBy] = useState(grn.qa_performed_by || "");
  const [managerComments, setManagerComments] = useState(grn.manager_comments || "");
  const [returnReason, setReturnReason] = useState(grn.return_to_vendor_reason || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) fetchQAData();
  }, [open, grn.id]);

  const fetchQAData = async () => {
    try {
      const [criteriaRes, resultsRes] = await Promise.all([
        supabase
          .from("grn_qa_criteria")
          .select("*")
          .eq("status", "active")
          .order("sort_order"),
        supabase
          .from("grn_qa_results")
          .select("*")
          .eq("grn_id", grn.id),
      ]);

      if (criteriaRes.error) throw criteriaRes.error;
      if (resultsRes.error) throw resultsRes.error;

      setCriteria(criteriaRes.data || []);
      const map = new Map<string, QAResult>();
      (resultsRes.data || []).forEach(r => map.set(r.criteria_id, r));
      setResults(map);
    } catch (error) {
      console.error("Error fetching QA data:", error);
      toast.error("Failed to load QA checklist");
    } finally {
      setLoading(false);
    }
  };

  const setCheckResult = async (criteriaId: string, result: string, remarks?: string) => {
    try {
      const existing = results.get(criteriaId);
      if (existing) {
        const { error } = await supabase
          .from("grn_qa_results")
          .update({ result, remarks: remarks || existing.remarks, checked_at: new Date().toISOString(), checked_by: qaPerformedBy || null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("grn_qa_results")
          .insert([{
            grn_id: grn.id,
            criteria_id: criteriaId,
            result,
            remarks: remarks || null,
            checked_by: qaPerformedBy || null,
            checked_at: new Date().toISOString(),
          }]);
        if (error) throw error;
      }

      // Update GRN qa_status to in_progress if not started
      if (grn.qa_status === "not_started") {
        await supabase.from("grn").update({ qa_status: "in_progress" }).eq("id", grn.id);
      }

      fetchQAData();
    } catch (error) {
      console.error("Error saving QA result:", error);
      toast.error("Failed to save QA result");
    }
  };

  const submitQA = async () => {
    setSubmitting(true);
    try {
      // Check all mandatory criteria are completed
      const mandatoryCriteria = criteria.filter(c => c.is_mandatory);
      const allMandatoryDone = mandatoryCriteria.every(c => {
        const r = results.get(c.id);
        return r && r.result !== "pending";
      });

      if (!allMandatoryDone) {
        toast.error("Please complete all mandatory QA checks before submitting");
        setSubmitting(false);
        return;
      }

      if (!qaPerformedBy.trim()) {
        toast.error("Please enter QA performed by");
        setSubmitting(false);
        return;
      }

      // Calculate overall result
      const allResults = Array.from(results.values());
      const failedCount = allResults.filter(r => r.result === "fail").length;
      const passedCount = allResults.filter(r => r.result === "pass").length;

      // Check line items QA
      const { data: lineItems } = await supabase
        .from("grn_line_items")
        .select("*")
        .eq("grn_id", grn.id);

      const hasRejectedItems = (lineItems || []).some(li => li.rejected_quantity > 0);
      const allItemsPassed = (lineItems || []).every(li => li.qa_status === "passed");
      const hasPartialItems = (lineItems || []).some(li => li.qa_status === "partial");

      let overallResult: string;
      let requiresManagerReview = false;
      let newStatus: string;
      let returnFlagged = false;

      if (failedCount === 0 && !hasRejectedItems && allItemsPassed) {
        overallResult = "passed";
        newStatus = "verified";
      } else if (failedCount > 0 || hasRejectedItems) {
        if (hasPartialItems || passedCount > 0) {
          overallResult = "partial";
          requiresManagerReview = true;
          newStatus = "qa_hold";
          returnFlagged = hasRejectedItems;
        } else {
          overallResult = "failed";
          requiresManagerReview = true;
          newStatus = "qa_hold";
          returnFlagged = true;
        }
      } else {
        overallResult = "partial";
        requiresManagerReview = true;
        newStatus = "qa_hold";
      }

      const { error } = await supabase
        .from("grn")
        .update({
          qa_status: "completed",
          qa_overall_result: overallResult,
          qa_performed_by: qaPerformedBy,
          qa_performed_at: new Date().toISOString(),
          qa_notes: qaNotes || null,
          requires_manager_review: requiresManagerReview,
          return_to_vendor_flagged: returnFlagged,
          return_to_vendor_reason: returnFlagged ? returnReason || "Items failed quality check" : null,
          status: newStatus,
        })
        .eq("id", grn.id);

      if (error) throw error;

      toast.success(
        requiresManagerReview
          ? "QA completed — Sent for manager review (QA Hold)"
          : "QA passed — GRN verified"
      );

      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting QA:", error);
      toast.error("Failed to submit QA results");
    } finally {
      setSubmitting(false);
    }
  };

  const handleManagerDecision = async (decision: string) => {
    if (!managerComments.trim()) {
      toast.error("Please add comments for your decision");
      return;
    }
    setSubmitting(true);
    try {
      let newStatus: string;
      if (decision === "approved") {
        newStatus = "verified";
      } else if (decision === "return_to_vendor") {
        newStatus = "return_to_vendor";
      } else {
        newStatus = "rejected";
      }

      const { error } = await supabase
        .from("grn")
        .update({
          manager_decision: decision,
          manager_decision_by: "Manager",
          manager_decision_at: new Date().toISOString(),
          manager_comments: managerComments,
          status: newStatus,
          requires_manager_review: false,
        })
        .eq("id", grn.id);

      if (error) throw error;

      toast.success(`Manager decision: ${decision.replace("_", " ")}`);
      onComplete();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save manager decision");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "packaging": return "bg-blue-100 text-blue-800";
      case "temperature": return "bg-cyan-100 text-cyan-800";
      case "documentation": return "bg-purple-100 text-purple-800";
      case "quality": return "bg-green-100 text-green-800";
      case "quantity": return "bg-orange-100 text-orange-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const completedCount = Array.from(results.values()).filter(r => r.result !== "pending").length;
  const passedCount = Array.from(results.values()).filter(r => r.result === "pass").length;
  const failedCount = Array.from(results.values()).filter(r => r.result === "fail").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Quality Check — {grn.grn_number}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground py-8 text-center">Loading QA checklist...</p>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Checks</p>
                  <p className="text-xl font-bold">{criteria.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-xl font-bold">{completedCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-green-600">Passed</p>
                  <p className="text-xl font-bold text-green-600">{passedCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-red-600">Failed</p>
                  <p className="text-xl font-bold text-red-600">{failedCount}</p>
                </CardContent>
              </Card>
            </div>

            {/* QA Performer */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">QA Performed By *</label>
                <Input
                  value={qaPerformedBy}
                  onChange={(e) => setQaPerformedBy(e.target.value)}
                  placeholder="Inspector name"
                  disabled={grn.qa_status === "completed"}
                />
              </div>
              <div>
                <label className="text-sm font-medium">QA Notes</label>
                <Input
                  value={qaNotes}
                  onChange={(e) => setQaNotes(e.target.value)}
                  placeholder="Overall QA observations"
                  disabled={grn.qa_status === "completed"}
                />
              </div>
            </div>

            {/* QA Checklist */}
            <div>
              <h3 className="font-semibold mb-2">QA Checklist</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Criteria</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map((c, idx) => {
                    const result = results.get(c.id);
                    const currentResult = result?.result || "pending";
                    const isQADone = grn.qa_status === "completed";

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{c.name}</span>
                            {c.is_mandatory && <span className="text-red-500 ml-1">*</span>}
                            {c.description && (
                              <p className="text-xs text-muted-foreground">{c.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getCategoryColor(c.category)}>
                            {c.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant={currentResult === "pass" ? "default" : "ghost"}
                              className={currentResult === "pass" ? "bg-green-500 hover:bg-green-600" : ""}
                              onClick={() => !isQADone && setCheckResult(c.id, "pass")}
                              disabled={isQADone}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={currentResult === "fail" ? "default" : "ghost"}
                              className={currentResult === "fail" ? "bg-red-500 hover:bg-red-600" : ""}
                              onClick={() => !isQADone && setCheckResult(c.id, "fail")}
                              disabled={isQADone}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={currentResult === "na" ? "default" : "ghost"}
                              className={currentResult === "na" ? "bg-gray-500 hover:bg-gray-600" : ""}
                              onClick={() => !isQADone && setCheckResult(c.id, "na")}
                              disabled={isQADone}
                            >
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            defaultValue={result?.remarks || ""}
                            placeholder="Add remarks"
                            className="w-36"
                            disabled={isQADone}
                            onBlur={(e) => {
                              if (result && e.target.value !== (result.remarks || "")) {
                                setCheckResult(c.id, currentResult, e.target.value);
                              }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Line Items QA */}
            <GRNLineItemsSection
              grnId={grn.id}
              grnStatus={grn.status}
              storeId={grn.store_id}
              onItemsChanged={onComplete}
            />

            {/* Manager Review Section */}
            {grn.requires_manager_review && grn.qa_status === "completed" && !grn.manager_decision && (
              <Card className="border-orange-300 bg-orange-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                    <AlertTriangle className="h-4 w-4" />
                    Manager Review Required
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-orange-600">
                    This GRN has QA failures and requires a manager decision before proceeding.
                  </p>
                  {grn.return_to_vendor_flagged && (
                    <div>
                      <label className="text-sm font-medium">Return to Vendor Reason</label>
                      <Input
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        placeholder="Describe why items should be returned"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Manager Comments *</label>
                    <Textarea
                      value={managerComments}
                      onChange={(e) => setManagerComments(e.target.value)}
                      placeholder="Decision rationale..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleManagerDecision("approved")}
                      disabled={submitting}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="mr-1 h-4 w-4" /> Accept (Partial)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleManagerDecision("return_to_vendor")}
                      disabled={submitting}
                      className="border-orange-500 text-orange-600"
                    >
                      <Undo2 className="mr-1 h-4 w-4" /> Return to Vendor
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleManagerDecision("rejected")}
                      disabled={submitting}
                    >
                      <XCircle className="mr-1 h-4 w-4" /> Reject GRN
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manager Decision Display */}
            {grn.manager_decision && (
              <Card className={grn.manager_decision === "approved" ? "border-green-300 bg-green-50" : grn.manager_decision === "return_to_vendor" ? "border-orange-300 bg-orange-50" : "border-red-300 bg-red-50"}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium">Manager Decision: <Badge>{grn.manager_decision.replace(/_/g, " ")}</Badge></p>
                  {grn.manager_comments && <p className="text-sm mt-1">Comments: {grn.manager_comments}</p>}
                  {grn.manager_decision_by && <p className="text-xs text-muted-foreground mt-1">By: {grn.manager_decision_by}</p>}
                </CardContent>
              </Card>
            )}

            {/* Submit QA Button */}
            {grn.qa_status !== "completed" && (
              <div className="flex justify-end">
                <Button
                  onClick={submitQA}
                  disabled={submitting || completedCount === 0}
                  className="min-w-[200px]"
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {submitting ? "Submitting..." : "Submit QA Results"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
