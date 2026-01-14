import { useState, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Filter, Search, X, Clock, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHIFT_TYPES = [
  { value: "Morning", label: "Morning", time: "06:00 - 14:00", color: "bg-amber-500/20 text-amber-700 border-amber-500/30" },
  { value: "Evening", label: "Evening", time: "14:00 - 22:00", color: "bg-blue-500/20 text-blue-700 border-blue-500/30" },
  { value: "Night", label: "Night", time: "22:00 - 06:00", color: "bg-purple-500/20 text-purple-700 border-purple-500/30" },
];

interface Guard {
  id: string;
  name: string;
  photo_url: string | null;
  phone: string;
  status: string;
  store_id: string | null;
  stores?: { name: string } | null;
  vendor_id: string | null;
  vendors?: { name: string } | null;
}

interface Store {
  id: string;
  name: string;
}

interface RosterTemplate {
  id: string;
  guard_id: string;
  store_id: string;
  day_of_week: number;
  shift_type: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  security_guards?: { name: string; photo_url: string | null };
}

// Draggable Guard Card Component
function DraggableGuard({ guard, isAssigned }: { guard: Guard; isAssigned?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: guard.id,
    data: { guard },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all",
        isDragging && "opacity-50 scale-105 shadow-lg",
        isAssigned && "border-primary/50 bg-primary/5"
      )}
    >
      <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
        <AvatarImage src={guard.photo_url || undefined} alt={guard.name} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {guard.name.split(" ").map(n => n[0]).join("").toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{guard.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {guard.stores?.name || "Unassigned"}
        </p>
      </div>
      {isAssigned && (
        <Badge variant="secondary" className="text-xs">Scheduled</Badge>
      )}
    </div>
  );
}

// Guard Card for Drag Overlay
function GuardDragOverlay({ guard }: { guard: Guard }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card shadow-2xl scale-105">
      <Avatar className="h-10 w-10 border-2 border-primary shadow-sm">
        <AvatarImage src={guard.photo_url || undefined} alt={guard.name} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {guard.name.split(" ").map(n => n[0]).join("").toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{guard.name}</p>
        <p className="text-xs text-muted-foreground">Drop to assign</p>
      </div>
    </div>
  );
}

// Droppable Calendar Cell
function DroppableCell({ 
  dayIndex, 
  shift, 
  storeId,
  assignments,
  onRemove
}: { 
  dayIndex: number; 
  shift: string; 
  storeId: string;
  assignments: RosterTemplate[];
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${dayIndex}-${shift}-${storeId}`,
    data: { dayIndex, shift, storeId },
  });

  const shiftConfig = SHIFT_TYPES.find(s => s.value === shift);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[80px] p-2 rounded-lg border-2 border-dashed transition-all",
        isOver ? "border-primary bg-primary/10" : "border-muted-foreground/20 bg-muted/30",
        assignments.length > 0 && "border-solid border-muted"
      )}
    >
      {assignments.length === 0 ? (
        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
          Drop guard here
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border text-xs",
                shiftConfig?.color
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={assignment.security_guards?.photo_url || undefined} />
                <AvatarFallback className="text-[10px] bg-background">
                  {assignment.security_guards?.name?.split(" ").map(n => n[0]).join("") || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate font-medium">
                {assignment.security_guards?.name}
              </span>
              <button
                onClick={() => onRemove(assignment.id)}
                className="hover:bg-background/50 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SecurityRoster() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [templates, setTemplates] = useState<RosterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [activeGuard, setActiveGuard] = useState<Guard | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedShift, setSelectedShift] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get current week dates
  const getWeekDates = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7));
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date;
    });
  };

  const weekDates = getWeekDates();

  useEffect(() => {
    fetchData();
  }, [selectedStore]);

  const fetchData = async () => {
    try {
      const [guardsRes, storesRes] = await Promise.all([
        supabase.from("security_guards").select(`
          id, name, photo_url, phone, status, store_id, vendor_id,
          stores(name),
          vendors(name)
        `).eq("status", "active"),
        supabase.from("stores").select("id, name").eq("status", "active"),
      ]);

      if (guardsRes.data) setGuards(guardsRes.data);
      if (storesRes.data) {
        setStores(storesRes.data);
        if (!selectedStore && storesRes.data.length > 0) {
          setSelectedStore(storesRes.data[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStore) {
      fetchTemplates();
    }
  }, [selectedStore]);

  const fetchTemplates = async () => {
    if (!selectedStore) return;
    
    const { data, error } = await supabase
      .from("security_roster_templates")
      .select(`
        *,
        security_guards(name, photo_url)
      `)
      .eq("store_id", selectedStore)
      .eq("is_active", true);

    if (data) setTemplates(data);
    if (error) console.error("Error fetching templates:", error);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const guard = guards.find(g => g.id === event.active.id);
    if (guard) setActiveGuard(guard);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveGuard(null);
    
    const { active, over } = event;
    if (!over || !selectedStore) return;

    const guardId = active.id as string;
    const [dayIndex, shift] = (over.id as string).split("-");

    // Check if already assigned
    const existing = templates.find(
      t => t.guard_id === guardId && 
           t.day_of_week === parseInt(dayIndex) && 
           t.shift_type === shift &&
           t.store_id === selectedStore
    );

    if (existing) {
      toast.info("Guard already assigned to this slot");
      return;
    }

    // Get shift times
    const shiftConfig = SHIFT_TYPES.find(s => s.value === shift);
    const [startTime, endTime] = shiftConfig?.time.split(" - ") || ["08:00", "20:00"];

    try {
      const { error } = await supabase.from("security_roster_templates").insert({
        guard_id: guardId,
        store_id: selectedStore,
        day_of_week: parseInt(dayIndex),
        shift_type: shift,
        start_time: startTime,
        end_time: endTime,
      });

      if (error) throw error;
      toast.success("Guard assigned to schedule");
      fetchTemplates();
    } catch (error) {
      console.error("Error assigning guard:", error);
      toast.error("Failed to assign guard");
    }
  };

  const handleRemoveAssignment = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from("security_roster_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;
      toast.success("Assignment removed");
      fetchTemplates();
    } catch (error) {
      console.error("Error removing assignment:", error);
      toast.error("Failed to remove assignment");
    }
  };

  const getAssignmentsForCell = (dayIndex: number, shift: string) => {
    return templates.filter(
      t => t.day_of_week === dayIndex && t.shift_type === shift
    );
  };

  const getScheduledGuardIds = () => {
    return new Set(templates.map(t => t.guard_id));
  };

  // Filter guards
  const filteredGuards = guards.filter(guard => {
    const matchesSearch = guard.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVendor = vendorFilter === "all" || guard.vendor_id === vendorFilter;
    const matchesStore = !selectedStore || guard.store_id === selectedStore || !guard.store_id;
    return matchesSearch && matchesVendor && matchesStore;
  });

  const uniqueVendors = [...new Set(guards.filter(g => g.vendor_id).map(g => ({ 
    id: g.vendor_id!, 
    name: g.vendors?.name || "Unknown" 
  })))];

  const scheduledGuardIds = getScheduledGuardIds();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-[calc(100vh-120px)] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Security Roster</h1>
            <p className="text-muted-foreground">Drag guards to assign shifts</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-[200px]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Panel - Guards */}
          <Card className="w-72 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Security Guards
              </CardTitle>
              <div className="space-y-2 mt-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search guards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={vendorFilter} onValueChange={setVendorFilter}>
                  <SelectTrigger className="h-9">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vendors</SelectItem>
                    {uniqueVendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-3 pt-0">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-3">
                  {filteredGuards.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No guards found
                    </div>
                  ) : (
                    filteredGuards.map((guard) => (
                      <DraggableGuard
                        key={guard.id}
                        guard={guard}
                        isAssigned={scheduledGuardIds.has(guard.id)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right Panel - Calendar */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Weekly Schedule
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={selectedShift} onValueChange={setSelectedShift}>
                    <SelectTrigger className="w-[140px] h-8">
                      <Clock className="h-3 w-3 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Shifts</SelectItem>
                      {SHIFT_TYPES.map((shift) => (
                        <SelectItem key={shift.value} value={shift.value}>
                          {shift.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setWeekOffset(prev => prev - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => setWeekOffset(0)}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setWeekOffset(prev => prev + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-3 pt-0">
              {!selectedStore ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a store to view schedule
                </div>
              ) : (
                <div className="min-w-[800px]">
                  {/* Day Headers */}
                  <div className="grid grid-cols-8 gap-2 mb-3">
                    <div className="p-2 text-sm font-medium text-muted-foreground">Shift</div>
                    {weekDates.map((date, index) => {
                      const isToday = date.toDateString() === new Date().toDateString();
                      return (
                        <div
                          key={index}
                          className={cn(
                            "p-2 text-center rounded-lg",
                            isToday && "bg-primary/10 text-primary"
                          )}
                        >
                          <div className="text-xs font-medium text-muted-foreground">
                            {DAYS_OF_WEEK[index]}
                          </div>
                          <div className={cn("text-lg font-semibold", isToday && "text-primary")}>
                            {date.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Shift Rows */}
                  {SHIFT_TYPES.filter(shift => selectedShift === "all" || selectedShift === shift.value).map((shift) => (
                    <div key={shift.value} className="grid grid-cols-8 gap-2 mb-3">
                      <div className="flex flex-col justify-center p-2">
                        <span className="text-sm font-medium">{shift.label}</span>
                        <span className="text-xs text-muted-foreground">{shift.time}</span>
                      </div>
                      {weekDates.map((_, dayIndex) => (
                        <DroppableCell
                          key={`${dayIndex}-${shift.value}`}
                          dayIndex={dayIndex}
                          shift={shift.value}
                          storeId={selectedStore}
                          assignments={getAssignmentsForCell(dayIndex, shift.value)}
                          onRemove={handleRemoveAssignment}
                        />
                      ))}
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-6 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">Legend:</span>
                    {SHIFT_TYPES.map((shift) => (
                      <div key={shift.value} className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", shift.color.split(" ")[0])} />
                        <span className="text-xs">{shift.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeGuard && <GuardDragOverlay guard={activeGuard} />}
      </DragOverlay>
    </DndContext>
  );
}
