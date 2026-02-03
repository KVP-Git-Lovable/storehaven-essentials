import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  photoUrl: string | null | undefined;
  username: string | null | undefined;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
}

export function UserAvatar({
  photoUrl,
  username,
  className,
  fallbackClassName,
  iconClassName,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return null;
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const initials = getInitials(username);
  const showImage = photoUrl && !imageError;

  return (
    <Avatar className={cn("border border-border", className)}>
      {showImage && (
        <AvatarImage
          src={photoUrl}
          alt={username || "User avatar"}
          className="object-cover"
          onError={() => setImageError(true)}
        />
      )}
      <AvatarFallback className={cn("bg-primary text-primary-foreground", fallbackClassName)}>
        {initials || <User className={cn("h-4 w-4", iconClassName)} />}
      </AvatarFallback>
    </Avatar>
  );
}
