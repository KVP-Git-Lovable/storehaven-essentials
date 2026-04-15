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
import { NodePropertyPanel } from "@/components/journey/NodePropertyPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Play, Pause, Users, Mail, Clock, GitBranch, LogOut, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const nodeTypes = {
  entry: EntryNode,
  message: MessageNode,
  delay: DelayNode,
  decision: DecisionNode,
  exit: ExitNode,
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
  const initialized = useRef(false);

  const { data: journey, isLoading } = useQuery({
    queryKey: ["journey", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("journeys").select("*").eq("id", id!).single();
      if (error) throw error;
      if (!initialized.current && data.canvas_data) {
        const canvas = data.canvas_data as any;
        if (canvas.nodes) setNodes(canvas.nodes);
        if (canvas.edges) setEdges(canvas.edges);
        initialized.current = true;
      }
      return data;
    },
    enabled: !!id,
  });

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2 } }, eds));
  }, [setEdges]);

  const addNode = (type: string) => {
    const defaults: Record<string, any> = {
      entry: { segment_type: "customer" },
      message: { channel: "email", template_body: "" },
      delay: { duration: 1, unit: "days" },
      decision: { condition: "opened" },
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
      // Save canvas first
      await supabase.from("journeys").update({ canvas_data: { nodes, edges }, status }).eq("id", id!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey", id] });
      toast.success("Journey status updated");
    },
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
            <Badge variant="outline" className="capitalize">{journey?.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/communication/journeys/${id}/analytics`)}>
            <BarChart3 className="mr-1 h-4 w-4" /> Analytics
          </Button>
          <Button variant="outline" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="mr-1 h-4 w-4" /> Save
          </Button>
          {journey?.status === "draft" || journey?.status === "paused" ? (
            <Button size="sm" onClick={() => statusMutation.mutate("active")}>
              <Play className="mr-1 h-4 w-4" /> Activate
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
                  <Mail className="h-4 w-4 mr-1" /> Message
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addNode("delay")} title="Delay Node">
                  <Clock className="h-4 w-4 mr-1" /> Delay
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addNode("decision")} title="Decision Node">
                  <GitBranch className="h-4 w-4 mr-1" /> Decision
                </Button>
                <Button variant="ghost" size="sm" onClick={() => addNode("exit")} title="Exit Node">
                  <LogOut className="h-4 w-4 mr-1" /> Exit
                </Button>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodePropertyPanel
            node={selectedNode}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
