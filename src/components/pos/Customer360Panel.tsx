import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { 
  User, 
  Phone, 
  Mail, 
  Coins, 
  ShoppingBag, 
  TrendingUp,
  Star,
  Plus,
  Calendar,
  Wallet
} from "lucide-react";

interface Customer360PanelProps {
  customerId: string;
  onAddToCart?: (productId: string) => void;
  onClose?: () => void;
}

export function Customer360Panel({ customerId, onAddToCart, onClose }: Customer360PanelProps) {
  // Fetch customer details
  const { data: customer } = useQuery({
    queryKey: ["customer-360", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent orders
  const { data: recentOrders = [] } = useQuery({
    queryKey: ["customer-orders", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          store:stores(name)
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  // Fetch frequently purchased items
  const { data: frequentItems = [] } = useQuery({
    queryKey: ["customer-frequent-items", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select(`
          item_id,
          quantity,
          order:orders!inner(customer_id),
          product:products(id, name, price)
        `)
        .eq("order.customer_id", customerId);
      
      if (error) throw error;
      
      // Aggregate by product
      const itemCounts: Record<string, { product: any; totalQty: number }> = {};
      data.forEach((item: any) => {
        if (item.product) {
          const key = item.product.id;
          if (!itemCounts[key]) {
            itemCounts[key] = { product: item.product, totalQty: 0 };
          }
          itemCounts[key].totalQty += item.quantity;
        }
      });
      
      return Object.values(itemCounts)
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, 5);
    },
  });

  if (!customer) return null;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          Customer 360°
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Info */}
        <div className="space-y-2">
          <div className="font-semibold text-lg">{customer.name || "Customer"}</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            {customer.phone}
          </div>
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              {customer.email}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 p-2 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Coins className="h-3 w-3" />
              Points
            </div>
            <div className="font-bold text-primary">{customer.loyalty_points || 0}</div>
          </div>
          <div className="bg-muted/50 p-2 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <ShoppingBag className="h-3 w-3" />
              Orders
            </div>
            <div className="font-bold">{customer.total_orders || 0}</div>
          </div>
          <div className="bg-muted/50 p-2 rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Spent
            </div>
            <div className="font-bold">₹{(customer.total_spent || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Store Credit */}
        {customer.store_credit > 0 && (
          <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-green-600" />
              <span>Store Credit</span>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              ₹{customer.store_credit}
            </Badge>
          </div>
        )}

        <Separator />

        {/* Frequently Purchased */}
        {frequentItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              <Star className="h-4 w-4 text-amber-500" />
              Frequently Purchased
            </div>
            <ScrollArea className="h-[100px]">
              <div className="space-y-1">
                {frequentItems.map((item: any) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between p-1.5 hover:bg-muted/50 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{item.product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ₹{item.product.price} · Bought {item.totalQty}x
                      </div>
                    </div>
                    {onAddToCart && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onAddToCart(item.product.id)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <Separator />

        {/* Recent Orders */}
        {recentOrders.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Recent Orders
            </div>
            <ScrollArea className="h-[100px]">
              <div className="space-y-1">
                {recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-1.5 bg-muted/30 rounded"
                  >
                    <div>
                      <div className="text-xs font-medium">{order.order_number}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {format(new Date(order.created_at), "dd MMM yyyy")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">₹{order.total_amount}</div>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
