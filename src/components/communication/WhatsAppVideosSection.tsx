import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Video, Copy, Trash2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "whatsapp-videos";

interface StoredVideo {
  name: string;
  url: string;
  size: number | null;
  createdAt: string | null;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function WhatsAppVideosSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["whatsapp-videos-list"],
    queryFn: async (): Promise<StoredVideo[]> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return (data ?? [])
        .filter((f) => f.name && !f.name.endsWith("/"))
        .map((f) => {
          const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(f.name);
          return {
            name: f.name,
            url: pub.publicUrl,
            size: (f.metadata as { size?: number } | null)?.size ?? null,
            createdAt: f.created_at ?? null,
          };
        });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_");
      const path = `${Date.now()}_${baseName || "video"}.mp4`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: "video/mp4",
        upsert: false,
      });
      if (error) throw error;
      return path;
    },
    onSuccess: () => {
      toast({ title: "Video uploaded", description: "Your video is now available." });
      qc.invalidateQueries({ queryKey: ["whatsapp-videos-list"] });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
    onSettled: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.storage.from(BUCKET).remove([name]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Video deleted" });
      qc.invalidateQueries({ queryKey: ["whatsapp-videos-list"] });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please select a video file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">WhatsApp Videos</CardTitle>
              <CardDescription className="text-xs mt-1">
                Upload videos and get public .mp4 links you can share over WhatsApp.
              </CardDescription>
            </div>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload Video
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : videos.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No videos uploaded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {videos.map((v) => (
              <div
                key={v.name}
                className="flex items-center gap-3 p-3 rounded-md border bg-card"
              >
                <Video className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{formatSize(v.size)}</div>
                </div>
                <Input
                  readOnly
                  value={v.url}
                  className="hidden md:block flex-1 text-xs font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" size="sm" onClick={() => copyLink(v.url)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteMutation.mutate(v.name)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}