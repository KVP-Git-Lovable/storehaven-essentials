import { useState, useEffect } from "react";
import { Pencil, Loader2, Zap, Sun } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type MeterMaster = {
  id: string;
  name: string;
  reading_parameter_count: number;
  reading_parameters: string[];
  details_to_capture: string;
};

type UtilityReading = {
  id: string;
  store: string;
  meter_master_id: string;
  asset_id: string | null;
  reading_date: string;
  readings: Record<string, number>;
  created_by: string;
  created_at: string;
  meter_master?: MeterMaster;
};

type MeterReadingsSectionProps = {
  onEditReading: (reading: UtilityReading) => void;
  refreshTrigger?: number;
};

export function MeterReadingsSection({ onEditReading, refreshTrigger }: MeterReadingsSectionProps) {
  const [readings, setReadings] = useState<UtilityReading[]>([]);
  const [meterMasters, setMeterMasters] = useState<MeterMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeterType, setSelectedMeterType] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const [readingsRes, mastersRes, storesRes] = await Promise.all([
      supabase.from("utility_readings").select("*").order("reading_date", { ascending: false }),
      supabase.from("meter_masters").select("*").order("name"),
      supabase.from("stores").select("id, name, is_restricted").order("name"),
    ]);

    // Get visible stores based on user access
    let visibleStores: { id: string; name: string; is_restricted: boolean }[] = storesRes.data || [];
    
    if (user) {
      const { data: accessRecords } = await supabase
        .from("store_user_access")
        .select("store_id")
        .eq("user_id", user.id);
      
      if (accessRecords && accessRecords.length > 0) {
        const accessibleStoreIds = new Set(accessRecords.map(r => r.store_id));
        visibleStores = visibleStores.filter(store => accessibleStoreIds.has(store.id));
      } else {
        visibleStores = visibleStores.filter(s => !s.is_restricted);
      }
    } else {
      visibleStores = visibleStores.filter(s => !s.is_restricted);
    }

    // Map meter masters
    const mastersMap = new Map((mastersRes.data || []).map(m => [m.id, m]));
    setMeterMasters(mastersRes.data || []);

    // Filter for Electricity (MESCOM) and Solar only
    const electricityMaster = mastersRes.data?.find(m => m.name === "Electricity (MESCOM)");
    
    const enrichedReadings = (readingsRes.data || [])
      .filter(r => {
        // Only show Electricity (MESCOM) and Solar readings
        const isMescom = electricityMaster && r.meter_master_id === electricityMaster.id;
        const isSolar = r.meter_master_id === "solar_custom";
        return isMescom || isSolar;
      })
      .map(r => ({
        ...r,
        readings: r.readings as Record<string, number>,
        meter_master: mastersMap.get(r.meter_master_id),
      }));
    
    // Filter readings to only show stores the user has access to
    const visibleStoreNames = new Set(visibleStores.map(s => s.name));
    const filteredReadings = enrichedReadings.filter(r => visibleStoreNames.has(r.store));
    
    setReadings(filteredReadings);
    setLoading(false);
  };

  // Group readings by date
  const groupedByDate = readings.reduce((acc, reading) => {
    const date = reading.reading_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(reading);
    return acc;
  }, {} as Record<string, UtilityReading[]>);

  // Filter by meter type if selected
  const filteredGroupedByDate = Object.entries(groupedByDate).reduce((acc, [date, dateReadings]) => {
    const filtered = dateReadings.filter(r => {
      if (selectedMeterType === "all") return true;
      if (selectedMeterType === "electricity") return r.meter_master?.name === "Electricity (MESCOM)";
      if (selectedMeterType === "solar") return r.meter_master_id === "solar_custom";
      return true;
    });
    if (filtered.length > 0) {
      acc[date] = filtered;
    }
    return acc;
  }, {} as Record<string, UtilityReading[]>);

  const sortedDates = Object.keys(filteredGroupedByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const getCalculatedValues = (reading: UtilityReading) => {
    const r = reading.readings;
    const isSolar = reading.meter_master_id === "solar_custom";
    
    if (isSolar) {
      const kwhDiff = (r["KWH_end"] || 0) - (r["KWH_start"] || 0);
      const units = kwhDiff * 100;
      return { kwhDiff, units, powerFactor: null, consumedUnits: null };
    }
    
    // Electricity (MESCOM) calculations
    const kwhStart = r["KWH_start"] || 0;
    const kwhEnd = r["KWH_end"] || 0;
    const kvahStart = r["KVAH_start"] || 0;
    const kvahEnd = r["KVAH_end"] || 0;
    
    const kwhDiff = kwhEnd - kwhStart;
    const kvahDiff = kvahEnd - kvahStart;
    const consumedUnits = kwhDiff * 7500;
    const powerFactor = kvahDiff !== 0 ? kwhDiff / kvahDiff : null;
    
    return { kwhDiff, kvahDiff, consumedUnits, powerFactor, units: null };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Meter Readings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Meter Readings
        </CardTitle>
        <Select value={selectedMeterType} onValueChange={setSelectedMeterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="electricity">Electricity (MESCOM)</SelectItem>
            <SelectItem value="solar">Solar</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedDates.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No meter readings found for Electricity (MESCOM) or Solar.
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm font-medium">
                  {format(new Date(date), "EEEE, MMMM d, yyyy")}
                </Badge>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Store</TableHead>
                      <TableHead className="whitespace-nowrap">Type</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Opening</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Closing</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Difference</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Units</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Power Factor</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroupedByDate[date].map(reading => {
                      const calc = getCalculatedValues(reading);
                      const isSolar = reading.meter_master_id === "solar_custom";
                      
                      return (
                        <TableRow key={reading.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {reading.store}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary" 
                              className={`gap-1 ${isSolar ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}`}
                            >
                              {isSolar ? <Sun className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                              {isSolar ? "Solar" : "Electricity"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isSolar ? (
                              <span>{(reading.readings["KWH_start"] || 0).toLocaleString()}</span>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="text-xs text-muted-foreground">KWH: {(reading.readings["KWH_start"] || 0).toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">KVAH: {(reading.readings["KVAH_start"] || 0).toLocaleString()}</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isSolar ? (
                              <span>{(reading.readings["KWH_end"] || 0).toLocaleString()}</span>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="text-xs text-muted-foreground">KWH: {(reading.readings["KWH_end"] || 0).toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground">KVAH: {(reading.readings["KVAH_end"] || 0).toLocaleString()}</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {isSolar ? (
                              <span>{calc.kwhDiff?.toLocaleString()}</span>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="text-xs">KWH: {calc.kwhDiff?.toLocaleString()}</div>
                                <div className="text-xs">KVAH: {calc.kvahDiff?.toLocaleString()}</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isSolar ? (
                              <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                                {calc.units?.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                {calc.consumedUnits?.toLocaleString()}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isSolar ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="font-medium">
                                {calc.powerFactor !== null ? calc.powerFactor.toFixed(3) : "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => onEditReading(reading)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
