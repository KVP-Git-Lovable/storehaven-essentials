import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WhatsAppConfig = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold">WhatsApp Configuration</h1>
      <p className="text-muted-foreground mt-1">
        This section will allow management of Twilio WhatsApp configuration including sender setup, credentials, and webhook configuration.
      </p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" /> Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">This module will be implemented in future phases.</p>
      </CardContent>
    </Card>
  </div>
);

export default WhatsAppConfig;
