import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { EntryNode } from "@/components/journey/EntryNode";
import { MessageNode } from "@/components/journey/MessageNode";
import { DelayNode } from "@/components/journey/DelayNode";
import { DecisionNode } from "@/components/journey/DecisionNode";
import { ExitNode } from "@/components/journey/ExitNode";
import { MessageResponseNode } from "@/components/journey/MessageResponseNode";
import { NodePropertyPanel } from "@/components/journey/NodePropertyPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Play, Pause, Users, Mail, Clock, GitBranch, LogOut, BarChart3, MessageCircleMore, Pencil, MousePointerClick, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { EditJourneyDetailsDialog } from "@/components/journey/EditJourneyDetailsDialog";
import { ResumeJourneyDialog } from "@/components/journey/ResumeJourneyDialog";

const nodeTypes = {
  entry: EntryNode,
  message: MessageNode,
  delay: DelayNode,
  decision: DecisionNode,
  exit: ExitNode,
  message_response: MessageResponseNode,
};

let idCounter = 0;
const getId = () => `node_${Date.now()}_${idCounter++}`;

export default function JourneyBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const initialized = useRef(false);

  const { data: journey, isLoading } = useQuery({
    queryKey: ["journey", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journeys")
        .select("*, list_view:list_view_id(id, name, entity_type)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      const lv = (data as any).list_view;
      const ac = (data as any).audience_config;
      const enrichEntry = (n: any) => {
        if (n.type !== "entry") return n;
        const extra: any = {};
        if (lv) {
          extra.list_view_id = lv.id;
          extra.list_view_name = lv.name;
          extra.list_view_entity_type = lv.entity_type;
        }
        if (ac) extra.audience_config = ac;
        return { ...n, data: { ...n.data, ...extra } };
      };
      if (!initialized.current && data.canvas_data) {
        const canvas = data.canvas_data as any;
        if (canvas.nodes) setNodes(canvas.nodes.map(enrichEntry));
        if (canvas.edges) setEdges(canvas.edges);
        initialized.current = true;
      } else if (lv || ac) {
        setNodes((nds) => nds.map(enrichEntry));
      }
      return data;
    },
    enabled: !!id,
  });

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2 } }, eds));
  }, [setEdges]);

  const addNode = (type: string) => {
    const lv = (journey as any)?.list_view;
    const ac = (journey as any)?.audience_config;
    const entryDefaults: any = ac
      ? { audience_config: ac, ...(lv ? { list_view_id: lv.id, list_view_name: lv.name, list_view_entity_type: lv.entity_type } : {}) }
      : lv
        ? { list_view_id: lv.id, list_view_name: lv.name, list_view_entity_type: lv.entity_type }
        : { segment_type: "customer" };
    const defaults: Record<string, any> = {
      entry: entryDefaults,
      message: { channel: "email", template_body: "", whatsapp_template_id: null, whatsapp_template_name: "", template_variables: {} },
      delay: { duration: 1, unit: "days" },
      decision: { condition: "opened" },
      message_response: { target_node_id: null, target_node_label: "", condition: "read", wait_value: 1, wait_unit: "hours" },
      exit: {},
    };
    const newNode: Node = {
      id: getId(),
      type,
      position: { x: 250, y: nodes.length * 150 + 50 },
      data: defaults[type] || {},
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("journeys")
        .update({ canvas_data: { nodes, edges } })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey", id] });
      toast.success("Journey saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      // Persist canvas first so the edge function reads the latest entry node
      await supabase.from("journeys").update({ canvas_data: { nodes, edges } }).eq("id", id!);
      if (status === "resume") {
        const { data, error } = await supabase.functions.invoke("journey-actions", {
          body: { action: "resume", journey_id: id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return { ...data, _action: "resume" };
      }
      if (status === "active") {
        // Use edge function to (re)resolve audience from list view + clear stale enrollments
        const { data, error } = await supabase.functions.invoke("journey-actions", {
          body: { action: "activate", journey_id: id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
      }
      const { error } = await supabase.functions.invoke("journey-actions", {
        body: { action: "pause", journey_id: id },
      });
      if (error) throw error;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["journey", id] });
      if (data?._action === "resume") {
        if (data.resumed > 0) {
          toast.success(`Journey resumed — ${data.resumed} previously completed participant${data.resumed === 1 ? "" : "s"} continuing from the newly added node`);
        } else {
          toast.success("Journey resumed");
        }
      } else if (data?.enrolled !== undefined) {
        const matched = data.matched ?? data.enrolled;
        const skipped = data.skipped ?? 0;
        if (data.enrolled === 0 && matched > 0) {
          toast.error(`Activated, but 0 of ${matched} contacts could be enrolled${data.reason ? ` — ${data.reason}` : ""}`);
        } else if (skipped > 0) {
          toast.success(`Journey activated — ${data.enrolled} of ${matched} enrolled (${skipped} skipped${data.reason ? `: ${data.reason}` : ""})`);
        } else {
          toast.success(`Journey activated — ${data.enrolled} contacts enrolled`);
        }
      } else {
        toast.success("Journey status updated");
      }
    },
    onError: (e: any) => toast.error(e.message || "Failed to update status"),
  });

  const onNodeClick = useCallback((_: any, node: Node) => setSelectedNode(node), []);

  const updateNodeData = (nodeId: string, data: Record<string, any>) => {
    setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data } : n)));
    if (selectedNode?.id === nodeId) setSelectedNode((prev) => prev ? { ...prev, data } : null);
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  if (isLoading) return <div className="flex items-center justify-center h-96 text-muted-foreground">Loading...</div>;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/communication/journeys")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-lg font-semibold">{journey?.name || "Journey"}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className="capitalize">{journey?.status}</Badge>
              {(journey as any)?.list_view && (
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  Audience: {(journey as any).list_view.name}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/communication/journeys/${id}/analytics`)}>
            <BarChart3 className="mr-1 h-4 w-4" /> Analytics
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditDetailsOpen(true)}>
            <Pencil className="mr-1 h-4 w-4" /> Edit Journey
          </Button>
          <Button variant="outline" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
          {journey?.status === "draft" ? (
            <Button size="sm" onClick={() => statusMutation.mutate("active")}>
              <Play className="mr-1 h-4 w-4" /> Activate
            </Button>
          ) : journey?.status === "paused" ? (
            <Button size="sm" onClick={() => setResumeDialogOpen(true)}>
              <Play className="mr-1 h-4 w-4" /> Resume
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => statusMutation.mutate("paused")}>
              <Pause className="mr-1 h-4 w-4" /> Pause
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          {(journey?.status === "active" || journey?.status === "paused") && (
            <div className="px-4 py-2 text-[12px] bg-orange-50 border-b border-orange-200 text-orange-800">
              You're editing a {journey?.status} journey. Edits to nodes apply to future executions only — already-processed contacts are not affected.
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Panel position="top-left">
              <div className="flex gap-1 bg-background border rounded-lg p-1 shadow-sm">
                <Button variant="ghost" size="sm" onClick={() => addNode("entry")} title="Entry Node">
                  <Users className="h-4 w-4 mr-1" /> Entry
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addNode("message")} title="Message Node">
                  <MessageCircleMore className="h-4 w-4 mr-1" /> Message
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addNode("delay")} title="Delay Node">
                  <Clock className="h-4 w-4 mr-1" /> Delay
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addNode("decision")} title="Decision Node">
                  <GitBranch className="h-4 w-4 mr-1" /> Decision
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addNode("message_response")} title="Message Response Node">
                  <MessageCircle className="h-4 w-4 mr-1" /> Message Response
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addNode("exit")} title="Exit Node">
                  <LogOut className="h-4 w-4 mr-1" /> Exit
                </Button>
              </div>
            </Panel>
            {!selectedNode && nodes.length > 0 && (
              <Panel position="top-right">
                <div className="flex items-center gap-1.5 bg-background/90 border rounded-md px-2 py-1 shadow-sm text-[11px] text-muted-foreground">
                  <MousePointerClick className="h-3 w-3" />
                  Click any node to edit its properties
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodePropertyPanel
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
            journeyStatus={journey?.status}
            journeyId={id}
          />
        )}
      </div>

      <EditJourneyDetailsDialog
        open={editDetailsOpen}
        onOpenChange={setEditDetailsOpen}
        journey={journey}
      />
      {id && (
        <ResumeJourneyDialog
          open={resumeDialogOpen}
          onOpenChange={setResumeDialogOpen}
          journeyId={id}
          onConfirmed={() => statusMutation.mutate("resume")}
        />
      )}
    </div>
  );
}
