import { cn } from "@/lib/utils";
import whatsappLogo from "@/assets/whatsapp-logo.png";

interface Props {
  className?: string;
}

export function WhatsAppIcon({ className }: Props) {
  return (
    <img
      src={whatsappLogo}
      alt="WhatsApp"
      className={cn("inline-block object-contain shrink-0", className)}
    />
  );
}
