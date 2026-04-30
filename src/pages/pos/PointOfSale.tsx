import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Info,
  Coins,
  Smartphone,
  ChevronDown
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import BarcodeScanner from "@/components/inventory/BarcodeScanner";
import { QuickActionsBar } from "@/components/pos/QuickActionsBar";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { HeldOrdersPanel } from "@/components/pos/HeldOrdersPanel";
import { SplitPaymentDialog } from "@/components/pos/SplitPaymentDialog";
import { DenominationCalculator } from "@/components/pos/DenominationCalculator";
import { Customer360Panel } from "@/components/pos/Customer360Panel";
import { ReceiptPreview } from "@/components/pos/ReceiptPreview";
import { AppliedSchemesBadge } from "@/components/pos/AppliedSchemesBadge";
import { LoyaltyPointsDisplay } from "@/components/pos/LoyaltyPointsDisplay";
import { CouponInput } from "@/components/pos/CouponInput";
import { GiftCardInput } from "@/components/pos/GiftCardInput";
import { PersonalizedOffers } from "@/components/pos/PersonalizedOffers";
import { usePOSSchemes } from "@/hooks/usePOSSchemes";
import { useAuth } from "@/hooks/useAuth";
import { recordSaleLedger, getInventoryStockMap } from "@/lib/inventoryStock";

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
  tier?: string;
  customer_segment?: string;
}

interface Scheme {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_purchase_amount: number | null;
  min_quantity: number | null;
  applicable_items: string[] | null;
  is_auto_apply?: boolean;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  max_discount_amount?: number | null;
  priority?: number;
}

interface PaymentEntry {
  id: string;
  method: "cash" | "upi" | "card" | "loyalty_points";
  amount: number;
  reference?: string;
}

interface AppliedCoupon {
  id: string;
  code: string;
  name: string;
  discountAmount: number;
}

interface AppliedGiftCard {
  id: string;
  cardNumber: string;
  balance: number;
  amountToUse: number;
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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card" | "loyalty_points">("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [lastOrderNumber, setLastOrderNumber] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [completedPayments, setCompletedPayments] = useState<PaymentEntry[]>([]);
  
