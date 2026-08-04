/**
 * Scheme Configuration Types
 * Supports category, category+attribute, and individual product targeting
 */

export type SchemeRuleType =
  | 'generic'           // Universal scheme
  | 'category'          // Target by product_type
  | 'category_dia'      // Target by category + diamond charge range
  | 'category_making'   // Target by category + making charge range
  | 'category_price'    // Target by category + price range
  | 'product';          // Target specific product

export type DiscountBasis =
  | 'product_price'     // Discount applied to base product price
  | 'dia_charge'        // Discount applied to diamond charge
  | 'making_charge'     // Discount applied to making charge
  | 'total_eligible';   // Discount applied to total eligible amount

export type DiscountType =
  | 'percentage'        // % discount
  | 'fixed'             // Fixed amount discount
  | 'buy_x_get_y'       // BOGO style
  | 'tiered'            // Quantity-based tiers
  | 'bundle'            // Bundle pricing
  | 'cashback'          // Cashback offer
  | 'free_shipping'     // Free shipping
  | 'second_at_discount'; // Buy 1 get 2nd at discount

export interface SchemeBase {
  id: string;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  discount_basis: DiscountBasis;
  priority: number;
  is_auto_apply: boolean;
  max_discount_amount: number | null;
  start_date: string; // ISO date
  end_date: string;   // ISO date
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface SchemeGeneric extends SchemeBase {
  rule_type: 'generic';
  min_purchase_amount: number | null;
  min_quantity: number | null;
  applicable_items: string[] | null;
  applicable_categories: string[] | null;
}

export interface SchemeCategory extends SchemeBase {
  rule_type: 'category';
  target_categories: string[]; // product_type values
}

export interface SchemeCategoryDia extends SchemeBase {
  rule_type: 'category_dia';
  target_categories: string[];
  dia_charge_min: number | null;
  dia_charge_max: number | null;
}

export interface SchemeCategoryMaking extends SchemeBase {
  rule_type: 'category_making';
  target_categories: string[];
  making_charge_min: number | null;
  making_charge_max: number | null;
}

export interface SchemeCategoryPrice extends SchemeBase {
  rule_type: 'category_price';
  target_categories: string[];
  price_min: number | null;
  price_max: number | null;
}

export interface SchemeProduct extends SchemeBase {
  rule_type: 'product';
  target_products: string[]; // catalog_product IDs
}

export type Scheme =
  | SchemeGeneric
  | SchemeCategory
  | SchemeCategoryDia
  | SchemeCategoryMaking
  | SchemeCategoryPrice
  | SchemeProduct;

/**
 * Scheme Evaluation Result
 * Returned when a scheme is determined to be applicable to a product
 */
export interface SchemeEvaluationResult {
  scheme: Scheme;
  applicableReason: string; // Human-readable explanation
  discountAmount: number;
  effectivePrice: number;
  basePrice: number;
  discountBasis: DiscountBasis;
}

/**
 * Product Scheme Context
 * Information about a product for scheme evaluation
 */
export interface ProductSchemeContext {
  productId: string;
  productName: string;
  category: string; // product_type
  basePrice: number;
  diaCharge?: number;
  makingCharge?: number;
  quantity?: number;
}
