import { useState, useEffect, useRef } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Vendor {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface Guard {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  date_of_birth: string | null;
  age: number | null;
  weight: number | null;
  height: number | null;
  blood_group: string | null;
  health_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  vendor_id: string | null;
  store_id: string | null;
  id_proof_url: string | null;
  address_proof_url: string | null;
  photo_url: string | null;
  references_info: unknown;
  previous_experience: unknown;
  status: string;
  login_pin: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guard: Guard | null;
  onSuccess: () => void;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function GuardFormDialog({ open, onOpenChange, guard, onSuccess }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    date_of_birth: "",
    age: "",
    weight: "",
    height: "",
    blood_group: "",
    health_notes: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    vendor_id: "",
    store_id: "",
    login_pin: "",
    references_info: "",
    previous_experience: "",
  });
  
  const [files, setFiles] = useState({
    id_proof: null as File | null,
    address_proof: null as File | null,
    photo: null as File | null,
  });

  useEffect(() => {
    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (guard) {
      setForm({
        name: guard.name,
        phone: guard.phone,
        email: guard.email || "",
        address: guard.address || "",
        date_of_birth: guard.date_of_birth || "",
        age: guard.age?.toString() || "",
        weight: guard.weight?.toString() || "",
        height: guard.height?.toString() || "",
        blood_group: guard.blood_group || "",
        health_notes: guard.health_notes || "",
        emergency_contact_name: guard.emergency_contact_name || "",
        emergency_contact_phone: guard.emergency_contact_phone || "",
        vendor_id: guard.vendor_id || "",
        store_id: guard.store_id || "",
        login_pin: guard.login_pin || "",
        references_info: typeof guard.references_info === 'string' ? guard.references_info : JSON.stringify(guard.references_info || []),
        previous_experience: typeof guard.previous_experience === 'string' ? guard.previous_experience : JSON.stringify(guard.previous_experience || []),
      });
    } else {
      setForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        date_of_birth: "",
        age: "",
        weight: "",
        height: "",
        blood_group: "",
        health_notes: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        vendor_id: "",
        store_id: "",
        login_pin: "",
        references_info: "",
        previous_experience: "",
      });
      setFiles({ id_proof: null, address_proof: null, photo: null });
    }
  }, [guard, open]);

  const fetchDropdowns = async () => {
    const [vendorsRes, storesRes] = await Promise.all([
      supabase.from("vendors").select("id, name").eq("status", "active"),
      supabase.from("stores").select("id, name").eq("status", "active"),
    ]);
    if (vendorsRes.data) setVendors(vendorsRes.data);
    if (storesRes.data) setStores(storesRes.data);
  };

  const uploadFile = async (file: File, folder: string) => {
    const fileName = `${folder}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("security-documents")
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from("security-documents")
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleSubmit = async () => {
    if (!form.name || !form.phone) {
      toast.error("Name and phone are required");
      return;
    }

    setIsSubmitting(true);
    try {
      let id_proof_url = guard?.id_proof_url || null;
      let address_proof_url = guard?.address_proof_url || null;
      let photo_url = guard?.photo_url || null;

      if (files.id_proof) {
        id_proof_url = await uploadFile(files.id_proof, "id-proofs");
      }
      if (files.address_proof) {
        address_proof_url = await uploadFile(files.address_proof, "address-proofs");
      }
      if (files.photo) {
        photo_url = await uploadFile(files.photo, "photos");
      }

      const guardData = {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
        date_of_birth: form.date_of_birth || null,
        age: form.age ? parseInt(form.age) : null,
        weight: form.weight ? parseFloat(form.weight) : null,
        height: form.height ? parseFloat(form.height) : null,
        blood_group: form.blood_group || null,
        health_notes: form.health_notes || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        vendor_id: form.vendor_id || null,
        store_id: form.store_id || null,
        login_pin: form.login_pin || null,
        id_proof_url,
        address_proof_url,
        photo_url,
        references_info: form.references_info ? JSON.parse(`[${form.references_info}]`.replace('[[', '[').replace(']]', ']')) : [],
        previous_experience: form.previous_experience ? JSON.parse(`[${form.previous_experience}]`.replace('[[', '[').replace(']]', ']')) : [],
      };

      if (guard) {
        const { error } = await supabase
          .from("security_guards")
          .update(guardData)
          .eq("id", guard.id);
        if (error) throw error;
        toast.success("Guard updated successfully");
      } else {
        const { error } = await supabase
          .from("security_guards")
          .insert(guardData);
        if (error) throw error;
        toast.success("Guard added successfully");
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving guard:", error);
      toast.error("Failed to save guard");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{guard ? "Edit Security Guard" : "Add Security Guard"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({...form, phone: e.target.value})}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({...form, email: e.target.value})}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Login PIN</Label>
                <Input
                  type="password"
                  value={form.login_pin}
                  onChange={(e) => setForm({...form, login_pin: e.target.value})}
                  placeholder="4-6 digit PIN"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({...form, address: e.target.value})}
                placeholder="Full address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Security Vendor</Label>
                <Select value={form.vendor_id} onValueChange={(v) => setForm({...form, vendor_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned Store</Label>
                <Select value={form.store_id} onValueChange={(v) => setForm({...form, store_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Emergency Contact Name</Label>
                <Input
                  value={form.emergency_contact_name}
                  onChange={(e) => setForm({...form, emergency_contact_name: e.target.value})}
                  placeholder="Contact person name"
                />
              </div>
              <div className="space-y-2">
                <Label>Emergency Contact Phone</Label>
                <Input
                  value={form.emergency_contact_phone}
                  onChange={(e) => setForm({...form, emergency_contact_phone: e.target.value})}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({...form, date_of_birth: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({...form, age: e.target.value})}
                  placeholder="Age in years"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input
                  type="number"
                  value={form.weight}
                  onChange={(e) => setForm({...form, weight: e.target.value})}
                  placeholder="70"
                />
              </div>
              <div className="space-y-2">
                <Label>Height (cm)</Label>
                <Input
                  type="number"
                  value={form.height}
                  onChange={(e) => setForm({...form, height: e.target.value})}
                  placeholder="175"
                />
              </div>
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Select value={form.blood_group} onValueChange={(v) => setForm({...form, blood_group: v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUPS.map((bg) => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Health Notes</Label>
              <Textarea
                value={form.health_notes}
                onChange={(e) => setForm({...form, health_notes: e.target.value})}
                placeholder="Any medical conditions, allergies, or fitness notes..."
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">ID Proof (Aadhar/PAN)</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFiles({...files, id_proof: e.target.files?.[0] || null})}
                />
                {guard?.id_proof_url && !files.id_proof && (
                  <p className="text-sm text-muted-foreground mt-2">Current file uploaded</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Address Proof</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFiles({...files, address_proof: e.target.files?.[0] || null})}
                />
                {guard?.address_proof_url && !files.address_proof && (
                  <p className="text-sm text-muted-foreground mt-2">Current file uploaded</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Photo</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFiles({...files, photo: e.target.files?.[0] || null})}
                />
                {guard?.photo_url && !files.photo && (
                  <img src={guard.photo_url} alt="Guard" className="w-24 h-24 object-cover rounded-lg mt-2" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="experience" className="space-y-4">
            <div className="space-y-2">
              <Label>References</Label>
              <Textarea
                value={form.references_info}
                onChange={(e) => setForm({...form, references_info: e.target.value})}
                placeholder='Enter references as: "Name - Phone - Relationship", one per line'
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Example: John Doe - 9876543210 - Former Employer
              </p>
            </div>

            <div className="space-y-2">
              <Label>Previous Work Experience</Label>
              <Textarea
                value={form.previous_experience}
                onChange={(e) => setForm({...form, previous_experience: e.target.value})}
                placeholder='Enter experience as: "Company - Role - Duration", one per line'
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Example: ABC Security - Guard - 2 years
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : guard ? "Update Guard" : "Add Guard"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
