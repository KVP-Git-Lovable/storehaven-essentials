import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GuardFormDialog } from "@/components/security/GuardFormDialog";
import { GuardDetailsDialog } from "@/components/security/GuardDetailsDialog";
import { usePermissions } from "@/hooks/usePermissions";

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
  total_points: number;
  created_at: string;
  vendors?: { name: string } | null;
  stores?: { name: string } | null;
}

export default function SecurityGuards() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const { hasPermission } = usePermissions();
  const { accessibleStoreIds, isAdmin, loading: accessLoading } = useStoreAccess();

  const canCreate = hasPermission("security.guards", "create");
  const canEdit = hasPermission("security.guards", "edit");
  const canDelete = hasPermission("security.guards", "delete");

  useEffect(() => {
    if (!accessLoading) {
      fetchGuards();
    }
  }, [accessLoading, accessibleStoreIds]);

  const fetchGuards = async () => {
    try {
      const storeIds = Array.from(accessibleStoreIds);
      
      let query = supabase
        .from("security_guards")
        .select(`
          *,
          vendors(name),
          stores(name)
        `)
        .order("created_at", { ascending: false });
      
      // Apply store filter for non-admins
      if (!isAdmin && storeIds.length > 0) {
        query = query.in("store_id", storeIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGuards(data as Guard[]);
    } catch (error) {
      console.error("Error fetching guards:", error);
      toast.error("Failed to fetch security guards");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedGuard) return;
    try {
      const { error } = await supabase
        .from("security_guards")
        .delete()
        .eq("id", selectedGuard.id);

      if (error) throw error;
      toast.success("Guard deleted successfully");
      fetchGuards();
    } catch (error) {
      console.error("Error deleting guard:", error);
      toast.error("Failed to delete guard");
    } finally {
      setIsDeleteOpen(false);
      setSelectedGuard(null);
    }
  };

  const filteredGuards = guards.filter((guard) =>
    guard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guard.phone.includes(searchQuery)
  );

  if (loading || accessLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Security Guards</h1>
          <p className="text-muted-foreground">Manage security personnel onboarding</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setSelectedGuard(null); setIsFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Guard
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Assigned Store</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGuards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No security guards found
                </TableCell>
              </TableRow>
            ) : (
              filteredGuards.map((guard) => (
                <TableRow key={guard.id}>
                  <TableCell className="font-medium">{guard.name}</TableCell>
                  <TableCell>{guard.phone}</TableCell>
                  <TableCell>{guard.vendors?.name || "-"}</TableCell>
                  <TableCell>{guard.stores?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{guard.total_points} pts</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={guard.status === "active" ? "default" : "secondary"}>
                      {guard.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setSelectedGuard(guard); setIsDetailsOpen(true); }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedGuard(guard); setIsFormOpen(true); }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedGuard(guard); setIsDeleteOpen(true); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <GuardFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        guard={selectedGuard}
        onSuccess={() => { fetchGuards(); setIsFormOpen(false); }}
      />

      <GuardDetailsDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        guard={selectedGuard}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Guard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedGuard?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
