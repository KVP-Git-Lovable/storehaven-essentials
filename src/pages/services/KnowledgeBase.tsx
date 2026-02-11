import { useState, useEffect, useRef } from "react";
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
  Upload,
  Video,
  Users,
  Building2,
  FileText,
  X,
  Download,
  Sparkles,
  CheckCircle,
  XCircle,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type AssetMaster = {
  id: string;
  name: string;
};

type Vendor = {
  id: string;
  name: string;
  vendor_type: string | null;
};

type KBAttachment = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
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
  video_urls: string[] | null;
  sme_names: string[] | null;
  dos: string[] | null;
  donts: string[] | null;
  process_steps: string[] | null;
  ai_generated: boolean | null;
  asset_master?: { name: string } | null;
  kb_article_assets?: { asset_master_id: string; asset_master: { name: string } }[];
  kb_article_vendors?: { vendor_id: string; vendor_role: string; vendor: { name: string } }[];
  kb_article_attachments?: KBAttachment[];
};

const ARTICLE_TYPES = [
  { value: "guide", label: "Guide" },
  { value: "troubleshooting", label: "Troubleshooting" },
  { value: "procedure", label: "Procedure" },
  { value: "reference", label: "Reference" },
  { value: "faq", label: "FAQ" },
];

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "maintenance", label: "Maintenance" },
  { value: "repair", label: "Repair" },
  { value: "installation", label: "Installation" },
  { value: "safety", label: "Safety" },
  { value: "calibration", label: "Calibration" },
  { value: "cleaning", label: "Cleaning" },
  { value: "inspection", label: "Inspection" },
];

const getArticleTypeLabel = (value: string) => 
  ARTICLE_TYPES.find(t => t.value === value)?.label || value;

