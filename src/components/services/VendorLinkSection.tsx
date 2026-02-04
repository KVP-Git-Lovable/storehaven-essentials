import { useState, useEffect } from "react";
import { Link2, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VendorLinkSectionProps {
  contractId?: string;
}

interface VendorLink {
  id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
}

export function VendorLinkSection({ contractId }: VendorLinkSectionProps) {
  const [link, setLink] = useState<VendorLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (contractId) {
      fetchVendorLink();
    }
  }, [contractId]);

  const fetchVendorLink = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_contract_vendor_links")
      .select("*")
      .eq("service_contract_id", contractId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching vendor link:", error);
    } else {
      setLink(data);
    }
    setLoading(false);
  };

  const generateSecureToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const handleGenerateLink = async () => {
    setGenerating(true);
    
    try {
      // Deactivate existing links
      if (link) {
        await supabase
          .from("service_contract_vendor_links")
          .update({ is_active: false })
          .eq("service_contract_id", contractId);
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Generate new link
      const token = generateSecureToken();
      const { data, error } = await supabase
        .from("service_contract_vendor_links")
        .insert({
          service_contract_id: contractId,
          token,
          is_active: true,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;

      setLink(data);
      toast({
        title: "Success",
        description: "Vendor link generated successfully",
      });
    } catch (error) {
      console.error("Error generating vendor link:", error);
      toast({
        title: "Error",
        description: "Failed to generate vendor link",
        variant: "destructive",
      });
    }
    
    setGenerating(false);
  };

  const getVendorUrl = () => {
    if (!link) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/vendor/contract/${link.token}`;
  };

  const handleCopyLink = async () => {
    const url = getVendorUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Vendor link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleRegenerateLink = async () => {
    await handleGenerateLink();
  };

  // Show placeholder during contract creation
  if (!contractId) {
    return (
      <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Vendor Access Link
        </Label>
        <p className="text-xs text-muted-foreground">
          Save the contract first to generate a secure vendor access link.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Vendor Access Link</Label>
        <div className="h-10 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Vendor Access Link
        </Label>
        {link && (
          <Badge variant="outline" className="text-xs">
            Active
          </Badge>
        )}
      </div>

      {!link ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Generate a secure link that allows the vendor to view this contract without logging in.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateLink}
            disabled={generating}
            className="gap-2"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Generate Vendor Link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={getVendorUrl()}
              readOnly
              className="text-xs bg-background font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              title="Copy link"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => window.open(getVendorUrl(), "_blank")}
              title="Open link"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Created: {new Date(link.created_at).toLocaleDateString()}
              {link.last_accessed_at && (
                <> • Last accessed: {new Date(link.last_accessed_at).toLocaleDateString()}</>
              )}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRegenerateLink}
              disabled={generating}
              className="text-xs gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${generating ? "animate-spin" : ""}`} />
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
