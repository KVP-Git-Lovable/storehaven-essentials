import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  Phone, 
  User, 
  CreditCard, 
  Banknote,
  ScanLine,
  Tag,
  Receipt,
  CheckCircle,
  Printer,
  Star,
  Info
} from "lucide-react";
import BarcodeScanner from "@/components/inventory/BarcodeScanner";
import { QuickActionsBar } from "@/components/pos/QuickActionsBar";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { HeldOrdersPanel } from "@/components/pos/HeldOrdersPanel";
import { SplitPaymentDialog } from "@/components/pos/SplitPaymentDialog";
import { LineItemDiscount } from "@/components/pos/LineItemDiscount";
import { DenominationCalculator } from "@/components/pos/DenominationCalculator";
import { Customer360Panel } from "@/components/pos/Customer360Panel";
import { ReceiptPreview } from "@/components/pos/ReceiptPreview";
import { useAuth } from "@/hooks/useAuth";

interface CartItem {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
}

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  loyalty_points: number;
  total_orders: number;
  total_spent: number;
  store_credit: number;
}

interface Scheme {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_purchase_amount: number;
  min_quantity: number;
  applicable_items: string[] | null;
}

interface PaymentEntry {
  id: string;
  method: "cash" | "upi" | "card" | "loyalty_points";
  amount: number;
  reference?: string;
}

