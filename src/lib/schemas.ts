import { z } from "zod";

export const storeSchema = z.object({
  name: z.string().trim().min(1, "Store name is required").max(100, "Name must be less than 100 characters"),
  address: z.string().trim().min(1, "Address is required").max(255, "Address must be less than 255 characters"),
  phone: z.string().trim().min(10, "Valid phone number required").max(15, "Phone must be less than 15 characters"),
  manager: z.string().trim().min(1, "Manager name is required").max(100, "Name must be less than 100 characters"),
  status: z.enum(["active", "under-renovation", "closed"]),
});

export const rentalSchema = z.object({
  store: z.string().trim().min(1, "Store is required"),
  landlord: z.string().trim().min(1, "Landlord name is required").max(100, "Name must be less than 100 characters"),
  rent: z.coerce.number().min(1, "Rent amount is required").max(10000000, "Rent seems too high"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(100, "Name must be less than 100 characters"),
  category: z.string().trim().min(1, "Category is required"),
  brand: z.string().trim().min(1, "Brand is required").max(50, "Brand must be less than 50 characters"),
  model: z.string().trim().min(1, "Model is required").max(50, "Model must be less than 50 characters"),
  warranty: z.string().trim().min(1, "Warranty period is required"),
  price: z.coerce.number().min(1, "Price is required").max(100000000, "Price seems too high"),
});

export const assetSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  store: z.string().min(1, "Store is required"),
  serialNo: z.string().trim().min(1, "Serial number is required").max(50, "Serial number must be less than 50 characters"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  status: z.enum(["operational", "maintenance", "non-operational"]),
});

export const spareSchema = z.object({
  name: z.string().trim().min(1, "Spare name is required").max(100, "Name must be less than 100 characters"),
  category: z.string().trim().min(1, "Category is required"),
  quantity: z.coerce.number().min(0, "Quantity must be 0 or more").max(100000, "Quantity seems too high"),
  reorderLevel: z.coerce.number().min(1, "Reorder level is required").max(10000, "Reorder level seems too high"),
  unitPrice: z.coerce.number().min(1, "Unit price is required").max(10000000, "Price seems too high"),
});

export const serviceContractSchema = z.object({
  vendor: z.string().trim().min(1, "Vendor is required"),
  type: z.string().trim().min(1, "Contract type is required").max(50, "Type must be less than 50 characters"),
  stores: z.coerce.number().min(1, "At least 1 store required").max(1000, "Too many stores"),
  annualValue: z.coerce.number().min(1, "Annual value is required").max(100000000, "Value seems too high"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export const maintenanceSchema = z.object({
  asset: z.string().trim().min(1, "Asset is required"),
  type: z.string().trim().min(1, "Maintenance type is required").max(50, "Type must be less than 50 characters"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annual"]),
  assignedTo: z.string().trim().min(1, "Assignee is required").max(50, "Name must be less than 50 characters"),
  nextDue: z.string().min(1, "Next due date is required"),
});

export const incidentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title must be less than 100 characters"),
  store: z.string().min(1, "Store is required"),
  asset: z.string().trim().min(1, "Asset is required"),
  priority: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().trim().max(500, "Description must be less than 500 characters").optional(),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "Vendor name is required").max(100, "Name must be less than 100 characters"),
  category: z.string().trim().min(1, "Category is required"),
  contact: z.string().trim().min(1, "Contact person is required").max(100, "Name must be less than 100 characters"),
  phone: z.string().trim().min(10, "Valid phone number required").max(15, "Phone must be less than 15 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
});

export const expenseSchema = z.object({
  store: z.string().min(1, "Store is required"),
  category: z.string().trim().min(1, "Category is required"),
  description: z.string().trim().min(1, "Description is required").max(200, "Description must be less than 200 characters"),
  amount: z.coerce.number().min(1, "Amount is required").max(1000000, "Amount seems too high"),
});

export const utilityReadingSchema = z.object({
  store: z.string().min(1, "Store is required"),
  date: z.string().min(1, "Date is required"),
  power: z.coerce.number().min(0, "Power reading must be 0 or more").max(100000, "Reading seems too high"),
  water: z.coerce.number().min(0, "Water reading must be 0 or more").max(10000, "Reading seems too high"),
  generator: z.coerce.number().min(0, "Generator hours must be 0 or more").max(1000, "Hours seem too high"),
});

export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  store: z.string().min(1, "Store is required"),
  role: z.string().trim().min(1, "Role is required").max(50, "Role must be less than 50 characters"),
  phone: z.string().trim().min(10, "Valid phone number required").max(15, "Phone must be less than 15 characters"),
  joinDate: z.string().min(1, "Join date is required"),
});

export type StoreFormData = z.infer<typeof storeSchema>;
export type RentalFormData = z.infer<typeof rentalSchema>;
export type ProductFormData = z.infer<typeof productSchema>;
export type AssetFormData = z.infer<typeof assetSchema>;
export type SpareFormData = z.infer<typeof spareSchema>;
export type ServiceContractFormData = z.infer<typeof serviceContractSchema>;
export type MaintenanceFormData = z.infer<typeof maintenanceSchema>;
export type IncidentFormData = z.infer<typeof incidentSchema>;
export type VendorFormData = z.infer<typeof vendorSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type UtilityReadingFormData = z.infer<typeof utilityReadingSchema>;
export type EmployeeFormData = z.infer<typeof employeeSchema>;
