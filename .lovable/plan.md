

# Point of Sale (POS) Enhancement Plan

## Current State Analysis

The existing POS module has these basic features:
- **PointOfSale**: Product grid, barcode scanning, cart management, customer lookup (phone-based), dual payment (Cash/UPI), and scheme application
- **ProductMaster**: Basic CRUD for products with category, brand, model, price
- **OrderHistory**: View past orders with details dialog
- **Schemes**: Discount promotions management (percentage, fixed, buy-x-get-y)
- **Database**: `orders`, `order_items`, `customers`, `products`, `schemes` tables

### Gaps Identified:
1. No split/multiple payment methods
2. No hold/recall orders functionality
3. No receipt printing/generation
4. No refunds/returns capability
5. No keyboard shortcuts for speed
6. No cashier sessions/drawer management
7. Limited product info (no stock, images, tax rates)
8. No quick denomination calculator
9. No discount at line-item level via UI
10. No customer history view during billing
11. No POS Dashboard with daily analytics

---

## Proposed Feature Enhancements

### 1. Enhanced Billing Experience

**Quick Actions Bar**
- Keyboard shortcuts: F1 (Customer), F2 (Scan), F3 (Clear), F4 (Hold), F5 (Recall), F12 (Pay)
- Quick denomination buttons for cash (₹10, ₹20, ₹50, ₹100, ₹200, ₹500, ₹2000)
- One-click quantity adjustment (1, 2, 5, 10)

**Hold & Recall Orders**
- Allow holding current cart with a note (e.g., "Customer stepped out")
- View and recall held orders to continue billing
- Auto-expire held orders after 24 hours

**Line-Item Discounts**
- Apply percentage or fixed discount to individual cart items
- Manual discount with manager approval (optional PIN)
- Display original vs. discounted price clearly

### 2. Multiple Payment Methods (Split Payments)

**Split Payment Support**
- Accept payment across Cash + UPI + Card
- Show remaining balance after each payment
- Track all payment methods on a single order
- New database table: `order_payments` to store multiple payments per order

**Additional Payment Methods**
- Card (with reference number)
- Credit/Store Credit
- Loyalty Points redemption

### 3. Returns & Refunds Module

**New Page: Returns Processing**
- Search order by order number or customer phone
- Select items to return (full or partial)
- Specify return reason (from reason_codes)
- Issue refund (original payment method or store credit)
- Generate return receipt

**Database Updates**
- New table: `returns` (order_id, return_reason, refund_amount, refund_method, status)
- New table: `return_items` (return_id, order_item_id, quantity, condition)

### 4. Receipt Generation & Printing

**Digital Receipt**
- Auto-generate receipt post-payment
- Include store details, items, taxes, payment breakdown
- QR code for order lookup
- Option to email/SMS receipt to customer

**Print Receipt**
- Thermal printer format (80mm width)
- Print button on order complete dialog
- Reprint from Order History

### 5. Customer 360 Panel

**Enhanced Customer Dialog**
- Show customer purchase history (last 5 orders)
- Display loyalty points balance with redemption option
- Show favorite/frequently purchased items
- Quick add to cart from favorites
- Birthday/anniversary reminders for discounts

### 6. Cashier Session Management

**Shift Management**
- Open/Close drawer with starting float amount
- Track cash in/out during shift
- End-of-day reconciliation report
- New database table: `cashier_sessions` (user_id, start_time, end_time, opening_float, closing_balance, status)

### 7. POS Dashboard

**New Dashboard Tab under POS Menu**
- Today's sales summary (total orders, revenue, avg ticket size)
- Hourly sales trend chart
- Top 10 selling products today
- Payment method breakdown (pie chart)
- Cashier performance comparison (for managers)

### 8. Product Enhancements

**Product Master Upgrades**
- Add fields: `tax_rate`, `cost_price`, `image_url`, `sku`, `barcode`, `stock_qty`, `min_stock`
- Product images in grid view
- Low stock indicator badge
- Quick stock check from POS screen

**Category Quick Filters**
- Category tabs above product grid for faster navigation
- "Favorites" or "Frequently Sold" quick-access section

### 9. Offline Mode Support (Future-Ready)

**Local Storage Sync**
- Cache products for offline billing
- Queue orders when offline, sync when back online
- Visual indicator for offline mode

---

## Implementation Summary

| Feature | Priority | Complexity | Files Affected |
|---------|----------|------------|----------------|
| Keyboard Shortcuts | High | Low | PointOfSale.tsx |
| Hold/Recall Orders | High | Medium | PointOfSale.tsx, new component |
| Split Payments | High | Medium | PointOfSale.tsx, new DB table |
| Line-Item Discounts | High | Low | PointOfSale.tsx |
| Cash Denomination Buttons | High | Low | PointOfSale.tsx |
| Returns Module | High | High | New page, 2 new DB tables |
| Receipt Generation | Medium | Medium | New component |
| Customer 360 Panel | Medium | Medium | PointOfSale.tsx |
| Cashier Sessions | Medium | Medium | New page, new DB table |
| POS Dashboard | Medium | Medium | New page |
| Product Enhancements | Medium | Medium | ProductMaster.tsx, DB migration |
| Category Quick Filters | Low | Low | PointOfSale.tsx |

---

## Technical Implementation Details

### Database Migrations Required

```text
1. order_payments table
   - id, order_id, payment_method, amount, reference, created_at

2. held_orders table
   - id, cart_data (jsonb), customer_id, note, created_by, expires_at

3. returns table
   - id, order_id, return_date, reason_code, refund_amount, refund_method, status, processed_by

4. return_items table
   - id, return_id, order_item_id, quantity, condition, notes

5. cashier_sessions table
   - id, user_id, store_id, start_time, end_time, opening_float, cash_in, cash_out, closing_balance, status

6. products table updates
   - Add: tax_rate, cost_price, image_url, sku, barcode, stock_qty, min_stock
```

### New Pages/Components

```text
src/pages/pos/
├── POSDashboard.tsx          (new)
├── ReturnsProcessing.tsx     (new)
├── CashierSessions.tsx       (new)
├── PointOfSale.tsx           (enhance)
├── ProductMaster.tsx         (enhance)
├── OrderHistory.tsx          (enhance)
└── Schemes.tsx               (existing)

src/components/pos/
├── HeldOrdersPanel.tsx       (new)
├── SplitPaymentDialog.tsx    (new)
├── ReceiptPreview.tsx        (new)
├── Customer360Panel.tsx      (new)
├── QuickActionsBar.tsx       (new)
├── CategoryTabs.tsx          (new)
└── DenominationCalculator.tsx(new)
```

### Sidebar Updates

Add new menu items under POS:
- POS Dashboard
- Billing (PointOfSale)
- Products
- Orders
- Returns
- Schemes
- Cashier Sessions

---

## Expected Outcome

After implementing these features, the POS module will:

- Support high-volume retail with keyboard shortcuts and quick actions
- Handle complex payment scenarios (split payments, loyalty redemption)
- Provide complete transaction lifecycle (sale → return → refund)
- Offer real-time insights via POS Dashboard
- Improve customer experience with 360-degree view and receipts
- Enable accountability with cashier session tracking

This elevates the POS from a basic billing tool to a **full-featured retail point-of-sale system** scoring **8/10** in functionality.