export default function PointOfSale() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const receiptRef = useRef<HTMLDivElement>(null);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isSplitPaymentOpen, setIsSplitPaymentOpen] = useState(false);
  const [isOrderCompleteDialogOpen, setIsOrderCompleteDialogOpen] = useState(false);
  const [isHeldOrdersPanelOpen, setIsHeldOrdersPanelOpen] = useState(false);
  const [isCustomer360Open, setIsCustomer360Open] = useState(false);
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [holdNote, setHoldNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [upiReference, setUpiReference] = useState("");
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [appliedScheme, setAppliedScheme] = useState<Scheme | null>(null);
  const [lastOrderNumber, setLastOrderNumber] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [completedPayments, setCompletedPayments] = useState<PaymentEntry[]>([]);

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products from Product Master
  const { data: products = [] } = useQuery({
    queryKey: ["pos-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch active schemes
  const { data: schemes = [] } = useQuery({
    queryKey: ["active-schemes"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("schemes")
        .select("*")
        .eq("status", "active")
        .lte("start_date", today)
        .gte("end_date", today);
      if (error) throw error;
      return data;
    },
  });

  // Fetch held orders count
  const { data: heldOrdersCount = 0 } = useQuery({
    queryKey: ["held-orders-count", selectedStore],
    queryFn: async () => {
      let query = supabase
        .from("held_orders")
        .select("id", { count: "exact" })
        .gt("expires_at", new Date().toISOString());
      
      if (selectedStore) {
        query = query.eq("store_id", selectedStore);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Get unique categories
  const categories = [...new Set(products.map((p) => p.category))].filter(Boolean);

  // Lookup customer by phone
  const lookupCustomer = async (phone: string) => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", phone)
      .single();
    
    if (error && error.code !== "PGRST116") {
      toast.error("Error looking up customer");
      return null;
    }
    return data;
  };

  // Create new customer
  const createCustomerMutation = useMutation({
    mutationFn: async ({ phone, name }: { phone: string; name: string }) => {
      const { data, error } = await supabase
        .from("customers")
        .insert({ phone, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setCustomer(data);
      setIsCustomerDialogOpen(false);
      toast.success("New customer created");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create customer");
    },
  });

  // Hold order mutation
  const holdOrderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("held_orders").insert({
        cart_data: JSON.parse(JSON.stringify(cart)),
        customer_id: customer?.id || null,
        note: holdNote,
        store_id: selectedStore || null,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order held successfully");
      setIsHoldDialogOpen(false);
      setHoldNote("");
      clearCart();
      setCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["held-orders"] });
      queryClient.invalidateQueries({ queryKey: ["held-orders-count"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to hold order");
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payments?: PaymentEntry[]) => {
      const orderNumber = `ORD-${Date.now()}`;
      const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const discountAmount = cart.reduce((sum, item) => sum + item.discountAmount, 0) + (appliedScheme ? calculateSchemeDiscount(subtotal) : 0);
      const taxAmount = cart.reduce((sum, item) => sum + item.taxAmount, 0);
      const totalAmount = subtotal - discountAmount + taxAmount;

      const paymentMethodUsed = payments ? payments[0]?.method || "cash" : paymentMethod;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          store_id: selectedStore || null,
          customer_id: customer?.id || null,
          subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          payment_method: paymentMethodUsed,
          payment_status: "completed",
          payment_reference: payments ? undefined : (paymentMethod === "upi" ? upiReference : null),
          status: "completed",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        item_id: item.itemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent,
        discount_amount: item.discountAmount,
        tax_percent: item.taxPercent,
        tax_amount: item.taxAmount,
        total_amount: item.totalAmount,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Create order payments for split payments
      if (payments && payments.length > 0) {
        const orderPayments = payments.map((p) => ({
          order_id: order.id,
          payment_method: p.method,
          amount: p.amount,
          reference: p.reference,
        }));

        await supabase.from("order_payments").insert(orderPayments);
      }

      return { order, orderNumber, payments: payments || [] };
    },
    onSuccess: ({ orderNumber, payments }) => {
      setLastOrderNumber(orderNumber);
      setCompletedPayments(payments);
      setIsPaymentDialogOpen(false);
      setIsSplitPaymentOpen(false);
      setIsOrderCompleteDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create order");
    },
  });

  const handleCustomerLookup = async () => {
    if (!customerPhone || customerPhone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    const existingCustomer = await lookupCustomer(customerPhone);
    if (existingCustomer) {
      setCustomer(existingCustomer);
      setIsCustomerDialogOpen(false);
      toast.success(`Welcome back, ${existingCustomer.name || "Customer"}!`);
    } else {
      toast.info("Customer not found. Please enter name to create.");
    }
  };

  const handleCreateCustomer = () => {
    if (!customerPhone || customerPhone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    createCustomerMutation.mutate({ 
      phone: customerPhone, 
      name: newCustomerName || `Customer ${customerPhone.slice(-4)}` 
    });
  };

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find((p) => p.barcode === barcode || p.model === barcode || p.name.includes(barcode));
    if (product) {
      addToCart(product);
    } else {
      toast.error(`Product with barcode ${barcode} not found`);
    }
  };

  const addToCart = (product: any) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((ci) => ci.itemId === product.id);
      if (existingItem) {
        return prevCart.map((ci) =>
          ci.itemId === product.id
            ? {
                ...ci,
                quantity: ci.quantity + 1,
                totalAmount: (ci.quantity + 1) * ci.unitPrice - ci.discountAmount,
              }
            : ci
        );
      }
      return [
        ...prevCart,
        {
          id: crypto.randomUUID(),
          itemId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: Number(product.price),
          discountPercent: 0,
          discountAmount: 0,
          taxPercent: Number(product.tax_rate) || 0,
          taxAmount: 0,
          totalAmount: Number(product.price),
        },
      ];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === itemId) {
            const newQuantity = item.quantity + delta;
            if (newQuantity <= 0) return null;
            const lineTotal = newQuantity * item.unitPrice;
            return {
              ...item,
              quantity: newQuantity,
              discountAmount: item.discountPercent > 0 ? (lineTotal * item.discountPercent) / 100 : item.discountAmount,
              totalAmount: lineTotal - (item.discountPercent > 0 ? (lineTotal * item.discountPercent) / 100 : item.discountAmount),
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateLineDiscount = (itemId: string, discountPercent: number, discountAmount: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === itemId) {
          const lineTotal = item.quantity * item.unitPrice;
          return {
            ...item,
            discountPercent,
            discountAmount,
            totalAmount: lineTotal - discountAmount,
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedScheme(null);
  };

  const calculateSchemeDiscount = (subtotal: number): number => {
    if (!appliedScheme) return 0;
    
    if (appliedScheme.min_purchase_amount && subtotal < appliedScheme.min_purchase_amount) {
      return 0;
    }

    if (appliedScheme.discount_type === "percentage") {
      return (subtotal * appliedScheme.discount_value) / 100;
    } else if (appliedScheme.discount_type === "fixed") {
      return appliedScheme.discount_value;
    }
    
    return 0;
  };

  const applyScheme = (scheme: Scheme) => {
    setAppliedScheme(scheme);
    toast.success(`Scheme "${scheme.name}" applied`);
  };

  const handleRecallOrder = (cartData: any, customerId: string | null) => {
    setCart(cartData);
    if (customerId) {
      // Fetch customer
      supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single()
        .then(({ data }) => {
          if (data) setCustomer(data);
        });
    }
    toast.success("Order recalled");
  };

  const handleDenominationClick = (amount: number) => {
    setCashReceived((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + amount).toString();
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const schemeDiscount = calculateSchemeDiscount(subtotal);
  const itemDiscounts = cart.reduce((sum, item) => sum + item.discountAmount, 0);
  const totalDiscount = schemeDiscount + itemDiscounts;
  const taxAmount = cart.reduce((sum, item) => sum + item.taxAmount, 0);
  const grandTotal = subtotal - totalDiscount + taxAmount;
  const changeAmount = paymentMethod === "cash" && cashReceived ? parseFloat(cashReceived) - grandTotal : 0;

  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.includes(searchQuery);
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesFavorites = !showFavorites || product.is_favorite;

    return matchesSearch && matchesCategory && matchesFavorites;
  });

  const favoriteProducts = products.filter((p) => p.is_favorite);

  const startNewOrder = () => {
    clearCart();
    setCustomer(null);
    setCustomerPhone("");
    setNewCustomerName("");
    setCashReceived("");
    setUpiReference("");
    setCompletedPayments([]);
    setIsOrderCompleteDialogOpen(false);
    setIsCustomerDialogOpen(true);
  };

  const handleProceedToPayment = () => {
    if (cart.length === 0) {
      toast.error("Please add items to cart");
      return;
    }
    setIsPaymentDialogOpen(true);
  };

  const handleCompletePayment = () => {
    if (paymentMethod === "cash" && parseFloat(cashReceived) < grandTotal) {
      toast.error("Insufficient cash received");
      return;
    }
    if (paymentMethod === "upi" && !upiReference) {
      toast.error("Please enter UPI reference number");
      return;
    }
    createOrderMutation.mutate(undefined);
  };

  const handleSplitPaymentComplete = (payments: PaymentEntry[]) => {
    createOrderMutation.mutate(payments);
  };

  const handlePrintReceipt = () => {
    if (receiptRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Receipt - ${lastOrderNumber}</title>
              <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
              </style>
            </head>
            <body>${receiptRef.current.innerHTML}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const selectedStoreName = stores.find((s) => s.id === selectedStore)?.name || "Store";

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-3 p-4">
      {/* Quick Actions Bar */}
      <QuickActionsBar
        onCustomer={() => setIsCustomerDialogOpen(true)}
        onScan={() => {}}
        onClear={clearCart}
        onHold={() => cart.length > 0 && setIsHoldDialogOpen(true)}
        onRecall={() => setIsHeldOrdersPanelOpen(true)}
        onPay={handleProceedToPayment}
        hasItems={cart.length > 0}
        heldOrdersCount={heldOrdersCount}
      />

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Panel - Product Selection */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Header with Store Selection */}
          <div className="flex items-center gap-4">
            <div className="w-48">
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Store" />
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
            {customer && (
              <div 
                className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => setIsCustomer360Open(true)}
              >
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{customer.name || customer.phone}</span>
                <Badge variant="secondary">{customer.loyalty_points} pts</Badge>
                <Info className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Search and Scan */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <BarcodeScanner
              onScan={handleBarcodeScan}
              trigger={
                <Button variant="outline" className="gap-2">
                  <ScanLine className="h-4 w-4" />
                  Scan
                </Button>
              }
            />
          </div>

          {/* Category Tabs */}
          <CategoryTabs
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            showFavorites={showFavorites}
            onToggleFavorites={() => setShowFavorites(!showFavorites)}
            favoritesCount={favoriteProducts.length}
          />

          {/* Available Schemes */}
          {schemes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {schemes.map((scheme) => (
                <Button
                  key={scheme.id}
                  variant={appliedScheme?.id === scheme.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyScheme(scheme)}
                  className="whitespace-nowrap gap-2"
                >
                  <Tag className="h-3 w-3" />
                  {scheme.name}
                  {scheme.discount_type === "percentage"
                    ? ` (${scheme.discount_value}% off)`
                    : ` (₹${scheme.discount_value} off)`}
                </Button>
              ))}
            </div>
          )}

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-md transition-shadow relative"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3">
                    {product.is_favorite && (
                      <Star className="absolute top-2 right-2 h-3 w-3 text-amber-500 fill-amber-500" />
                    )}
                    <div className="font-medium text-sm truncate">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.category}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-primary">₹{product.price}</span>
                      {product.brand && (
                        <Badge variant="outline" className="text-xs">
                          {product.brand}
                        </Badge>
                      )}
                    </div>
                    {product.stock_qty !== null && product.stock_qty <= (product.min_stock || 5) && (
                      <Badge variant="destructive" className="mt-1 text-[10px]">
                        Low Stock: {product.stock_qty}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Cart */}
        <Card className="w-96 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5" />
              Current Order
              {cart.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-4 pt-0 min-h-0">
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs">Scan or select products to add</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ₹{item.unitPrice} × {item.quantity}
                        {item.discountAmount > 0 && (
                          <span className="text-green-600 ml-1">(-₹{item.discountAmount.toFixed(0)})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <LineItemDiscount
                        unitPrice={item.unitPrice}
                        quantity={item.quantity}
                        currentDiscountPercent={item.discountPercent}
                        currentDiscountAmount={item.discountAmount}
                        onApplyDiscount={(percent, amount) => updateLineDiscount(item.id, percent, amount)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-20 text-right font-medium text-sm">
                      ₹{item.totalAmount.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Summary */}
            {cart.length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-₹{totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>₹{taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={clearCart}>
                    Clear
                  </Button>
                  <Button className="flex-1" onClick={handleProceedToPayment}>
                    Pay ₹{grandTotal.toFixed(2)}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Identification Dialog */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Customer Identification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter 10-digit phone number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                />
                <Button onClick={handleCustomerLookup}>Lookup</Button>
              </div>
            </div>
            
            {customerPhone.length === 10 && !customer && (
              <div className="space-y-2">
                <Label>Customer Name (for new customer)</Label>
                <Input
                  placeholder="Enter customer name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                />
                <Button 
                  onClick={handleCreateCustomer} 
                  className="w-full"
                  disabled={createCustomerMutation.isPending}
                >
                  {createCustomerMutation.isPending ? "Creating..." : "Create New Customer"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomerDialogOpen(false)}>
              Skip (Walk-in Customer)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg text-center">
              <div className="text-sm text-muted-foreground">Total Amount</div>
              <div className="text-3xl font-bold text-primary">₹{grandTotal.toFixed(2)}</div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={paymentMethod === "cash" ? "default" : "outline"}
                  className="h-20 flex-col gap-2"
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Banknote className="h-6 w-6" />
                  Cash
                </Button>
                <Button
                  variant={paymentMethod === "upi" ? "default" : "outline"}
                  className="h-20 flex-col gap-2"
                  onClick={() => setPaymentMethod("upi")}
                >
                  <CreditCard className="h-6 w-6" />
                  UPI
                </Button>
              </div>
            </div>

            {/* Split Payment Option */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsPaymentDialogOpen(false);
                setIsSplitPaymentOpen(true);
              }}
            >
              Split Payment (Multiple Methods)
            </Button>

            {paymentMethod === "cash" && (
              <div className="space-y-3">
                <Label>Cash Received</Label>
                <Input
                  type="number"
                  placeholder="Enter amount received"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
                <DenominationCalculator
                  onDenominationClick={handleDenominationClick}
                  grandTotal={grandTotal}
                />
                {parseFloat(cashReceived) >= grandTotal && (
                  <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg text-center">
                    <div className="text-sm text-green-600 dark:text-green-400">Change to Return</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      ₹{changeAmount.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === "upi" && (
              <div className="space-y-2">
                <Label>UPI Reference Number</Label>
                <Input
                  placeholder="Enter UPI transaction reference"
                  value={upiReference}
                  onChange={(e) => setUpiReference(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCompletePayment}
              disabled={createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? "Processing..." : "Complete Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Payment Dialog */}
      <SplitPaymentDialog
        open={isSplitPaymentOpen}
        onOpenChange={setIsSplitPaymentOpen}
        grandTotal={grandTotal}
        loyaltyPoints={customer?.loyalty_points || 0}
        onComplete={handleSplitPaymentComplete}
        isPending={createOrderMutation.isPending}
      />

      {/* Order Complete Dialog */}
      <Dialog open={isOrderCompleteDialogOpen} onOpenChange={setIsOrderCompleteDialogOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Payment Successful!</h3>
              <p className="text-muted-foreground">Order #{lastOrderNumber}</p>
            </div>
            <div className="bg-muted p-4 rounded-lg w-full">
              <div className="text-sm text-muted-foreground">Amount Paid</div>
              <div className="text-2xl font-bold text-primary">₹{grandTotal.toFixed(2)}</div>
              {completedPayments.length > 1 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Split across {completedPayments.length} payment methods
                </div>
              )}
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1 gap-2" onClick={handlePrintReceipt}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button className="flex-1" onClick={startNewOrder}>
                New Order
              </Button>
            </div>
          </div>

          {/* Hidden Receipt for Printing */}
          <div className="hidden">
            <ReceiptPreview
              ref={receiptRef}
              orderNumber={lastOrderNumber}
              storeName={selectedStoreName}
              customerName={customer?.name || undefined}
              customerPhone={customer?.phone}
              items={cart}
              subtotal={subtotal}
              discount={totalDiscount}
              tax={taxAmount}
              total={grandTotal}
              payments={completedPayments.length > 0 ? completedPayments : [{ method: paymentMethod, amount: grandTotal, reference: upiReference || undefined }]}
              cashReceived={paymentMethod === "cash" ? parseFloat(cashReceived) : undefined}
              changeAmount={changeAmount > 0 ? changeAmount : undefined}
              createdAt={new Date()}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Hold Order Dialog */}
      <Dialog open={isHoldDialogOpen} onOpenChange={setIsHoldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items · ₹{grandTotal.toFixed(2)}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                placeholder="e.g., Customer stepped out, waiting for payment..."
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHoldDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => holdOrderMutation.mutate()} disabled={holdOrderMutation.isPending}>
              {holdOrderMutation.isPending ? "Holding..." : "Hold Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Held Orders Panel */}
      <Dialog open={isHeldOrdersPanelOpen} onOpenChange={setIsHeldOrdersPanelOpen}>
        <DialogContent className="max-w-md p-0">
          <HeldOrdersPanel
            storeId={selectedStore}
            onRecall={handleRecallOrder}
            onClose={() => setIsHeldOrdersPanelOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Customer 360 Panel */}
      <Dialog open={isCustomer360Open} onOpenChange={setIsCustomer360Open}>
        <DialogContent className="max-w-sm p-0">
          {customer && (
            <Customer360Panel
              customerId={customer.id}
              onAddToCart={(productId) => {
                const product = products.find((p) => p.id === productId);
                if (product) addToCart(product);
              }}
              onClose={() => setIsCustomer360Open(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
