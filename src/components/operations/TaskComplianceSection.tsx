import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, Upload, Loader2, CheckCircle, AlertTriangle, XCircle, Star } from "lucide-react";
import { ImageComparisonSlider } from "@/components/vm/ImageComparisonSlider";

interface TaskComplianceSectionProps {
  task: any;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  excellent: { color: "bg-green-100 text-green-800", icon: <Star className="h-3.5 w-3.5" />, label: "Excellent" },
  good: { color: "bg-blue-100 text-blue-800", icon: <CheckCircle className="h-3.5 w-3.5" />, label: "Good" },
  needs_improvement: { color: "bg-yellow-100 text-yellow-800", icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "Needs Improvement" },
  poor: { color: "bg-red-100 text-red-800", icon: <XCircle className="h-3.5 w-3.5" />, label: "Poor" },
};

export function TaskComplianceSection({ task }: TaskComplianceSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  const baselineUrl = task.task_master?.baseline_photo_url;
  const submittedUrl = task.submitted_photo_url;
  const complianceScore = task.compliance_score;
  const complianceStatus = task.compliance_status;
  const reasoning = task.compliance_reasoning;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `task-compliance/${task.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("vm-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("vm-images")
        .getPublicUrl(filePath);

      // Save the submitted photo URL
      const { error: updateError } = await supabase
        .from("task_instances")
        .update({ submitted_photo_url: publicUrl })
        .eq("id", task.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
      toast.success("Photo uploaded successfully");

      // Now run AI compliance check
      await runComplianceCheck(publicUrl);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const runComplianceCheck = async (submittedPhotoUrl: string) => {
    if (!baselineUrl) {
      toast.info("No baseline photo set — skipping AI compliance check");
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-task-compliance", {
        body: {
          baselineImageUrl: baselineUrl,
          submittedImageUrl: submittedPhotoUrl,
          taskName: task.task_master?.name || "Task",
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Save compliance results
      const { error: updateError } = await supabase
        .from("task_instances")
        .update({
          compliance_score: data.complianceScore,
          compliance_status: data.complianceStatus,
          compliance_reasoning: data.reasoning,
        })
        .eq("id", task.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["task-instances"] });
      toast.success(`Compliance score: ${data.complianceScore}%`);
    } catch (err: any) {
      toast.error(err.message || "Compliance check failed");
    } finally {
      setAnalyzing(false);
    }
  };

  if (!baselineUrl) return null;

  const config = complianceStatus ? statusConfig[complianceStatus] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" /> Photo Compliance Check
        </h4>
        {config && (
          <Badge className={`${config.color} gap-1`}>
            {config.icon}
            {config.label} — {complianceScore}%
          </Badge>
        )}
      </div>

      {/* Baseline preview */}
      {baselineUrl && !submittedUrl && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Baseline (reference) photo from Task Master:</p>
          <img src={baselineUrl} alt="Baseline" className="rounded-lg w-full max-h-48 object-cover border" />
        </div>
      )}

      {/* Comparison slider when both images exist */}
      {baselineUrl && submittedUrl && (
        <ImageComparisonSlider
          baseImage={baselineUrl}
          actualImage={submittedUrl}
          baseLabel="Baseline"
          actualLabel="Submitted"
        />
      )}

      {/* Reasoning */}
      {reasoning && (
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <span className="font-medium text-muted-foreground">AI Assessment: </span>
          {reasoning}
        </div>
      )}

      {/* Upload / Re-check actions */}
      {task.status !== "completed" && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="relative" disabled={uploading || analyzing}>
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {submittedUrl ? "Re-upload Photo" : "Upload Completion Photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </Button>
          {submittedUrl && baselineUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => runComplianceCheck(submittedUrl)}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Re-run Check
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
