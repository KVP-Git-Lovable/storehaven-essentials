import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Paperclip,
  Upload,
  Camera,
  Image as ImageIcon,
  FileText,
  File,
  Eye,
  Trash2,
  Loader2,
  Download,
} from "lucide-react";

interface MasterTaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

interface NSOmasterTaskAttachmentsProps {
  taskId: string;
}

export function NSOmasterTaskAttachments({ taskId }: NSOmasterTaskAttachmentsProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<MasterTaskAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["nso-master-task-attachments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nso_master_task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MasterTaskAttachment[];
    },
    enabled: !!taskId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      setIsUploading(true);
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split(".").pop();
        const fileName = `master/${taskId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("nso-attachments")
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("nso-attachments")
          .getPublicUrl(fileName);

        const { error: insertError } = await supabase.from("nso_master_task_attachments").insert({
          task_id: taskId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: "current_user",
        });
        if (insertError) throw insertError;
      });
      await Promise.all(uploadPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-task-attachments", taskId] });
      toast.success("Files uploaded successfully");
      setIsUploading(false);
    },
    onError: () => {
      toast.error("Failed to upload files");
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachment: MasterTaskAttachment) => {
      const urlParts = attachment.file_url.split("/nso-attachments/");
      if (urlParts.length > 1) {
        await supabase.storage.from("nso-attachments").remove([urlParts[1]]);
      }
      const { error } = await supabase
        .from("nso_master_task_attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nso-master-task-attachments", taskId] });
      toast.success("Attachment deleted");
    },
    onError: () => toast.error("Failed to delete attachment"),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadMutation.mutate(files);
    }
    e.target.value = "";
  };

  const isImage = (fileType: string | null) => fileType?.startsWith("image/");

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string | null) => {
    if (isImage(fileType)) return ImageIcon;
    if (fileType?.includes("pdf")) return FileText;
    return File;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-foreground flex items-center gap-2 font-medium">
          <Paperclip className="h-4 w-4" />
          Attachments ({attachments.length})
        </Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Camera</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Upload</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileSelect}
          />
          <input
            ref={cameraInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.file_type);
            const isImg = isImage(attachment.file_type);
            return (
              <div
                key={attachment.id}
                className="group relative border rounded-lg overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div
                  className="aspect-square flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    setPreviewAttachment(attachment);
                    setPreviewOpen(true);
                  }}
                >
                  {isImg ? (
                    <img
                      src={attachment.file_url}
                      alt={attachment.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileIcon className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setPreviewAttachment(attachment);
                      setPreviewOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="icon" className="h-8 w-8" asChild>
                    <a href={attachment.file_url} download={attachment.file_name}>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => deleteMutation.mutate(attachment)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-2 border-t bg-background">
                  <p className="text-xs font-medium truncate" title={attachment.file_name}>
                    {attachment.file_name}
                  </p>
                  {attachment.file_size && (
                    <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/20">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No attachments yet</p>
            <p className="text-xs text-muted-foreground">
              Click Camera or Upload to add photos and documents
            </p>
          </div>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="pr-8 truncate">{previewAttachment?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[300px] max-h-[70vh] overflow-auto">
            {previewAttachment && isImage(previewAttachment.file_type) ? (
              <img
                src={previewAttachment.file_url}
                alt={previewAttachment.file_name}
                className="max-w-full max-h-[65vh] object-contain rounded-lg"
              />
            ) : previewAttachment?.file_type?.includes("pdf") ? (
              <iframe
                src={previewAttachment.file_url}
                className="w-full h-[65vh] rounded-lg"
                title={previewAttachment.file_name}
              />
            ) : (
              <div className="text-center p-8">
                <File className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
                <Button asChild>
                  <a href={previewAttachment?.file_url} download={previewAttachment?.file_name}>
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </a>
                </Button>
              </div>
            )}
          </div>
          {previewAttachment && (
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                {formatFileSize(previewAttachment.file_size)}
                {previewAttachment.created_at && (
                  <span className="ml-3">
                    Uploaded {new Date(previewAttachment.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <a href={previewAttachment.file_url} download={previewAttachment.file_name}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteMutation.mutate(previewAttachment);
                    setPreviewOpen(false);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
