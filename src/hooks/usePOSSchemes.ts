import { useMemo } from "react";

interface CartItem {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
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
  applicable_categories?: string[] | null;
  is_auto_apply?: boolean;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  max_discount_amount?: number | null;
  priority?: number;
}

interface SchemeResult {
  scheme: Scheme;
  discountAmount: number;
  appliedTo: string[];
}

export function usePOSSchemes(
  cart: CartItem[],
  schemes: Scheme[],
  customerId?: string | null
) {
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  const applicableSchemes = useMemo(() => {
    return schemes
      .filter((scheme) => {
        // Check min purchase amount
        if (scheme.min_purchase_amount && subtotal < scheme.min_purchase_amount) {
          return false;
        }

        // Check min quantity
        if (scheme.min_quantity && totalQuantity < scheme.min_quantity) {
          return false;
        }

        // Check applicable items
        if (scheme.applicable_items && scheme.applicable_items.length > 0) {
          const cartItemIds = cart.map((item) => item.itemId);
          const hasApplicableItem = scheme.applicable_items.some((id) =>
            cartItemIds.includes(id)
          );
          if (!hasApplicableItem) return false;
        }

        return true;
      })
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }, [schemes, cart, subtotal, totalQuantity]);

  const autoApplySchemes = useMemo(() => {
    return applicableSchemes.filter((s) => s.is_auto_apply !== false);
  }, [applicableSchemes]);

  const calculateSchemeDiscount = (scheme: Scheme): number => {
    let discount = 0;

    switch (scheme.discount_type) {
      case "percentage":
        discount = (subtotal * scheme.discount_value) / 100;
        break;
      case "fixed":
        discount = scheme.discount_value;
        break;
      case "buy_x_get_y":
        // For BOGO-style promotions
        if (scheme.buy_quantity && scheme.get_quantity) {
          const eligibleItems = cart.filter((item) => 
            !scheme.applicable_items?.length || 
            scheme.applicable_items.includes(item.itemId)
          );
          const totalQty = eligibleItems.reduce((sum, item) => sum + item.quantity, 0);
          const sets = Math.floor(totalQty / (scheme.buy_quantity + scheme.get_quantity));
          if (sets > 0 && eligibleItems.length > 0) {
            const avgPrice = eligibleItems.reduce((sum, item) => 
              sum + (item.unitPrice * item.quantity), 0) / totalQty;
            discount = sets * scheme.get_quantity * avgPrice * (scheme.discount_value / 100);
          }
        }
        break;
      case "tiered":
        // Tiered discounts based on quantity
        discount = (subtotal * scheme.discount_value) / 100;
        break;
      case "bundle":
        // Bundle pricing
        discount = scheme.discount_value;
        break;
      default:
        break;
    }

    // Apply max discount cap
    if (scheme.max_discount_amount && discount > scheme.max_discount_amount) {
      discount = scheme.max_discount_amount;
    }

    return discount;
  };

  const appliedSchemeResults = useMemo((): SchemeResult[] => {
    return autoApplySchemes.map((scheme) => ({
      scheme,
      discountAmount: calculateSchemeDiscount(scheme),
      appliedTo: cart
        .filter(
          (item) =>
            !scheme.applicable_items?.length ||
            scheme.applicable_items.includes(item.itemId)
        )
        .map((item) => item.name),
    }));
  }, [autoApplySchemes, cart, subtotal]);

  const totalSchemeDiscount = appliedSchemeResults.reduce(
    (sum, r) => sum + r.discountAmount,
    0
  );

  return {
    applicableSchemes,
    autoApplySchemes,
    appliedSchemeResults,
    totalSchemeDiscount,
    calculateSchemeDiscount,
  };
}
