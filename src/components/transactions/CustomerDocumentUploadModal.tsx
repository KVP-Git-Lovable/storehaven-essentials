import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUp, X, FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

interface DocumentUpload {
  file: File | null;
  preview: string | null;
  error: string | null;
}

interface CustomerDocumentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onUploadSuccess?: () => void;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function CustomerDocumentUploadModal({
  open,
  onOpenChange,
  customerId,
  customerName,
  onUploadSuccess,
}: CustomerDocumentUploadModalProps) {
  const [pan, setPan] = useState<DocumentUpload>({ file: null, preview: null, error: null });
  const [aadhaar, setAadhaar] = useState<DocumentUpload>({ file: null, preview: null, error: null });
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Invalid file type. Please upload JPG, PNG, or PDF only.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size exceeds 5MB limit.";
    }
    return null;
  };

  const handleFileSelect = (file: File, setter: (state: DocumentUpload) => void) => {
    const error = validateFile(file);
    if (error) {
      setter({ file: null, preview: null, error });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      let preview: string | null = null;
      if (file.type.startsWith("image/")) {
        preview = e.target?.result as string;
      }
      setter({ file, preview, error: null });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent, setter: (state: DocumentUpload) => void) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file, setter);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const uploads = [];

      // Upload PAN if selected
      if (pan.file) {
        const ext = pan.file.name.split(".").pop();
        const path = `${customerId}/PAN/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("customer-documents")
          .upload(path, pan.file);

        if (uploadError) throw new Error(`PAN upload failed: ${uploadError.message}`);

        const { data: publicUrl } = supabase.storage
          .from("customer-documents")
          .getPublicUrl(path);

        const { error: dbError } = await supabase.from("customer_documents").insert({
          customer_id: customerId,
          document_type: "PAN",
          file_name: pan.file.name,
          file_url: publicUrl.publicUrl,
          file_size: pan.file.size,
          file_type: pan.file.type,
          uploaded_by: (await supabase.auth.getUser()).data.user?.email || "unknown",
        });

        if (dbError) throw new Error(`Failed to save PAN metadata: ${dbError.message}`);
        uploads.push("PAN");
      }

      // Upload Aadhaar if selected
      if (aadhaar.file) {
        const ext = aadhaar.file.name.split(".").pop();
        const path = `${customerId}/AADHAAR/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("customer-documents")
          .upload(path, aadhaar.file);

        if (uploadError) throw new Error(`Aadhaar upload failed: ${uploadError.message}`);

        const { data: publicUrl } = supabase.storage
          .from("customer-documents")
          .getPublicUrl(path);

        const { error: dbError } = await supabase.from("customer_documents").insert({
          customer_id: customerId,
          document_type: "AADHAAR",
          file_name: aadhaar.file.name,
          file_url: publicUrl.publicUrl,
          file_size: aadhaar.file.size,
          file_type: aadhaar.file.type,
          uploaded_by: (await supabase.auth.getUser()).data.user?.email || "unknown",
        });

        if (dbError) throw new Error(`Failed to save Aadhaar metadata: ${dbError.message}`);
        uploads.push("Aadhaar");
      }

      return uploads;
    },
    onSuccess: (uploads) => {
      toast({
        title: "Success",
        description: `${uploads.join(" and ")} document(s) uploaded successfully.`,
      });
      setPan({ file: null, preview: null, error: null });
      setAadhaar({ file: null, preview: null, error: null });
      onUploadSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An error occurred during upload.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  const handleUpload = () => {
    if (!pan.file && !aadhaar.file) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one document to upload.",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate();
  };

  const DocumentUploadSection = ({
    title,
    doc,
    setDoc,
  }: {
    title: string;
    doc: DocumentUpload;
    setDoc: (state: DocumentUpload) => void;
  }) => (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">{title}</h3>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, setDoc)}
        className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => document.getElementById(`file-input-${title}`)?.click()}
      >
        {doc.preview ? (
          <div className="flex flex-col items-center gap-2">
            {doc.file?.type.startsWith("image/") ? (
              <img src={doc.preview} alt={title} className="h-16 w-16 object-cover rounded" />
            ) : (
              <FileText className="h-12 w-12 text-muted-foreground" />
            )}
            <p className="text-sm font-medium text-foreground">{doc.file?.name}</p>
            <p className="text-xs text-muted-foreground">
              {(doc.file?.size || 0) / 1024 > 1024
                ? ((doc.file?.size || 0) / (1024 * 1024)).toFixed(2) + " MB"
                : ((doc.file?.size || 0) / 1024).toFixed(2) + " KB"}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDoc({ file: null, preview: null, error: null });
              }}
              className="text-xs text-destructive hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-foreground">Drag and drop or click to select</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, or PDF (Max 5MB)</p>
          </div>
        )}
        <input
          id={`file-input-${title}`}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file, setDoc);
          }}
          className="hidden"
        />
      </div>
      {doc.error && <p className="text-xs text-destructive">{doc.error}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Documents - {customerName}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
          <DocumentUploadSection title="PAN" doc={pan} setDoc={setPan} />
          <DocumentUploadSection title="Aadhaar" doc={aadhaar} setDoc={setAadhaar} />
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={(!pan.file && !aadhaar.file) || uploading}>
            {uploading ? "Uploading..." : "Upload Documents"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
