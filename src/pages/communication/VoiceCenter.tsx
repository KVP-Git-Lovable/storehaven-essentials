import { Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const VoiceCenter = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold">Voice Center</h1>
      <p className="text-muted-foreground mt-1">Manage voice communication channels.</p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4" /> Voice
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">This module will be implemented in future phases.</p>
      </CardContent>
    </Card>
  </div>
);

export default VoiceCenter;
