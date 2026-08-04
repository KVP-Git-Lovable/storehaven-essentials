/**
 * Centralized Scheme Evaluation Engine
 * Responsible for determining which scheme applies to a product and calculating effective prices
 * Used by both Catalog Master and New Sale to ensure pricing consistency
 */

import {
  Scheme,
  SchemeEvaluationResult,
  ProductSchemeContext,
  DiscountBasis,
} from '@/types/schemes';

/**
 * Check if a scheme rule applies to a product
 */
function schemeAppliesToProduct(
  scheme: Scheme,
  product: ProductSchemeContext
): boolean {
  const today = new Date().toISOString().split('T')[0];

  // Check active status and date range
  if (scheme.status !== 'active') return false;
  if (today < scheme.start_date || today > scheme.end_date) return false;

  switch (scheme.rule_type) {
    case 'generic':
      // Generic schemes apply to all products unless excluded
      return true;

    case 'category':
      // Check if product category is in target categories
      return (scheme.target_categories || []).includes(product.category);

    case 'category_dia':
      // Check category AND diamond charge range
      if (!scheme.target_categories?.includes(product.category)) return false;
      if (!product.diaCharge) return false;

      const diaMin = scheme.dia_charge_min ?? 0;
      const diaMax = scheme.dia_charge_max ?? Infinity;

      return product.diaCharge >= diaMin && product.diaCharge <= diaMax;

    case 'category_making':
      // Check category AND making charge range
      if (!scheme.target_categories?.includes(product.category)) return false;
      if (!product.makingCharge) return false;

      const makingMin = scheme.making_charge_min ?? 0;
      const makingMax = scheme.making_charge_max ?? Infinity;

      return product.makingCharge >= makingMin && product.makingCharge <= makingMax;

    case 'category_price':
      // Check category AND price range
      if (!scheme.target_categories?.includes(product.category)) return false;

      const priceMin = scheme.price_min ?? 0;
      const priceMax = scheme.price_max ?? Infinity;

      return product.basePrice >= priceMin && product.basePrice <= priceMax;

    case 'product':
      // Check if product is in target products list
      return (scheme.target_products || []).includes(product.productId);

    default:
      return false;
  }
}

/**
 * Calculate discount amount based on scheme and product context
 */
function calculateDiscount(
  scheme: Scheme,
  discountBasis: number
): number {
  let discount = 0;

  switch (scheme.discount_type) {
    case 'percentage':
      discount = (discountBasis * scheme.discount_value) / 100;
      break;
    case 'fixed':
      discount = scheme.discount_value;
      break;
    case 'buy_x_get_y':
      // BOGO: assume quantity in context
      discount = scheme.discount_value;
      break;
    case 'tiered':
      discount = (discountBasis * scheme.discount_value) / 100;
      break;
    case 'bundle':
      discount = scheme.discount_value;
      break;
    case 'cashback':
      discount = (discountBasis * scheme.discount_value) / 100;
      break;
    case 'free_shipping':
      // Handled separately at order level
      discount = 0;
      break;
    case 'second_at_discount':
      discount = scheme.discount_value;
      break;
    default:
      discount = 0;
  }

  // Cap discount at max_discount_amount if specified
  if (scheme.max_discount_amount !== null && discount > scheme.max_discount_amount) {
    discount = scheme.max_discount_amount;
  }

  return Math.max(0, discount);
}

/**
 * Get the discount basis amount from product context
 */
function getDiscountBasisAmount(
  basis: DiscountBasis,
  product: ProductSchemeContext
): number {
  switch (basis) {
    case 'product_price':
      return product.basePrice;
    case 'dia_charge':
      return product.diaCharge || 0;
    case 'making_charge':
      return product.makingCharge || 0;
    case 'total_eligible':
      return (product.basePrice || 0) + (product.diaCharge || 0) + (product.makingCharge || 0);
    default:
      return product.basePrice;
  }
}

