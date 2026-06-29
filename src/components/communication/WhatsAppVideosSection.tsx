import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Video, Copy, Trash2, Loader2, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "whatsapp-videos";
const FFMPEG_CORE_VERSION = "0.12.6";
const FFMPEG_CORE_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

interface StoredVideo {
  name: string;
  url: string;
  size: number | null;
  createdAt: string | null;
  androidCompatible?: boolean | null;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// Inspect the first ~64 KB of an MP4 to confirm "fast start" — the moov atom
// must appear before mdat for Android WhatsApp to play it inline.
async function probeFastStart(url: string): Promise<boolean | null> {
  try {
    const resp = await fetch(url, { headers: { Range: "bytes=0-65535" } });
    if (!resp.ok && resp.status !== 206) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    // Search for ASCII 'moov' / 'mdat' inside the head bytes.
    const findTag = (tag: string) => {
      const t0 = tag.charCodeAt(0), t1 = tag.charCodeAt(1), t2 = tag.charCodeAt(2), t3 = tag.charCodeAt(3);
      for (let i = 0; i < buf.length - 4; i++) {
        if (buf[i] === t0 && buf[i+1] === t1 && buf[i+2] === t2 && buf[i+3] === t3) return i;
      }
      return -1;
    };
    const moov = findTag("moov");
    const mdat = findTag("mdat");
    if (moov === -1) return false;
    if (mdat === -1) return true;
    return moov < mdat;
  } catch {
    return null;
  }
}

// Lazy-load ffmpeg.wasm. The bundle is ~30 MB so only load on first upload.
let ffmpegPromise: Promise<any> | null = null;
async function getFfmpeg(onLog?: (msg: string) => void) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ff = new FFmpeg();
      ff.on("log", ({ message }: any) => onLog?.(message));
      await ff.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ff;
    })();
  }
  return ffmpegPromise;
}

// Normalize a video to Android-WhatsApp-safe MP4:
//   H.264 Baseline / Level 3.1, yuv420p, +faststart, CFR 30fps,
//   AAC mono 96k, max dimension 1280 px, ≤16 MB.
async function normalizeForAndroidWhatsApp(file: File, onProgress?: (msg: string) => void): Promise<Blob> {
  const { fetchFile } = await import("@ffmpeg/util");
  const ff = await getFfmpeg((m) => onProgress?.(m));
  const inputName = "in.mp4";
  const outputName = "out.mp4";
  await ff.writeFile(inputName, await fetchFile(file));
  // Two-pass attempt: first at 1100k, then re-encode harder if >16MB.
  const baseArgs = [
    "-i", inputName,
    "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.1",
    "-pix_fmt", "yuv420p",
    "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))',fps=30",
    "-c:a", "aac", "-b:a", "96k", "-ac", "1", "-ar", "44100",
    "-movflags", "+faststart",
    "-y",
  ];
  await ff.exec([...baseArgs, "-b:v", "1100k", "-maxrate", "1400k", "-bufsize", "2800k", outputName]);
  let data = await ff.readFile(outputName) as Uint8Array;
  if (data.byteLength > 16 * 1024 * 1024) {
    onProgress?.("Output > 16 MB, re-encoding at lower bitrate…");
    await ff.exec([...baseArgs, "-b:v", "650k", "-maxrate", "800k", "-bufsize", "1600k", outputName]);
    data = await ff.readFile(outputName) as Uint8Array;
  }
  try { await ff.deleteFile(inputName); await ff.deleteFile(outputName); } catch { /* ignore */ }
  return new Blob([data], { type: "video/mp4" });
}

export function WhatsAppVideosSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [refreshingName, setRefreshingName] = useState<string | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["whatsapp-videos-list"],
    queryFn: async (): Promise<StoredVideo[]> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      const base = (data ?? [])
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
      // Probe Android compatibility in parallel — best effort.
      const probed = await Promise.all(
        base.map(async (v) => ({ ...v, androidCompatible: await probeFastStart(v.url) })),
      );
      return probed;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Normalize on the client before uploading. Existing behavior (raw
      // upload of the user file) caused Android playback failures because
      // the source used H.264 High profile and was not fast-start.
      setProgressMsg("Preparing encoder…");
      let toUpload: Blob = file;
      try {
        toUpload = await normalizeForAndroidWhatsApp(file, (m) => {
          // Throttle log spam — only surface phase-style messages
          if (m.includes("frame=") || m.includes("size=")) setProgressMsg(m.trim().slice(0, 80));
        });
        setProgressMsg(`Normalized → ${(toUpload.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (err: any) {
        // Fall back to original file if WASM transcoding fails (rare on
        // unsupported browsers), but warn the operator.
        console.error("[whatsapp-videos] normalize failed:", err);
        toast({
          title: "Could not auto-encode in browser",
          description: "Uploading original file. Android users may see playback errors.",
          variant: "destructive",
        });
      }
      if (toUpload.size > 16 * 1024 * 1024) {
        throw new Error("Video is still larger than 16 MB after re-encoding. Please trim it and try again.");
      }
      const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_");
      const path = `${Date.now()}_${baseName || "video"}.mp4`;
      setProgressMsg("Uploading…");
      const { error } = await supabase.storage.from(BUCKET).upload(path, toUpload, {
        contentType: "video/mp4",
        upsert: false,
        cacheControl: "3600",
      });
      if (error) throw error;
      return path;
    },
    onSuccess: () => {
      toast({ title: "Video uploaded", description: "Normalized for Android WhatsApp playback." });
      qc.invalidateQueries({ queryKey: ["whatsapp-videos-list"] });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
    onSettled: () => { setUploading(false); setProgressMsg(""); },
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

  const refreshTemplateCache = async (name: string) => {
    setRefreshingName(name);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-templates", {
        body: { action: "refresh-media-cache", by_storage_path: name },
      });
      if (error) throw error;
      const refreshed = (data?.results || []).filter((r: any) => r.refreshed).length;
      const total = data?.count ?? 0;
      toast({
        title: total ? `Refreshed ${refreshed}/${total} template(s)` : "No templates use this video",
        description: total
          ? "Twilio will refetch the new file. Allow a minute for Meta to re-cache."
          : "Nothing to refresh.",
      });
    } catch (err: any) {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    } finally {
      setRefreshingName(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Invalid file", description: "Please select a video file.", variant: "destructive" });
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please pick a video under 200 MB before re-encoding.", variant: "destructive" });
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
                Uploads are auto-encoded to H.264 Baseline / AAC / fast-start MP4 (≤16 MB)
                so they play on Android WhatsApp as well as iOS and Web.
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
        {uploading && progressMsg && (
          <p className="text-xs text-muted-foreground mt-2">{progressMsg}</p>
        )}
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
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    <span className="truncate">{v.name}</span>
                    {v.androidCompatible === true && (
                      <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" /> Android-ready
                      </Badge>
                    )}
                    {v.androidCompatible === false && (
                      <Badge variant="destructive" className="gap-1 text-[10px] font-normal">
                        <ShieldAlert className="h-3 w-3" /> Not fast-start
                      </Badge>
                    )}
                  </div>
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
                  onClick={() => refreshTemplateCache(v.name)}
                  disabled={refreshingName === v.name}
                  title="Force Twilio/Meta to re-fetch this video for any template that uses it"
                >
                  {refreshingName === v.name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
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