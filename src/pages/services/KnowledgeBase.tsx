import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  BookOpen,
  Eye,
  ThumbsUp,
  Edit,
  Trash2,
  Loader2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type AssetMaster = {
  id: string;
  name: string;
};

type KBArticle = {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  asset_master_id: string | null;
  category: string;
  keywords: string[];
  article_type: string;
  status: string;
  views_count: number;
  helpful_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  asset_master?: { name: string } | null;
};

const ARTICLE_TYPES = ["guide", "troubleshooting", "procedure", "reference", "faq"];
const CATEGORIES = [
  "general",
  "maintenance",
  "repair",
  "installation",
  "safety",
  "calibration",
  "cleaning",
  "inspection",
];

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [assetMasters, setAssetMasters] = useState<AssetMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAsset, setFilterAsset] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    summary: "",
    asset_master_id: "",
    category: "general",
    article_type: "guide",
    keywords: "",
    status: "active",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchArticles();
    fetchAssetMasters();
  }, []);

  const fetchAssetMasters = async () => {
    const { data } = await supabase
      .from("asset_masters")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    setAssetMasters(data || []);
  };

  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_base_articles")
      .select("*, asset_master:asset_master_id(name)")
      .order("updated_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load articles", variant: "destructive" });
    } else {
      setArticles(data as KBArticle[]);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchArticles();
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_base_articles")
      .select("*, asset_master:asset_master_id(name)")
      .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
      .order("views_count", { ascending: false });

    if (!error && data) {
      setArticles(data as KBArticle[]);
    }
    setLoading(false);
  };

  const handleAddClick = () => {
    setEditMode(false);
    setSelectedArticle(null);
    setFormData({
      title: "",
      content: "",
      summary: "",
      asset_master_id: "",
      category: "general",
      article_type: "guide",
      keywords: "",
      status: "active",
    });
    setFormOpen(true);
  };

  const handleEditClick = (article: KBArticle) => {
    setEditMode(true);
    setSelectedArticle(article);
    setFormData({
      title: article.title,
      content: article.content,
      summary: article.summary || "",
      asset_master_id: article.asset_master_id || "",
      category: article.category,
      article_type: article.article_type,
      keywords: article.keywords?.join(", ") || "",
      status: article.status,
    });
    setViewOpen(false);
    setFormOpen(true);
  };

  const handleViewClick = async (article: KBArticle) => {
    // Increment view count
    await supabase
      .from("knowledge_base_articles")
      .update({ views_count: article.views_count + 1 })
      .eq("id", article.id);

    setSelectedArticle({ ...article, views_count: article.views_count + 1 });
    setViewOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({ title: "Error", description: "Title and content are required", variant: "destructive" });
      return;
    }

    const keywordsArray = formData.keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k);

    const payload = {
      title: formData.title.trim(),
      content: formData.content.trim(),
      summary: formData.summary.trim() || null,
      asset_master_id: formData.asset_master_id || null,
      category: formData.category,
      article_type: formData.article_type,
      keywords: keywordsArray,
      status: formData.status,
    };

    if (editMode && selectedArticle) {
      const { error } = await supabase
        .from("knowledge_base_articles")
        .update(payload)
        .eq("id", selectedArticle.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update article", variant: "destructive" });
      } else {
        toast({ title: "Updated", description: "Article updated successfully" });
        setFormOpen(false);
        fetchArticles();
      }
    } else {
      const { error } = await supabase.from("knowledge_base_articles").insert(payload);

      if (error) {
        toast({ title: "Error", description: "Failed to create article", variant: "destructive" });
      } else {
        toast({ title: "Created", description: "Article created successfully" });
        setFormOpen(false);
        fetchArticles();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("knowledge_base_articles").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete article", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Article deleted" });
      setViewOpen(false);
      fetchArticles();
    }
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

  const filteredArticles = articles.filter((article) => {
    if (filterType !== "all" && article.article_type !== filterType) return false;
    if (filterCategory !== "all" && article.category !== filterCategory) return false;
    if (filterAsset !== "all" && article.asset_master_id !== filterAsset) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Articles and guides for maintenance and troubleshooting
          </p>
        </div>
        <Button className="gap-2" onClick={handleAddClick}>
          <Plus className="h-4 w-4" />
          Add Article
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{articles.length}</p>
                <p className="text-sm text-muted-foreground">Total Articles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {articles.reduce((sum, a) => sum + a.views_count, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <ThumbsUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {articles.reduce((sum, a) => sum + a.helpful_count, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Helpful Votes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100">
                <Filter className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Set(articles.map((a) => a.category)).size}
                </p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] flex gap-2">
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button variant="outline" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ARTICLE_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="capitalize">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat} className="capitalize">
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAsset} onValueChange={setFilterAsset}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Asset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assets</SelectItem>
            {assetMasters.map((asset) => (
              <SelectItem key={asset.id} value={asset.id}>
                {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Articles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredArticles.map((article) => (
          <Card
            key={article.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleViewClick(article)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base line-clamp-2">{article.title}</CardTitle>
                <Badge className={getTypeColor(article.article_type)}>
                  {article.article_type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                {article.summary || article.content.substring(0, 150)}...
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{article.category}</Badge>
                  {article.asset_master && (
                    <span>{article.asset_master.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {article.views_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" /> {article.helpful_count}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredArticles.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No articles found. Try adjusting your filters or add a new article.
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editMode ? "Edit Article" : "Add New Article"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter article title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Article Type</Label>
                  <Select
                    value={formData.article_type}
                    onValueChange={(v) => setFormData({ ...formData, article_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ARTICLE_TYPES.map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat} className="capitalize">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Linked Asset (Optional)</Label>
                <Select
                  value={formData.asset_master_id || "none"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, asset_master_id: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an asset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {assetMasters.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Summary (Short description)</Label>
                <Textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Brief summary of the article"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Content *</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Full article content..."
                  rows={10}
                />
              </div>

              <div className="space-y-2">
                <Label>Keywords (comma-separated)</Label>
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="maintenance, troubleshooting, repair"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>
                  {editMode ? "Save Changes" : "Create Article"}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {selectedArticle?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getTypeColor(selectedArticle?.article_type || "")}>
                  {selectedArticle?.article_type}
                </Badge>
                <Badge variant="outline">{selectedArticle?.category}</Badge>
                {selectedArticle?.asset_master && (
                  <Badge variant="secondary">{selectedArticle.asset_master.name}</Badge>
                )}
                <Badge variant={selectedArticle?.status === "active" ? "default" : "secondary"}>
                  {selectedArticle?.status}
                </Badge>
              </div>

              {selectedArticle?.summary && (
                <div className="bg-muted p-3 rounded-lg text-sm">
                  {selectedArticle.summary}
                </div>
              )}

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
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEditClick(selectedArticle!)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Article</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this article? This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(selectedArticle!.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
