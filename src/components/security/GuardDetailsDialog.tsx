import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Phone, Mail, MapPin, Heart, Briefcase, FileText, Shield } from "lucide-react";

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
  total_points: number;
  created_at: string;
  vendors?: { name: string } | null;
  stores?: { name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guard: Guard | null;
}

export function GuardDetailsDialog({ open, onOpenChange, guard }: Props) {
  if (!guard) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Guard Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header with Photo */}
          <div className="flex items-start gap-4">
            {guard.photo_url ? (
              <img
                src={guard.photo_url}
                alt={guard.name}
                className="w-24 h-24 rounded-lg object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center">
                <User className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{guard.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={guard.status === "active" ? "default" : "secondary"}>
                  {guard.status}
                </Badge>
                <Badge variant="outline">{guard.total_points} points</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Joined: {new Date(guard.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{guard.phone}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{guard.email || "-"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Address:</span>
                <p className="font-medium">{guard.address || "-"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Assignment Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Vendor:</span>
                <p className="font-medium">{guard.vendors?.name || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Store:</span>
                <p className="font-medium">{guard.stores?.name || "-"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Health Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Health Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Age:</span>
                <p className="font-medium">{guard.age || "-"} years</p>
              </div>
              <div>
                <span className="text-muted-foreground">Weight:</span>
                <p className="font-medium">{guard.weight || "-"} kg</p>
              </div>
              <div>
                <span className="text-muted-foreground">Height:</span>
                <p className="font-medium">{guard.height || "-"} cm</p>
              </div>
              <div>
                <span className="text-muted-foreground">Blood Group:</span>
                <p className="font-medium">{guard.blood_group || "-"}</p>
              </div>
              {guard.health_notes && (
                <div className="col-span-4">
                  <span className="text-muted-foreground">Health Notes:</span>
                  <p className="font-medium">{guard.health_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-medium">{guard.emergency_contact_name || "-"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{guard.emergency_contact_phone || "-"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              {guard.id_proof_url && (
                <a
                  href={guard.id_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View ID Proof
                </a>
              )}
              {guard.address_proof_url && (
                <a
                  href={guard.address_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View Address Proof
                </a>
              )}
              {!guard.id_proof_url && !guard.address_proof_url && (
                <p className="text-sm text-muted-foreground">No documents uploaded</p>
              )}
            </CardContent>
          </Card>

          {/* Experience */}
          {(guard.references_info || guard.previous_experience) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Experience & References
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {guard.previous_experience && Array.isArray(guard.previous_experience) && (guard.previous_experience as string[]).length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Previous Experience:</span>
                    <ul className="list-disc list-inside mt-1">
                      {(guard.previous_experience as string[]).map((exp, i) => (
                        <li key={i} className="font-medium">{exp}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {guard.references_info && Array.isArray(guard.references_info) && (guard.references_info as string[]).length > 0 && (
                  <div>
                    <span className="text-muted-foreground">References:</span>
                    <ul className="list-disc list-inside mt-1">
                      {(guard.references_info as string[]).map((ref, i) => (
                        <li key={i} className="font-medium">{ref}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
