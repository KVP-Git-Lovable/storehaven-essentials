import { useState, useRef } from "react";
import { Camera, Upload, Loader2, UserCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FaceCaptureDialog } from "@/components/staff/FaceCaptureDialog";

interface ProfilePhotoUploadProps {
  userId: string;
  currentPhotoUrl: string | null;
  username: string;
  onPhotoUpdate: (url: string) => Promise<void>;
}

export function ProfilePhotoUpload({
  userId,
  currentPhotoUrl,
  username,
  onPhotoUpdate,
}: ProfilePhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
      setPendingFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (imageData: string, file: File) => {
    setPreviewUrl(imageData);
    setPendingFile(file);
  };

  const uploadPhoto = async () => {
    if (!pendingFile) return;

    setIsUploading(true);
    try {
      const fileExt = pendingFile.name.split(".").pop();
      const fileName = `profile-photos/${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(fileName, pendingFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("employee-documents")
        .getPublicUrl(fileName);

      // Update profile with new photo URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_photo_url: urlData.publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      await onPhotoUpdate(urlData.publicUrl);
      setPreviewUrl(null);
      setPendingFile(null);
      toast.success("Profile photo updated successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const cancelPreview = () => {
    setPreviewUrl(null);
    setPendingFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const displayUrl = previewUrl || currentPhotoUrl;

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Profile Photo</Label>
      <p className="text-xs text-muted-foreground">
        This photo is used for attendance face verification
      </p>
      
      <div className="flex items-center gap-4">
        <Avatar className="h-24 w-24 border-2 border-border">
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt="Profile photo" className="object-cover" />
          ) : (
            <AvatarFallback className="bg-muted">
              <UserCircle className="h-12 w-12 text-muted-foreground" />
            </AvatarFallback>
          )}
        </Avatar>

        <div className="flex flex-col gap-2">
          {previewUrl ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={uploadPhoto}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelPreview}
                disabled={isUploading}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCameraOpen(true)}
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Photo
              </Button>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <FaceCaptureDialog
        open={isCameraOpen}
        onOpenChange={setIsCameraOpen}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}
