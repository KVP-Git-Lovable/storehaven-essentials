import { useNavigate } from "react-router-dom";
import { MessageSquare, MessagesSquare, Settings } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BackButton } from "@/components/shared/BackButton";
import { WalletBalanceCard } from "@/components/communication/WalletBalanceCard";
import { WhatsAppVideosSection } from "@/components/communication/WhatsAppVideosSection";
import whatsappLogo from "@/assets/whatsapp-logo.png";

const cards = [
  {
    title: "WhatsApp Templates",
    description: "Create and manage message templates for WhatsApp communication",
    icon: MessageSquare,
    href: "/communication/templates",
  },
  {
    title: "WhatsApp Conversations",
    description: "View all WhatsApp chats with customers, track orders and engagement.",
    icon: MessagesSquare,
    href: "/communication/whatsapp/conversations",
  },
  {
    title: "View Configuration",
    description: "Manage API WhatsApp configuration, credentials, and webhooks",
    icon: Settings,
    href: "/communication/whatsapp/config",
  },
];

const WhatsAppCenter = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">WhatsApp Center</h1>
          <p className="text-muted-foreground mt-1">
            Manage your WhatsApp communication including templates, senders, and configuration through API integration.
          </p>
        </div>
        <img src={whatsappLogo} alt="WhatsApp" className="h-10 w-10 object-contain" />
      </div>

      <WalletBalanceCard />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(card.href)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription className="text-xs mt-1">{card.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <WhatsAppVideosSection />
    </div>
  );
};

export default WhatsAppCenter;