/**
 * Evaluate all applicable schemes and determine the winning scheme
 * Priority: Individual Product > Category+Attr > Category > Generic
 */
export function evaluateApplicableSchemes(
  product: ProductSchemeContext,
  schemes: Scheme[]
): SchemeEvaluationResult | null {
  // Filter active and applicable schemes
  const applicableSchemes = schemes.filter((s) => schemeAppliesToProduct(s, product));

  if (applicableSchemes.length === 0) {
    return null;
  }

  // Sort by priority (higher priority first) then by specificity
  // Specificity order: product > category_dia/making/price > category > generic
  const specificityOrder: Record<string, number> = {
    product: 5,
    category_dia: 4,
    category_making: 4,
    category_price: 4,
    category: 3,
    generic: 1,
  };

  const sortedSchemes = applicableSchemes.sort((a, b) => {
    // First sort by priority (descending)
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    // Then by specificity (descending)
    return (specificityOrder[b.rule_type] || 0) - (specificityOrder[a.rule_type] || 0);
  });

  // Use the first (highest priority/specificity) scheme
  const winningScheme = sortedSchemes[0];

  const discountBasisAmount = getDiscountBasisAmount(winningScheme.discount_basis, product);
  const discountAmount = calculateDiscount(winningScheme, discountBasisAmount);

  // Calculate effective price
  // Note: Discount is only applied to the discount_basis amount, not the entire price
  let effectivePrice = product.basePrice;
  if (winningScheme.discount_basis === 'product_price') {
    effectivePrice = product.basePrice - discountAmount;
  }

  return {
    scheme: winningScheme,
    applicableReason: getApplicableReasonText(winningScheme, product),
    discountAmount,
    effectivePrice: Math.max(0, effectivePrice),
    basePrice: product.basePrice,
    discountBasis: winningScheme.discount_basis,
  };
}

/**
 * Generate human-readable explanation for why a scheme applies
 */
function getApplicableReasonText(scheme: Scheme, product: ProductSchemeContext): string {
  switch (scheme.rule_type) {
    case 'generic':
      return 'Universal promotion';
    case 'category':
      return `Category: ${product.category}`;
    case 'category_dia':
      return `${product.category} with diamond charge ₹${product.diaCharge || 0}`;
    case 'category_making':
      return `${product.category} with making charge ₹${product.makingCharge || 0}`;
    case 'category_price':
      return `${product.category} priced at ₹${product.basePrice}`;
    case 'product':
      return `Individual product: ${product.productName}`;
    default:
      return 'Applicable scheme';
  }
}

/**
 * Calculate effective price for a product given applicable schemes
 * This is the main entry point for calculating final prices
 */
export function calculateEffectivePrice(
  product: ProductSchemeContext,
  schemes: Scheme[]
): {
  basePrice: number;
  applicableScheme: Scheme | null;
  discountAmount: number;
  effectivePrice: number;
  applicableReason: string;
} {
  const result = evaluateApplicableSchemes(product, schemes);

  if (!result) {
    return {
      basePrice: product.basePrice,
      applicableScheme: null,
      discountAmount: 0,
      effectivePrice: product.basePrice,
      applicableReason: 'No applicable scheme',
    };
  }

  return {
    basePrice: result.basePrice,
    applicableScheme: result.scheme,
    discountAmount: result.discountAmount,
    effectivePrice: result.effectivePrice,
    applicableReason: result.applicableReason,
  };
}

/**
 * Filter schemes by rule type
 */
export function filterSchemesByRuleType(schemes: Scheme[], ruleType: string[]): Scheme[] {
  return schemes.filter((s) => ruleType.includes(s.rule_type));
}

/**
 * Get active schemes only
 */
export function getActiveSchemes(schemes: Scheme[]): Scheme[] {
  const today = new Date().toISOString().split('T')[0];
  return schemes.filter(
    (s) => s.status === 'active' && s.start_date <= today && s.end_date >= today
  );
}
