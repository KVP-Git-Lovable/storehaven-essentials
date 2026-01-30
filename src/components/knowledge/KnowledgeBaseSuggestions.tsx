import { useState, useEffect } from "react";
import { BookOpen, Search, ExternalLink, Eye, ThumbsUp, Loader2 } from "lucide-react";
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
};

type KnowledgeBaseSuggestionsProps = {
  assetMasterId?: string | null;
  searchContext?: string;
  onArticleSelect?: (article: KBArticle) => void;
  compact?: boolean;
};

export function KnowledgeBaseSuggestions({
  assetMasterId,
  searchContext,
  onArticleSelect,
  compact = false,
}: KnowledgeBaseSuggestionsProps) {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, [assetMasterId, searchContext]);

  const fetchSuggestions = async () => {
    setLoading(true);
    
    if (assetMasterId) {
      // First try to find articles linked via the junction table
      const { data: linkedArticles } = await supabase
        .from("kb_article_assets")
        .select("article_id")
        .eq("asset_master_id", assetMasterId);
      
      const linkedArticleIds = linkedArticles?.map(a => a.article_id) || [];
      
      // Fetch articles either from junction table or legacy asset_master_id field
      let query = supabase
        .from("knowledge_base_articles")
        .select("*, asset_master:asset_master_id(name)")
        .eq("status", "active")
        .order("views_count", { ascending: false })
        .limit(10);
      
      if (linkedArticleIds.length > 0) {
        query = query.or(`id.in.(${linkedArticleIds.join(",")}),asset_master_id.eq.${assetMasterId}`);
      } else {
        query = query.eq("asset_master_id", assetMasterId);
      }
      
      const { data, error } = await query;
      if (!error && data) {
        setArticles(data as KBArticle[]);
      }
    } else {
      // No asset filter - fetch top articles
      const { data, error } = await supabase
        .from("knowledge_base_articles")
        .select("*, asset_master:asset_master_id(name)")
        .eq("status", "active")
        .order("views_count", { ascending: false })
        .limit(10);

      if (!error && data) {
        setArticles(data as KBArticle[]);
      }
    }
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
      .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,keywords.cs.{${searchQuery}}`)
      .order("views_count", { ascending: false })
      .limit(20);

    if (!error && data) {
      setArticles(data as KBArticle[]);
    }
    setLoading(false);
  };

  const handleViewArticle = async (article: KBArticle) => {
    // Increment view count
    await supabase
      .from("knowledge_base_articles")
      .update({ views_count: article.views_count + 1 })
      .eq("id", article.id);

    setSelectedArticle(article);
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
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (compact) {
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
          <p className="text-sm text-muted-foreground py-2">
            No related articles found
          </p>
        )}

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {selectedArticle?.title}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="flex items-center gap-2">
                  <Badge className={getTypeColor(selectedArticle?.article_type || "")}>
                    {selectedArticle?.article_type}
                  </Badge>
                  <Badge variant="outline">{selectedArticle?.category}</Badge>
                  {selectedArticle?.asset_master && (
                    <Badge variant="secondary">
                      {selectedArticle.asset_master.name}
                    </Badge>
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
      </div>
    );
  }

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
                          {article.article_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {article.summary || article.content.substring(0, 120)}...
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {article.asset_master && (
                          <span>Asset: {article.asset_master.name}</span>
                        )}
                        <span>{article.views_count} views</span>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
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

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {selectedArticle?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="flex items-center gap-2">
                <Badge className={getTypeColor(selectedArticle?.article_type || "")}>
                  {selectedArticle?.article_type}
                </Badge>
                <Badge variant="outline">{selectedArticle?.category}</Badge>
                {selectedArticle?.asset_master && (
                  <Badge variant="secondary">
                    {selectedArticle.asset_master.name}
                  </Badge>
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
    </Card>
  );
}
