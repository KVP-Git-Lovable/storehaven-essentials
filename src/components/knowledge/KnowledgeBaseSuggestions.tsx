import { useState, useEffect, useMemo } from "react";
import { BookOpen, Search, Eye, ThumbsUp, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

type KBArticle = {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  asset_master_id: string | null;
  category: string;
  keywords: string[];
  article_type: string;
  views_count: number;
  helpful_count: number;
  asset_master?: { name: string } | null;
  relevance_score?: number;
};

const ARTICLE_TYPES = [
  { value: "guide", label: "Guide" },
  { value: "troubleshooting", label: "Troubleshooting" },
  { value: "procedure", label: "Procedure" },
  { value: "reference", label: "Reference" },
  { value: "faq", label: "FAQ" },
];

const getTypeLabel = (value: string) =>
  ARTICLE_TYPES.find((t) => t.value === value)?.label || value;

type KnowledgeBaseSuggestionsProps = {
  assetMasterId?: string | null;
  vendorIds?: string[];
  ticketCategory?: string | null;
  searchContext?: string;
  onArticleSelect?: (article: KBArticle) => void;
  compact?: boolean;
  grouped?: boolean;
};

export function KnowledgeBaseSuggestions({
  assetMasterId,
  vendorIds = [],
  ticketCategory,
  searchContext,
  onArticleSelect,
  compact = false,
  grouped = true,
}: KnowledgeBaseSuggestionsProps) {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["troubleshooting", "guide", "procedure"]));

  useEffect(() => {
    fetchSuggestions();
  }, [assetMasterId, vendorIds.join(","), ticketCategory, searchContext]);

  const fetchSuggestions = async () => {
    setLoading(true);

    // Collect article IDs from various sources
    const articleIdSets: Set<string>[] = [];

    // 1. Articles linked to asset master (via junction or legacy field)
    if (assetMasterId) {
      const { data: linkedByAsset } = await supabase
        .from("kb_article_assets")
        .select("article_id")
        .eq("asset_master_id", assetMasterId);
      if (linkedByAsset?.length) {
        articleIdSets.push(new Set(linkedByAsset.map((a) => a.article_id)));
      }
    }

    // 2. Articles linked to vendors (OEM/Vendor)
    if (vendorIds.length > 0) {
      const { data: linkedByVendor } = await supabase
        .from("kb_article_vendors")
        .select("article_id")
        .in("vendor_id", vendorIds);
      if (linkedByVendor?.length) {
        articleIdSets.push(new Set(linkedByVendor.map((a) => a.article_id)));
      }
    }

    // Build a union of article IDs from asset/vendor links
    const linkedArticleIds = new Set<string>();
    articleIdSets.forEach((s) => s.forEach((id) => linkedArticleIds.add(id)));

    // 3. Fetch articles matching criteria
    let query = supabase
      .from("knowledge_base_articles")
      .select("*, asset_master:asset_master_id(name)")
      .eq("status", "active")
      .order("views_count", { ascending: false })
      .limit(50);

    // Filter by linked article IDs OR legacy asset_master_id OR matching category
    const orConditions: string[] = [];
    if (linkedArticleIds.size > 0) {
      orConditions.push(`id.in.(${Array.from(linkedArticleIds).join(",")})`);
    }
    if (assetMasterId) {
      orConditions.push(`asset_master_id.eq.${assetMasterId}`);
    }
    if (ticketCategory) {
      orConditions.push(`category.eq.${ticketCategory}`);
    }

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(","));
    }

    const { data, error } = await query;
    if (error || !data) {
      setArticles([]);
      setLoading(false);
      return;
    }

    // Score by relevance (keyword match on searchContext/title)
    const scoredArticles = (data as KBArticle[]).map((article) => {
      let relevance = 0;
      const words = (searchContext || "").toLowerCase().split(/\s+/).filter(Boolean);
      const titleLower = article.title.toLowerCase();
      const keywordsLower = (article.keywords || []).map((k) => k.toLowerCase());

      words.forEach((word) => {
        if (titleLower.includes(word)) relevance += 3;
        if (keywordsLower.some((k) => k.includes(word))) relevance += 2;
        if ((article.summary || "").toLowerCase().includes(word)) relevance += 1;
      });
      // Boost popularity
      relevance += Math.min(article.views_count / 10, 5);
      relevance += Math.min(article.helpful_count, 5);

      return { ...article, relevance_score: relevance };
    });

    // Sort by relevance desc, then views
    scoredArticles.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

    setArticles(scoredArticles);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchSuggestions();
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_base_articles")
      .select("*, asset_master:asset_master_id(name)")
      .eq("status", "active")
      .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
      .order("views_count", { ascending: false })
      .limit(30);

    if (!error && data) {
      setArticles(data as KBArticle[]);
    }
    setLoading(false);
  };

  const handleViewArticle = async (article: KBArticle) => {
    await supabase
      .from("knowledge_base_articles")
      .update({ views_count: article.views_count + 1 })
      .eq("id", article.id);

    setSelectedArticle({ ...article, views_count: article.views_count + 1 });
    setViewDialogOpen(true);
  };

  const handleMarkHelpful = async () => {
    if (!selectedArticle) return;

    await supabase
      .from("knowledge_base_articles")
      .update({ helpful_count: selectedArticle.helpful_count + 1 })
      .eq("id", selectedArticle.id);

    setSelectedArticle({
      ...selectedArticle,
      helpful_count: selectedArticle.helpful_count + 1,
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "troubleshooting":
        return "bg-amber-100 text-amber-800";
      case "guide":
        return "bg-blue-100 text-blue-800";
      case "procedure":
        return "bg-green-100 text-green-800";
      case "reference":
        return "bg-purple-100 text-purple-800";
      case "faq":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const toggleGroup = (type: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Group articles by type
  const groupedArticles = useMemo(() => {
    const groups: Record<string, KBArticle[]> = {};
    articles.forEach((a) => {
      if (!groups[a.article_type]) groups[a.article_type] = [];
      groups[a.article_type].push(a);
    });
    // Order by ARTICLE_TYPES definition
    const orderedTypes = ARTICLE_TYPES.map((t) => t.value).filter((t) => groups[t]);
    // Add any extra types not in the predefined list
    Object.keys(groups).forEach((t) => {
      if (!orderedTypes.includes(t)) orderedTypes.push(t);
    });
    return orderedTypes.map((type) => ({ type, articles: groups[type] || [] }));
  }, [articles]);

  // Shared article view dialog
  const ArticleViewDialog = () => (
    <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {selectedArticle?.title}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            <div className="flex items-center gap-2">
              <Badge className={getTypeColor(selectedArticle?.article_type || "")}>
                {getTypeLabel(selectedArticle?.article_type || "")}
              </Badge>
              <Badge variant="outline">{selectedArticle?.category}</Badge>
              {selectedArticle?.asset_master && (
                <Badge variant="secondary">{selectedArticle.asset_master.name}</Badge>
              )}
            </div>
            <div className="prose prose-sm max-w-none">
              <div
                dangerouslySetInnerHTML={{
                  __html: selectedArticle?.content.replace(/\n/g, "<br>") || "",
                }}
              />
            </div>
            {selectedArticle?.keywords && selectedArticle.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedArticle.keywords.map((keyword, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {selectedArticle?.views_count} views
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  {selectedArticle?.helpful_count} helpful
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={handleMarkHelpful}>
                <ThumbsUp className="h-4 w-4 mr-1" />
                Mark Helpful
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  // Compact inline display (e.g., used in Service Ticket create form)
  if (compact && !grouped) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          Related Knowledge
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : articles.length > 0 ? (
          <div className="space-y-1">
            {articles.slice(0, 5).map((article) => (
              <button
                key={article.id}
                onClick={() => handleViewArticle(article)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
              >
                <div className="font-medium truncate">{article.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {article.summary || article.content.substring(0, 80)}...
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">No related articles found</p>
        )}
        <ArticleViewDialog />
      </div>
    );
  }

  // Grouped display (default for Service Ticket details)
  if (grouped) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
          <BookOpen className="h-4 w-4" />
          Knowledge Base
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : groupedArticles.length > 0 && groupedArticles.some((g) => g.articles.length) ? (
          <div className="space-y-1">
            {groupedArticles.map(
              ({ type, articles: grpArticles }) =>
                grpArticles.length > 0 && (
                  <Collapsible
                    key={type}
                    open={expandedGroups.has(type)}
                    onOpenChange={() => toggleGroup(type)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm font-medium">
                        {expandedGroups.has(type) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <Badge className={`${getTypeColor(type)} text-xs`}>{getTypeLabel(type)}</Badge>
                        <span className="text-muted-foreground text-xs">({grpArticles.length})</span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 space-y-1 mt-1">
                      {grpArticles.slice(0, 4).map((article) => (
                        <button
                          key={article.id}
                          onClick={() => handleViewArticle(article)}
                          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-sm border"
                        >
                          <div className="font-medium truncate text-xs">{article.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {article.summary || article.content.substring(0, 60)}...
                          </div>
                        </button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">No related articles found</p>
        )}
        <ArticleViewDialog />
      </div>
    );
  }

  // Full card display (Knowledge Base page widget)
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-5 w-5" />
          Knowledge Base
        </CardTitle>
        <div className="flex gap-2">
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-8"
          />
          <Button size="sm" variant="outline" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleViewArticle(article)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{article.title}</span>
                        <Badge className={`text-xs ${getTypeColor(article.article_type)}`}>
                          {getTypeLabel(article.article_type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {article.summary || article.content.substring(0, 120)}...
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {article.asset_master && <span>Asset: {article.asset_master.name}</span>}
                        <span>{article.views_count} views</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {articles.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No articles found. Try a different search.
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      <ArticleViewDialog />
    </Card>
  );
}
