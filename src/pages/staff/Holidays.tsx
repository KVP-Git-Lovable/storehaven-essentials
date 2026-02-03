import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isSameMonth, startOfYear, endOfYear } from "date-fns";
import { Calendar, Loader2, PartyPopper, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  is_optional: boolean;
}

export default function Holidays() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const { isAdmin } = usePermissions();

  // Fetch holidays
  const { data: holidays, isLoading } = useQuery({
    queryKey: ["holidays", selectedYear],
    queryFn: async () => {
      // For now return sample data - table doesn't exist yet
      return [
        { id: "1", name: "Republic Day", date: `${selectedYear}-01-26`, type: "national", is_optional: false },
        { id: "2", name: "Holi", date: `${selectedYear}-03-25`, type: "festival", is_optional: false },
        { id: "3", name: "Good Friday", date: `${selectedYear}-03-29`, type: "religious", is_optional: true },
        { id: "4", name: "Independence Day", date: `${selectedYear}-08-15`, type: "national", is_optional: false },
        { id: "5", name: "Gandhi Jayanti", date: `${selectedYear}-10-02`, type: "national", is_optional: false },
        { id: "6", name: "Diwali", date: `${selectedYear}-11-01`, type: "festival", is_optional: false },
        { id: "7", name: "Christmas", date: `${selectedYear}-12-25`, type: "religious", is_optional: false },
      ] as Holiday[];
    },
  });

  const getTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      national: "default",
      festival: "secondary",
      religious: "outline",
    };
    return variants[type] || "outline";
  };

  const years = [currentYear - 1, currentYear, currentYear + 1];

  const totalHolidays = holidays?.length || 0;
  const mandatoryHolidays = holidays?.filter(h => !h.is_optional).length || 0;
  const optionalHolidays = holidays?.filter(h => h.is_optional).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Holiday Calendar</h1>
          <p className="text-muted-foreground">View public holidays and company holidays</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Holiday
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHolidays}</p>
                <p className="text-sm text-muted-foreground">Total Holidays</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <PartyPopper className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mandatoryHolidays}</p>
                <p className="text-sm text-muted-foreground">Mandatory</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Calendar className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{optionalHolidays}</p>
                <p className="text-sm text-muted-foreground">Optional</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holidays in {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : holidays && holidays.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Optional</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(holiday.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(holiday.date), "EEEE")}
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadge(holiday.type)}>
                        {holiday.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {holiday.is_optional ? (
                        <Badge variant="outline">Optional</Badge>
                      ) : (
                        <Badge variant="default">Mandatory</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No holidays configured for {selectedYear}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
