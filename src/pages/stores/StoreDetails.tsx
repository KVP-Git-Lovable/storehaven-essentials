import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Building2, Phone, Mail, User, MapPin, Loader2, Package, Home, Edit2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  designation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  contact_type: z.string().min(1, "Contact type is required"),
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

type Store = {
  id: string;
  name: string;
  address: string;
  phone: string;
  manager: string;
  status: string;
  assets: number;
};

type Rental = {
  id: string;
  store: string;
  landlord: string;
  rent: number;
  start_date: string;
  end_date: string;
  status: string;
};

type Contact = {
  id: string;
  store_id: string;
  contact_type: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type Asset = {
  id: string;
  name: string;
  category: string;
  location: string;
  condition: string;
  value: number;
  purchase_date: string;
};

export default function StoreDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [store, setStore] = useState<Store | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");

  const contactForm = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      designation: "",
      phone: "",
      email: "",
      contact_type: "primary",
      notes: "",
    },
  });

  useEffect(() => {
    if (id) {
      fetchStoreData();
    }
  }, [id]);

  const fetchStoreData = async () => {
    setLoading(true);
    
    // Fetch store details
    const { data: storeData, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", id)
      .single();

    if (storeError) {
      toast({ title: "Error", description: "Failed to load store details", variant: "destructive" });
      navigate("/stores");
      return;
    }

    setStore(storeData);

    // Fetch rentals for this store
    const { data: rentalsData } = await supabase
      .from("rentals")
      .select("*")
      .eq("store", storeData.name)
      .order("created_at", { ascending: false });

    setRentals(rentalsData || []);

    // Fetch contacts for this store
    const { data: contactsData } = await supabase
      .from("store_contacts")
      .select("*")
      .eq("store_id", id)
      .order("created_at", { ascending: false });

    setContacts(contactsData || []);

    // Fetch assets deployed at this store
    const { data: assetsData } = await supabase
      .from("assets")
      .select("*")
      .eq("location", storeData.name)
      .order("created_at", { ascending: false });

    setAssets(assetsData || []);

    setLoading(false);
  };

  const fetchAvailableAssets = async () => {
    const { data } = await supabase
      .from("assets")
      .select("*")
      .or(`location.is.null,location.eq.`)
      .order("name");
    
    // Also fetch assets not assigned to this store
    const { data: allAssets } = await supabase
      .from("assets")
      .select("*")
      .neq("location", store?.name || "")
      .order("name");

    setAvailableAssets(allAssets || []);
  };

  const onContactSubmit = async (data: ContactFormData) => {
    const { error } = await supabase.from("store_contacts").insert({
      store_id: id,
      name: data.name,
      designation: data.designation || null,
      phone: data.phone || null,
      email: data.email || null,
      contact_type: data.contact_type,
      notes: data.notes || null,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add contact", variant: "destructive" });
    } else {
      toast({ title: "Contact added", description: `${data.name} has been added.` });
      contactForm.reset();
      setContactDialogOpen(false);
      fetchStoreData();
    }
  };

  const handleAssignAsset = async () => {
    if (!selectedAssetId || !store) return;

    const { error } = await supabase
      .from("assets")
      .update({ location: store.name })
      .eq("id", selectedAssetId);

    if (error) {
      toast({ title: "Error", description: "Failed to assign asset", variant: "destructive" });
    } else {
      toast({ title: "Asset assigned", description: "Asset has been deployed to this store." });
      setSelectedAssetId("");
      setAssetDialogOpen(false);
      fetchStoreData();
      
      // Update store asset count
      await supabase
        .from("stores")
        .update({ assets: (store.assets || 0) + 1 })
        .eq("id", id);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    const { error } = await supabase
      .from("store_contacts")
      .delete()
      .eq("id", contactId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    } else {
      toast({ title: "Contact deleted", description: "Contact has been removed." });
      fetchStoreData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Store not found</p>
        <Button onClick={() => navigate("/stores")}>Back to Stores</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/stores")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{store.name}</h1>
            <Badge variant={store.status === "active" ? "default" : "secondary"}>
              {store.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <MapPin className="h-4 w-4" />
            <span>{store.address}</span>
          </div>
        </div>
      </div>

      {/* Store Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium">{store.manager}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Phone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <span className="font-medium">{store.phone}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assets Deployed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-medium">{assets.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <span className="font-medium">{rentals.filter(r => r.status === "active").length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rentals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="contacts">Contact Details</TabsTrigger>
          <TabsTrigger value="assets">Assets Deployed</TabsTrigger>
        </TabsList>

        {/* Rentals Tab */}
        <TabsContent value="rentals" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Rental Agreements</h2>
            <Button asChild size="sm">
              <Link to="/stores/rentals">
                <Plus className="h-4 w-4 mr-2" />
                Add Rental
              </Link>
            </Button>
          </div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Landlord</TableHead>
                  <TableHead>Monthly Rent</TableHead>
                  <TableHead>Lease Period</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No rental agreements found for this store
                    </TableCell>
                  </TableRow>
                ) : (
                  rentals.map((rental) => (
                    <TableRow key={rental.id}>
                      <TableCell className="font-medium">{rental.landlord}</TableCell>
                      <TableCell>₹{Number(rental.rent).toLocaleString()}</TableCell>
                      <TableCell>
                        {new Date(rental.start_date).toLocaleDateString()} - {new Date(rental.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rental.status === "active" ? "default" : "secondary"}>
                          {rental.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Store Contacts</h2>
            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                </DialogHeader>
                <Form {...contactForm}>
                  <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-4">
                    <FormField
                      control={contactForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Contact name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="contact_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="primary">Primary</SelectItem>
                                <SelectItem value="emergency">Emergency</SelectItem>
                                <SelectItem value="landlord">Landlord</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                <SelectItem value="security">Security</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="designation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Designation</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Store Manager" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+91 98765 43210" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={contactForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="email@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={contactForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Input placeholder="Additional notes" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Add Contact</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No contacts added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{contact.contact_type}</Badge>
                      </TableCell>
                      <TableCell>{contact.designation || "-"}</TableCell>
                      <TableCell>{contact.phone || "-"}</TableCell>
                      <TableCell>{contact.email || "-"}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Assets Deployed</h2>
            <Dialog open={assetDialogOpen} onOpenChange={(open) => {
              setAssetDialogOpen(open);
              if (open) fetchAvailableAssets();
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Asset
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Assign Asset to Store</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Asset</label>
                    <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an asset to assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAssets.length === 0 ? (
                          <SelectItem value="_none" disabled>No assets available</SelectItem>
                        ) : (
                          availableAssets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name} - {asset.category} ({asset.condition})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setAssetDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAssignAsset} disabled={!selectedAssetId}>
                      Assign Asset
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Purchase Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No assets deployed at this store
                    </TableCell>
                  </TableRow>
                ) : (
                  assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        <Link 
                          to={`/assets/inventory/${asset.id}`}
                          className="hover:underline text-primary"
                        >
                          {asset.name}
                        </Link>
                      </TableCell>
                      <TableCell>{asset.category}</TableCell>
                      <TableCell>
                        <Badge variant={asset.condition === "good" ? "default" : asset.condition === "fair" ? "secondary" : "destructive"}>
                          {asset.condition}
                        </Badge>
                      </TableCell>
                      <TableCell>₹{Number(asset.value).toLocaleString()}</TableCell>
                      <TableCell>{new Date(asset.purchase_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}