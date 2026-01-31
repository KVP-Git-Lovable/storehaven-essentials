import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Pause, Play, Trash2, Clock, User, ShoppingCart } from "lucide-react";

interface HeldOrder {
  id: string;
  cart_data: any;
  customer_id: string | null;
  note: string | null;
  store_id: string | null;
  expires_at: string;
  created_at: string;
}

interface HeldOrdersPanelProps {
  storeId: string;
  onRecall: (cartData: any, customerId: string | null) => void;
  onClose: () => void;
}

export function HeldOrdersPanel({ storeId, onRecall, onClose }: HeldOrdersPanelProps) {
  const queryClient = useQueryClient();

  const { data: heldOrders = [], isLoading } = useQuery({
    queryKey: ["held-orders", storeId],
    queryFn: async () => {
      const query = supabase
        .from("held_orders")
        .select(`
          *,
          customer:customers(name, phone)
        `)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (storeId) {
        query.eq("store_id", storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (HeldOrder & { customer: { name: string; phone: string } | null })[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("held_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["held-orders"] });
      toast.success("Held order removed");
    },
  });

  const handleRecall = (order: HeldOrder & { customer: { name: string; phone: string } | null }) => {
    onRecall(order.cart_data, order.customer_id);
    // Delete the held order after recalling
    deleteMutation.mutate(order.id);
    onClose();
  };

  const getCartItemCount = (cartData: any) => {
    if (Array.isArray(cartData)) {
      return cartData.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
    }
    return 0;
  };

  const getCartTotal = (cartData: any) => {
    if (Array.isArray(cartData)) {
      return cartData.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity || 0), 0);
    }
    return 0;
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Pause className="h-5 w-5 text-orange-600" />
          Held Orders
          <Badge variant="secondary" className="ml-auto">
            {heldOrders.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : heldOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No held orders</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {heldOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      {order.customer ? (
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <User className="h-3 w-3" />
                          {order.customer.name}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Walk-in Customer</span>
                      )}
                      {order.note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          "{order.note}"
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">
                        ₹{getCartTotal(order.cart_data).toFixed(2)}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getCartItemCount(order.cart_data)} items
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive"
                        onClick={() => deleteMutation.mutate(order.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 gap-1"
                        onClick={() => handleRecall(order)}
                      >
                        <Play className="h-3 w-3" />
                        Recall
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