const getCategoryLabel = (value: string) => 
  CATEGORIES.find(c => c.value === value)?.label || value;

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [assetMasters, setAssetMasters] = useState<AssetMaster[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAsset, setFilterAsset] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    summary: "",
    category: "general",
    article_type: "guide",
    keywords: "",
    status: "active",
    video_urls: "",
    sme_names: "",
    linked_asset_ids: [] as string[],
    linked_vendor_ids: [] as string[],
    attachments: [] as { file_name: string; file_url: string; file_type: string; file_size: number }[],
    dos: "",
    donts: "",
    process_steps: "",
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchArticles();
    fetchAssetMasters();
    fetchVendors();
  }, []);

  const fetchAssetMasters = async () => {
    const { data } = await supabase
      .from("asset_masters")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    setAssetMasters(data || []);
  };

  const fetchVendors = async () => {
    const { data } = await supabase
      .from("vendors")
      .select("id, name, vendor_type")
      .eq("status", "active")
      .order("name");
    setVendors(data || []);
  };

  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_base_articles")
      .select(`
        *,
        asset_master:asset_master_id(name),
        kb_article_assets(asset_master_id, asset_master:asset_master_id(name)),
        kb_article_vendors(vendor_id, vendor_role, vendor:vendor_id(name)),
        kb_article_attachments(id, file_name, file_url, file_type, file_size)
      `)
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
      .select(`
        *,
        asset_master:asset_master_id(name),
        kb_article_assets(asset_master_id, asset_master:asset_master_id(name)),
        kb_article_vendors(vendor_id, vendor_role, vendor:vendor_id(name)),
        kb_article_attachments(id, file_name, file_url, file_type, file_size)
      `)
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
      category: "general",
      article_type: "guide",
      keywords: "",
      status: "active",
      video_urls: "",
      sme_names: "",
      linked_asset_ids: [],
      linked_vendor_ids: [],
      attachments: [],
      dos: "",
      donts: "",
      process_steps: "",
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
      category: article.category,
      article_type: article.article_type,
      keywords: article.keywords?.join(", ") || "",
      status: article.status,
      video_urls: article.video_urls?.join("\n") || "",
      sme_names: article.sme_names?.join(", ") || "",
      linked_asset_ids: article.kb_article_assets?.map(a => a.asset_master_id) || [],
      linked_vendor_ids: article.kb_article_vendors?.map(v => v.vendor_id) || [],
      attachments: article.kb_article_attachments?.map(a => ({
        file_name: a.file_name,
        file_url: a.file_url,
        file_type: a.file_type || "",
        file_size: a.file_size || 0,
      })) || [],
      dos: article.dos?.join("\n") || "",
      donts: article.donts?.join("\n") || "",
      process_steps: article.process_steps?.join("\n") || "",
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments = [...formData.attachments];

    for (const file of Array.from(files)) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `articles/${fileName}`;

      const { error } = await supabase.storage
        .from("kb-attachments")
        .upload(filePath, file);

      if (error) {
        toast({ title: "Upload Error", description: `Failed to upload ${file.name}`, variant: "destructive" });
      } else {
        const { data: urlData } = supabase.storage
          .from("kb-attachments")
          .getPublicUrl(filePath);

        newAttachments.push({
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
        });
      }
    }

    setFormData({ ...formData, attachments: newAttachments });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    const newAttachments = formData.attachments.filter((_, i) => i !== index);
    setFormData({ ...formData, attachments: newAttachments });
  };

  const handleGenerateAI = async () => {
    if (formData.attachments.length === 0 && !formData.video_urls.trim()) {
      toast({ 
        title: "No sources", 
        description: "Please upload documents or add video URLs first", 
        variant: "destructive" 
      });
      return;
    }

    setGeneratingAI(true);
    try {
      const videoUrlsArray = formData.video_urls
        .split("\n")
        .map((v) => v.trim())
        .filter((v) => v);

      const { data, error } = await supabase.functions.invoke("generate-kb-content", {
        body: {
          documentUrls: formData.attachments,
          videoUrls: videoUrlsArray,
          existingTitle: formData.title || null,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const generated = data.data;
        setFormData({
          ...formData,
          title: formData.title || generated.title || "",
          summary: generated.summary || formData.summary,
          content: generated.content || formData.content,
          category: generated.category || formData.category,
          article_type: generated.article_type || formData.article_type,
          keywords: Array.isArray(generated.keywords) 
            ? generated.keywords.join(", ") 
            : formData.keywords,
          dos: Array.isArray(generated.dos) 
            ? generated.dos.join("\n") 
            : formData.dos,
          donts: Array.isArray(generated.donts) 
            ? generated.donts.join("\n") 
            : formData.donts,
          process_steps: Array.isArray(generated.process_steps) 
            ? generated.process_steps.join("\n") 
            : formData.process_steps,
        });
        toast({ 
          title: "AI Generated", 
          description: "Content has been populated from your sources" 
        });
      } else {
        throw new Error(data?.error || "Failed to generate content");
      }
    } catch (err) {
      console.error("AI generation error:", err);
      toast({ 
        title: "Generation Failed", 
        description: err instanceof Error ? err.message : "Could not generate content",
        variant: "destructive" 
      });
    } finally {
      setGeneratingAI(false);
    }
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

    const videoUrlsArray = formData.video_urls
      .split("\n")
      .map((v) => v.trim())
      .filter((v) => v);

    const smeNamesArray = formData.sme_names
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);

    const dosArray = formData.dos
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d);

    const dontsArray = formData.donts
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d);

    const processStepsArray = formData.process_steps
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s);

    const payload = {
      title: formData.title.trim(),
      content: formData.content.trim(),
      summary: formData.summary.trim() || null,
      asset_master_id: formData.linked_asset_ids[0] || null,
      category: formData.category,
      article_type: formData.article_type,
      keywords: keywordsArray,
      status: formData.status,
      video_urls: videoUrlsArray,
      sme_names: smeNamesArray,
      dos: dosArray,
      donts: dontsArray,
      process_steps: processStepsArray,
    };

    if (editMode && selectedArticle) {
      const { error } = await supabase
        .from("knowledge_base_articles")
        .update(payload)
        .eq("id", selectedArticle.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update article", variant: "destructive" });
        return;
      }

      // Update linked assets
      await supabase.from("kb_article_assets").delete().eq("article_id", selectedArticle.id);
      if (formData.linked_asset_ids.length > 0) {
        await supabase.from("kb_article_assets").insert(
          formData.linked_asset_ids.map(assetId => ({
            article_id: selectedArticle.id,
            asset_master_id: assetId,
          }))
        );
      }

      // Update linked vendors
      await supabase.from("kb_article_vendors").delete().eq("article_id", selectedArticle.id);
      if (formData.linked_vendor_ids.length > 0) {
        await supabase.from("kb_article_vendors").insert(
          formData.linked_vendor_ids.map(vendorId => ({
            article_id: selectedArticle.id,
            vendor_id: vendorId,
            vendor_role: vendors.find(v => v.id === vendorId)?.vendor_type === "OEM" ? "oem" : "vendor",
          }))
        );
      }

      // Update attachments
      await supabase.from("kb_article_attachments").delete().eq("article_id", selectedArticle.id);
      if (formData.attachments.length > 0) {
        await supabase.from("kb_article_attachments").insert(
          formData.attachments.map(att => ({
            article_id: selectedArticle.id,
            file_name: att.file_name,
            file_url: att.file_url,
            file_type: att.file_type,
            file_size: att.file_size,
          }))
        );
      }

      toast({ title: "Updated", description: "Article updated successfully" });
      setFormOpen(false);
      fetchArticles();
    } else {
      const { data: newArticle, error } = await supabase
        .from("knowledge_base_articles")
        .insert(payload)
        .select()
        .single();

      if (error || !newArticle) {
        toast({ title: "Error", description: "Failed to create article", variant: "destructive" });
        return;
      }

      // Insert linked assets
      if (formData.linked_asset_ids.length > 0) {
        await supabase.from("kb_article_assets").insert(
          formData.linked_asset_ids.map(assetId => ({
            article_id: newArticle.id,
            asset_master_id: assetId,
          }))
        );
      }

      // Insert linked vendors
      if (formData.linked_vendor_ids.length > 0) {
        await supabase.from("kb_article_vendors").insert(
          formData.linked_vendor_ids.map(vendorId => ({
            article_id: newArticle.id,
            vendor_id: vendorId,
            vendor_role: vendors.find(v => v.id === vendorId)?.vendor_type === "OEM" ? "oem" : "vendor",
          }))
        );
      }

      // Insert attachments
      if (formData.attachments.length > 0) {
        await supabase.from("kb_article_attachments").insert(
          formData.attachments.map(att => ({
            article_id: newArticle.id,
            file_name: att.file_name,
            file_url: att.file_url,
            file_type: att.file_type,
            file_size: att.file_size,
          }))
        );
      }

      toast({ title: "Created", description: "Article created successfully" });
      setFormOpen(false);
      fetchArticles();
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
    if (filterAsset !== "all") {
      const hasAsset = article.kb_article_assets?.some(a => a.asset_master_id === filterAsset) ||
                       article.asset_master_id === filterAsset;
      if (!hasAsset) return false;
    }
    return true;
  });

  const getLinkedAssetNames = (article: KBArticle) => {
    const names: string[] = [];
    if (article.kb_article_assets && article.kb_article_assets.length > 0) {
      article.kb_article_assets.forEach(a => names.push(a.asset_master?.name || ""));
    } else if (article.asset_master) {
      names.push(article.asset_master.name);
    }
    return names.filter(n => n);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              <SelectItem key={type.value} value={type.value}>
                {type.label}
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
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
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
                  {getArticleTypeLabel(article.article_type)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                {article.summary || article.content.substring(0, 150)}...
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{getCategoryLabel(article.category)}</Badge>
                  {getLinkedAssetNames(article).slice(0, 2).map((name, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                  ))}
                  {getLinkedAssetNames(article).length > 2 && (
                    <span className="text-xs">+{getLinkedAssetNames(article).length - 2}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {article.kb_article_attachments && article.kb_article_attachments.length > 0 && (
                    <FileText className="h-3 w-3" />
                  )}
                  {article.video_urls && article.video_urls.length > 0 && (
                    <Video className="h-3 w-3" />
                  )}
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {article.views_count}
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
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editMode ? "Edit Article" : "Add New Article"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter article title"
                />
              </div>

              {/* Video URLs - moved up for AI generation */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video URLs (one per line)
                </Label>
                <Textarea
                  value={formData.video_urls}
                  onChange={(e) => setFormData({ ...formData, video_urls: e.target.value })}
                  placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/..."
                  rows={2}
                />
              </div>

              {/* Document Attachments - moved up for AI generation */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents & Attachments
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Files
                  </Button>
                </div>
                {formData.attachments.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {formData.attachments.map((att, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{att.file_name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(att.file_size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Generate Button - prominent position */}
              <div className="p-4 border rounded-lg bg-gradient-to-r from-primary/5 to-primary/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Auto-Fill
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Upload documents or add video URLs, then let AI populate all fields
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={generatingAI || (formData.attachments.length === 0 && !formData.video_urls.trim())}
                  >
                    {generatingAI ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Content
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

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
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
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
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Multi-select Linked Assets */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Linked Assets
                </Label>
                <MultiSelectCombobox
                  options={assetMasters.map(asset => ({
                    value: asset.id,
                    label: asset.name,
                  }))}
                  selected={formData.linked_asset_ids}
                  onChange={(ids) => setFormData({ ...formData, linked_asset_ids: ids })}
                  placeholder="Select assets..."
                  searchPlaceholder="Search assets..."
                  emptyMessage="No assets found."
                  maxDisplayedBadges={2}
                />
              </div>

              {/* Linked Vendors (OEM/Vendor) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Associated Vendors / OEMs
                </Label>
                <MultiSelectCombobox
                  options={vendors.map(vendor => ({
                    value: vendor.id,
                    label: vendor.name,
                    subtitle: vendor.vendor_type || undefined,
                  }))}
                  selected={formData.linked_vendor_ids}
                  onChange={(ids) => setFormData({ ...formData, linked_vendor_ids: ids })}
                  placeholder="Select vendors..."
                  searchPlaceholder="Search vendors..."
                  emptyMessage="No vendors found."
                  maxDisplayedBadges={2}
                />
              </div>

              {/* SME Names */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Key SME (Subject Matter Experts)
                </Label>
                <Input
                  value={formData.sme_names}
                  onChange={(e) => setFormData({ ...formData, sme_names: e.target.value })}
                  placeholder="John Doe, Jane Smith (comma-separated)"
                />
              </div>

              <Separator />

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
                  rows={8}
                />
              </div>

              {/* Do's */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Do's (one per line)
                </Label>
                <Textarea
                  value={formData.dos}
                  onChange={(e) => setFormData({ ...formData, dos: e.target.value })}
                  placeholder="Always check temperature before operation&#10;Ensure proper ventilation&#10;Follow daily cleaning schedule"
                  rows={4}
                />
              </div>

              {/* Don'ts */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Don'ts (one per line)
                </Label>
                <Textarea
                  value={formData.donts}
                  onChange={(e) => setFormData({ ...formData, donts: e.target.value })}
                  placeholder="Never operate with damaged seals&#10;Do not overload the unit&#10;Avoid using harsh chemicals"
                  rows={4}
                />
              </div>

              {/* Process Steps */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ListOrdered className="h-4 w-4 text-blue-600" />
                  Process Steps (one per line)
                </Label>
                <Textarea
                  value={formData.process_steps}
                  onChange={(e) => setFormData({ ...formData, process_steps: e.target.value })}
                  placeholder="Step 1: Power off the equipment&#10;Step 2: Open the access panel&#10;Step 3: Check the compressor"
                  rows={5}
                />
              </div>

              <Separator />

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
                  {getArticleTypeLabel(selectedArticle?.article_type || "")}
                </Badge>
                <Badge variant="outline">{getCategoryLabel(selectedArticle?.category || "")}</Badge>
                <Badge variant={selectedArticle?.status === "active" ? "default" : "secondary"}>
                  {selectedArticle?.status}
                </Badge>
              </div>

              {/* Linked Assets */}
              {selectedArticle && getLinkedAssetNames(selectedArticle).length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Assets:</span>
                  {getLinkedAssetNames(selectedArticle).map((name, i) => (
                    <Badge key={i} variant="secondary">{name}</Badge>
                  ))}
                </div>
              )}

              {/* Linked Vendors */}
              {selectedArticle?.kb_article_vendors && selectedArticle.kb_article_vendors.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Vendors:</span>
                  {selectedArticle.kb_article_vendors.map((v, i) => (
                    <Badge key={i} variant="outline">
                      {v.vendor?.name} ({v.vendor_role})
                    </Badge>
                  ))}
                </div>
              )}

              {/* SME Names */}
              {selectedArticle?.sme_names && selectedArticle.sme_names.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">SME:</span>
                  {selectedArticle.sme_names.map((name, i) => (
                    <Badge key={i} variant="secondary">{name}</Badge>
                  ))}
                </div>
              )}

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

              {/* Do's */}
              {selectedArticle?.dos && selectedArticle.dos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    Do's
                  </div>
                  <ul className="space-y-1 pl-6 list-disc">
                    {selectedArticle.dos.map((item, i) => (
                      <li key={i} className="text-sm text-green-700">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Don'ts */}
              {selectedArticle?.donts && selectedArticle.donts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                    <XCircle className="h-4 w-4" />
                    Don'ts
                  </div>
                  <ul className="space-y-1 pl-6 list-disc">
                    {selectedArticle.donts.map((item, i) => (
                      <li key={i} className="text-sm text-red-700">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Process Steps */}
              {selectedArticle?.process_steps && selectedArticle.process_steps.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                    <ListOrdered className="h-4 w-4" />
                    Process Steps
                  </div>
                  <ol className="space-y-1 pl-6 list-decimal">
                    {selectedArticle.process_steps.map((step, i) => (
                      <li key={i} className="text-sm">{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Video Links */}
              {selectedArticle?.video_urls && selectedArticle.video_urls.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Video className="h-4 w-4" />
                    Videos
                  </div>
                  <div className="space-y-1">
                    {selectedArticle.video_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-primary hover:underline truncate"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {selectedArticle?.kb_article_attachments && selectedArticle.kb_article_attachments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    Documents
                  </div>
                  <div className="space-y-1">
                    {selectedArticle.kb_article_attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{att.file_name}</span>
                        <Download className="h-4 w-4 ml-auto text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

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
