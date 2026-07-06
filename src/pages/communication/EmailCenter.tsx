import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Megaphone } from "lucide-react";
import { BackButton } from "@/components/shared/BackButton";
import { ComposeEmailTab } from "./ComposeEmailTab";
import { MarketingTab } from "./marketing/MarketingTab";

const EmailCenter = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "marketing" ? "marketing" : "compose";
  const handleChange = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "marketing") next.set("tab", "marketing"); else next.delete("tab");
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <BackButton />
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">Email Center</h1>
        <p className="text-muted-foreground mt-1">
          Send transactional email or run marketing campaigns from your verified sender domains.
        </p>
      </div>

      <Tabs value={tab} onValueChange={handleChange} className="w-full">
        <TabsList>
          <TabsTrigger value="compose" className="gap-2"><Mail className="h-4 w-4" />Compose Email</TabsTrigger>
          <TabsTrigger value="marketing" className="gap-2"><Megaphone className="h-4 w-4" />Email Marketing</TabsTrigger>
        </TabsList>
        <TabsContent value="compose" className="mt-6"><ComposeEmailTab /></TabsContent>
        <TabsContent value="marketing" className="mt-6"><MarketingTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailCenter;
