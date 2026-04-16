import { useNavigate } from "react-router-dom";
import { MessageSquare, Users, Settings } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const cards = [
  {
    title: "WhatsApp Templates",
    description: "Create and manage message templates for WhatsApp communication",
    icon: MessageSquare,
    href: "/communication/templates",
  },
  {
    title: "WhatsApp Senders",
    description: "View and manage your WhatsApp-enabled sender numbers from Twilio",
    icon: Users,
    href: "/communication/whatsapp/senders",
  },
  {
    title: "View Configuration",
    description: "Manage Twilio WhatsApp configuration, credentials, and webhooks",
    icon: Settings,
    href: "/communication/whatsapp/config",
  },
];

const WhatsAppCenter = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">WhatsApp Center</h1>
          <p className="text-muted-foreground mt-1">
            Manage your WhatsApp communication including templates, senders, and configuration through Twilio integration.
          </p>
        </div>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
      </div>

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
    </div>
  );
};

export default WhatsAppCenter;
