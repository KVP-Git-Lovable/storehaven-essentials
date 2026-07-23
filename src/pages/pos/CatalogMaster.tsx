import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function CatalogMaster() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Catalog Master</h1>
        <p className="text-muted-foreground">
          Manage your catalog data. Configuration coming soon.
        </p>
      </div>

      <Card className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Catalog Master</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          This section is a placeholder. Catalog data will be added here shortly.
        </p>
      </Card>
    </div>
  );
}