  // Coupon and Gift Card state
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<AppliedGiftCard | null>(null);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);

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
        .from("inventory_items")
        .select("*")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      const rows = data || [];
      const stockMap = await getInventoryStockMap(rows.map((r: any) => r.id));
      // Normalise to the legacy product shape consumed across this page
      return rows.map((r: any) => ({
        ...r,
        price: Number(r.selling_price ?? 0),
        stock_qty: stockMap[r.id] ?? 0,
      }));
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

  // Fetch loyalty config
  const { data: loyaltyConfig } = useQuery({
    queryKey: ["loyalty-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_config")
        .select("*")
        .eq("is_active", true)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data || { points_per_rupee: 1, points_value_rupee: 1, min_points_redeem: 100 };
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

  // Use schemes hook for auto-apply logic
  const { appliedSchemeResults, totalSchemeDiscount } = usePOSSchemes(
    cart,
    schemes as Scheme[],
    customer?.id
  );

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

  // Create new customer - name is now optional
  const createCustomerMutation = useMutation({
    mutationFn: async ({ phone, name }: { phone: string; name?: string }) => {
      const { generateCustomerCode } = await import("@/lib/customerCode");
      const { data, error } = await supabase
        .from("customers")
        .insert({ phone, name: name || null, customer_code: generateCustomerCode() })
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
      const itemDiscounts = cart.reduce((sum, item) => sum + item.discountAmount, 0);
      const schemeDiscount = totalSchemeDiscount;
      const couponDiscount = appliedCoupon?.discountAmount || 0;
      const giftCardAmount = appliedGiftCard?.amountToUse || 0;
      const loyaltyPointsValue = loyaltyPointsToRedeem * (loyaltyConfig?.points_value_rupee || 1);
      const totalDiscount = itemDiscounts + schemeDiscount + couponDiscount;
      const taxAmount = cart.reduce((sum, item) => sum + item.taxAmount, 0);
      const totalAmount = subtotal - totalDiscount + taxAmount - giftCardAmount - loyaltyPointsValue;

      const paymentMethodUsed = payments ? payments[0]?.method || "cash" : paymentMethod;

      // Calculate loyalty points to earn
      const pointsToEarn = Math.floor(subtotal * (loyaltyConfig?.points_per_rupee || 1));

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          store_id: selectedStore || null,
          customer_id: customer?.id || null,
          subtotal,
          discount_amount: totalDiscount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          payment_method: paymentMethodUsed,
          payment_status: "completed",
          payment_reference: payments ? undefined : (paymentMethod !== "cash" ? paymentReference : null),
          status: "completed",
          coupon_id: appliedCoupon?.id || null,
          coupon_discount: couponDiscount,
          gift_card_id: appliedGiftCard?.id || null,
          gift_card_amount: giftCardAmount,
          loyalty_points_earned: pointsToEarn,
          loyalty_points_redeemed: loyaltyPointsToRedeem,
          order_type: "sale",
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

      // Decrement inventory stock for each sold item
      try {
        await recordSaleLedger({
          orderId: order.id,
          storeId: selectedStore || null,
          lines: cart.map((item) => ({
            item_id: item.itemId,
            quantity: item.quantity,
            unit_cost: item.unitPrice,
          })),
        });
      } catch (e) {
        console.error("Stock ledger update failed", e);
      }

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

      // Update customer loyalty points if applicable
      if (customer?.id) {
        const newPoints = (customer.loyalty_points || 0) + pointsToEarn - loyaltyPointsToRedeem;
        await supabase
          .from("customers")
          .update({ 
            loyalty_points: newPoints,
            total_orders: (customer.total_orders || 0) + 1,
            total_spent: (customer.total_spent || 0) + totalAmount,
          })
          .eq("id", customer.id);

        // Record loyalty transaction
        if (pointsToEarn > 0) {
          await supabase.from("loyalty_transactions").insert({
            customer_id: customer.id,
            order_id: order.id,
            transaction_type: "earn",
            points: pointsToEarn,
            balance_after: newPoints,
            description: `Earned from order ${orderNumber}`,
          });
        }
        if (loyaltyPointsToRedeem > 0) {
          await supabase.from("loyalty_transactions").insert({
            customer_id: customer.id,
            order_id: order.id,
            transaction_type: "redeem",
            points: -loyaltyPointsToRedeem,
            balance_after: newPoints,
            description: `Redeemed on order ${orderNumber}`,
          });
        }
      }

      // Update gift card balance if used
      if (appliedGiftCard) {
        const newBalance = appliedGiftCard.balance - appliedGiftCard.amountToUse;
        await supabase
          .from("gift_cards")
          .update({ 
            current_balance: newBalance,
            status: newBalance <= 0 ? "depleted" : "active",
          })
          .eq("id", appliedGiftCard.id);

        await supabase.from("gift_card_transactions").insert({
          gift_card_id: appliedGiftCard.id,
          order_id: order.id,
          transaction_type: "redeem",
          amount: -appliedGiftCard.amountToUse,
          balance_after: newBalance,
        });
      }

      // Update coupon usage
      if (appliedCoupon) {
        await supabase.from("coupon_usages").insert({
          coupon_id: appliedCoupon.id,
          order_id: order.id,
          customer_id: customer?.id || null,
          discount_amount: couponDiscount,
        });

        // Increment usage count
        const { data: currentCoupon } = await supabase
          .from("coupons")
          .select("usage_count")
          .eq("id", appliedCoupon.id)
          .single();

        await supabase
          .from("coupons")
          .update({ usage_count: (currentCoupon?.usage_count || 0) + 1 })
          .eq("id", appliedCoupon.id);
      }

      return { order, orderNumber, payments: payments || [], pointsToEarn };
    },
    onSuccess: ({ orderNumber, payments, pointsToEarn }) => {
      setLastOrderNumber(orderNumber);
      setCompletedPayments(payments);
      setIsPaymentDialogOpen(false);
      setIsSplitPaymentOpen(false);
      setIsOrderCompleteDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      
      if (pointsToEarn > 0 && customer) {
        toast.success(`${pointsToEarn} loyalty points earned!`);
      }
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
      toast.info("Customer not found. Click 'Create' to add as new customer.");
    }
  };

  // Name is optional for new customers
  const handleCreateCustomer = () => {
    if (!customerPhone || customerPhone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    createCustomerMutation.mutate({ 
      phone: customerPhone, 
      name: newCustomerName || undefined 
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

  const removeFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
    setAppliedGiftCard(null);
    setLoyaltyPointsToRedeem(0);
  };

  const handleRecallOrder = (cartData: any, customerId: string | null) => {
    setCart(cartData);
    if (customerId) {
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

  // Apply coupon handler
  const handleApplyCoupon = async (code: string): Promise<AppliedCoupon | null> => {
    const today = new Date().toISOString().split('T')[0];
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("status", "active")
      .lte("start_date", today)
      .gte("end_date", today)
      .single();

    if (error || !coupon) {
      toast.error("Invalid or expired coupon code");
      return null;
    }

    // Check min purchase
    if (coupon.min_purchase_amount && subtotal < coupon.min_purchase_amount) {
      toast.error(`Minimum purchase of ₹${coupon.min_purchase_amount} required`);
      return null;
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      toast.error("Coupon usage limit reached");
      return null;
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === "percentage") {
      discountAmount = (subtotal * coupon.discount_value) / 100;
    } else {
      discountAmount = coupon.discount_value;
    }

    // Apply max discount cap
    if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
      discountAmount = coupon.max_discount_amount;
    }

    const applied: AppliedCoupon = {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discountAmount,
    };

    setAppliedCoupon(applied);
    return applied;
  };

  // Apply gift card handler
  const handleApplyGiftCard = async (cardNumber: string, pin?: string, amount?: number): Promise<AppliedGiftCard | null> => {
    let query = supabase
      .from("gift_cards")
      .select("*")
      .eq("card_number", cardNumber)
      .eq("status", "active");

    const { data: giftCard, error } = await query.single();

    if (error || !giftCard) {
      toast.error("Invalid or inactive gift card");
      return null;
    }

    // Check PIN if set
    if (giftCard.pin && giftCard.pin !== pin) {
      toast.error("Invalid PIN");
      return null;
    }

    // Check expiry
    if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
      toast.error("Gift card has expired");
      return null;
    }

    const amountToUse = Math.min(amount || giftCard.current_balance, giftCard.current_balance, grandTotal);

    const applied: AppliedGiftCard = {
      id: giftCard.id,
      cardNumber: giftCard.card_number,
      balance: giftCard.current_balance,
      amountToUse,
    };

    setAppliedGiftCard(applied);
    return applied;
  };

  // Loyalty points redemption
  const handleRedeemLoyaltyPoints = (points: number) => {
    const minRedeem = loyaltyConfig?.min_points_redeem || 100;
    if (points < minRedeem) {
      toast.error(`Minimum ${minRedeem} points required to redeem`);
      return;
    }
    setLoyaltyPointsToRedeem(points);
    toast.success(`${points} points will be redeemed (₹${points * (loyaltyConfig?.points_value_rupee || 1)})`);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemDiscounts = cart.reduce((sum, item) => sum + item.discountAmount, 0);
  const schemeDiscount = totalSchemeDiscount;
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  const giftCardAmount = appliedGiftCard?.amountToUse || 0;
  const loyaltyPointsValue = loyaltyPointsToRedeem * (loyaltyConfig?.points_value_rupee || 1);
  const totalDiscount = itemDiscounts + schemeDiscount + couponDiscount;
  const taxAmount = cart.reduce((sum, item) => sum + item.taxAmount, 0);
  const grandTotal = Math.max(0, subtotal - totalDiscount + taxAmount - giftCardAmount - loyaltyPointsValue);
  const changeAmount = paymentMethod === "cash" && cashReceived ? parseFloat(cashReceived) - grandTotal : 0;

  // Points to earn on this order
  const pointsToEarn = Math.floor(subtotal * (loyaltyConfig?.points_per_rupee || 1));

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
    setPaymentReference("");
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
    if ((paymentMethod === "upi" || paymentMethod === "card") && !paymentReference) {
      toast.error("Please enter reference number");
      return;
    }
    if (paymentMethod === "loyalty_points") {
      if (!customer || (customer.loyalty_points || 0) < grandTotal / (loyaltyConfig?.points_value_rupee || 1)) {
        toast.error("Insufficient loyalty points");
        return;
      }
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
                {customer.tier && (
                  <Badge variant="outline" className="capitalize">
                    {customer.tier}
                  </Badge>
                )}
                <LoyaltyPointsDisplay
                  availablePoints={customer.loyalty_points || 0}
                  pointsValue={loyaltyConfig?.points_value_rupee || 1}
                  pointsToEarn={pointsToEarn}
                  isRedeemable={false}
                />
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
        <Card className="w-96 flex flex-col min-h-0">
          <CardHeader className="pb-2 flex-shrink-0">
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
          <CardContent className="flex-1 flex flex-col p-4 pt-0 min-h-0 overflow-hidden">
            {/* Cart Items - Takes priority */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
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
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-16 text-right font-medium text-sm">
                      ₹{item.totalAmount.toFixed(0)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Summary - Fixed at bottom */}
            {cart.length > 0 && (
              <div className="flex-shrink-0 border-t pt-3 mt-2 space-y-2">
                {/* Compact Discounts & Offers Section */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2 text-xs">
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Discounts & Offers
                        {(appliedCoupon || appliedGiftCard || loyaltyPointsToRedeem > 0 || totalSchemeDiscount > 0) && (
                          <Badge variant="secondary" className="h-4 text-[10px] px-1">
                            {[
                              appliedCoupon && "Coupon",
                              appliedGiftCard && "Gift Card",
                              loyaltyPointsToRedeem > 0 && "Points",
                              totalSchemeDiscount > 0 && "Scheme"
                            ].filter(Boolean).length} applied
                          </Badge>
                        )}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {/* Applied Schemes Display */}
                    {appliedSchemeResults.length > 0 && totalSchemeDiscount > 0 && (
                      <AppliedSchemesBadge
                        schemes={appliedSchemeResults.map((r) => r.scheme)}
                        totalSavings={totalSchemeDiscount + couponDiscount}
                      />
                    )}

                    {/* Coupon Input */}
                    <CouponInput
                      appliedCoupon={appliedCoupon}
                      onApplyCoupon={handleApplyCoupon}
                      onRemoveCoupon={() => setAppliedCoupon(null)}
                    />

                    {/* Gift Card Input */}
                    <GiftCardInput
                      appliedGiftCard={appliedGiftCard}
                      onApplyGiftCard={handleApplyGiftCard}
                      onRemoveGiftCard={() => setAppliedGiftCard(null)}
                      maxAmount={grandTotal + (appliedGiftCard?.amountToUse || 0)}
                    />

                    {/* Loyalty Points Redemption */}
                    {customer && customer.loyalty_points > 0 && (
                      <div>
                        <LoyaltyPointsDisplay
                          availablePoints={customer.loyalty_points}
                          pointsValue={loyaltyConfig?.points_value_rupee || 1}
                          onRedeemPoints={handleRedeemLoyaltyPoints}
                          pointsToEarn={pointsToEarn}
                        />
                        {loyaltyPointsToRedeem > 0 && (
                          <div className="flex items-center justify-between mt-1 text-xs text-amber-600">
                            <span>Points to redeem: {loyaltyPointsToRedeem}</span>
                            <Button variant="ghost" size="sm" className="h-5 p-0 text-xs" onClick={() => setLoyaltyPointsToRedeem(0)}>
                              Clear
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Price Summary - Always visible, compact */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{subtotal.toFixed(0)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-₹{totalDiscount.toFixed(0)}</span>
                    </div>
                  )}
                  {giftCardAmount > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>Gift Card</span>
                      <span>-₹{giftCardAmount.toFixed(0)}</span>
                    </div>
                  )}
                  {loyaltyPointsValue > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Points</span>
                      <span>-₹{loyaltyPointsValue.toFixed(0)}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>₹{taxAmount.toFixed(0)}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">₹{grandTotal.toFixed(2)}</span>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={clearCart}>
                    Clear
                  </Button>
                  <Button size="sm" className="flex-1" onClick={handleProceedToPayment}>
                    Pay ₹{grandTotal.toFixed(0)}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Identification Dialog */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" />
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
                <Label>Customer Name (Optional)</Label>
                <Input
                  placeholder="Enter customer name (optional)"
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

      {/* Payment Dialog - All 4 payment methods */}
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
                  className="h-16 flex-col gap-1"
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Banknote className="h-5 w-5" />
                  <span className="text-xs">Cash</span>
                </Button>
                <Button
                  variant={paymentMethod === "upi" ? "default" : "outline"}
                  className="h-16 flex-col gap-1"
                  onClick={() => setPaymentMethod("upi")}
                >
                  <Smartphone className="h-5 w-5" />
                  <span className="text-xs">UPI</span>
                </Button>
                <Button
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  className="h-16 flex-col gap-1"
                  onClick={() => setPaymentMethod("card")}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs">Card</span>
                </Button>
                <Button
                  variant={paymentMethod === "loyalty_points" ? "default" : "outline"}
                  className="h-16 flex-col gap-1"
                  onClick={() => setPaymentMethod("loyalty_points")}
                  disabled={!customer || (customer.loyalty_points || 0) * (loyaltyConfig?.points_value_rupee || 1) < grandTotal}
                >
                  <Coins className="h-5 w-5" />
                  <span className="text-xs">Points</span>
                  {customer && (
                    <span className="text-[10px] opacity-70">
                      ({customer.loyalty_points} pts)
                    </span>
                  )}
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

            {(paymentMethod === "upi" || paymentMethod === "card") && (
              <div className="space-y-2">
                <Label>{paymentMethod === "upi" ? "UPI Reference Number" : "Card Last 4 Digits"}</Label>
                <Input
                  placeholder={paymentMethod === "upi" ? "Enter UPI transaction reference" : "Enter last 4 digits"}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            )}

            {paymentMethod === "loyalty_points" && customer && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                <div className="text-sm text-amber-700 dark:text-amber-400">
                  Using {Math.ceil(grandTotal / (loyaltyConfig?.points_value_rupee || 1))} points for this payment
                </div>
                <div className="text-xs text-amber-600/70 mt-1">
                  Remaining: {customer.loyalty_points - Math.ceil(grandTotal / (loyaltyConfig?.points_value_rupee || 1))} points
                </div>
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
              payments={completedPayments.length > 0 ? completedPayments : [{ method: paymentMethod, amount: grandTotal, reference: paymentReference || undefined }]}
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
