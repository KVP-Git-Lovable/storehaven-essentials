import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EmailCenter = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold">Email Center</h1>
      <p className="text-muted-foreground mt-1">Manage email communication channels.</p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" /> Email
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">This module will be implemented in future phases.</p>
      </CardContent>
    </Card>
  </div>
);

export default EmailCenter;
