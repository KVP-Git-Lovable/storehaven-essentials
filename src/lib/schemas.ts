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
  assetMasterId: z.string().min(1, "Asset master is required"),
  assetNumber: z.string().trim().min(1, "Asset number is required").max(50, "Asset number must be less than 50 characters"),
  storeId: z.string().min(1, "Store is required"),
  location: z.string().trim().min(1, "Location is required"),
  condition: z.string().trim().min(1, "Condition is required"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  value: z.coerce.number().min(0, "Value must be 0 or more").max(100000000, "Value seems too high"),
  vendorId: z.string().min(1, "Vendor is required"),
  oemId: z.string().optional(),
  warrantyStartDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
});

export const spareSchema = z.object({
  name: z.string().trim().min(1, "Spare name is required").max(100, "Name must be less than 100 characters"),
  category: z.string().trim().min(1, "Category is required"),
  quantity: z.coerce.number().min(0, "Quantity must be 0 or more").max(100000, "Quantity seems too high"),
  minStock: z.coerce.number().min(0, "Min stock must be 0 or more").max(10000, "Min stock seems too high"),
  unitPrice: z.coerce.number().min(0, "Unit price must be 0 or more").max(10000000, "Price seems too high"),
  supplier: z.string().trim().min(1, "Supplier is required").max(100, "Supplier must be less than 100 characters"),
});

export const serviceContractSchema = z.object({
  vendor: z.string().trim().min(1, "Vendor is required"),
  serviceType: z.string().trim().min(1, "Service type is required").max(50, "Type must be less than 50 characters"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  value: z.coerce.number().min(1, "Value is required").max(100000000, "Value seems too high"),
  assetIds: z.array(z.string()).min(1, "At least one asset is required"),
});

export const maintenanceSchema = z.object({
  asset: z.string().trim().min(1, "Asset is required"),
  taskType: z.string().trim().min(1, "Task type is required").max(50, "Type must be less than 50 characters"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annual"]),
  assignedTo: z.string().trim().min(1, "Assignee is required").max(50, "Name must be less than 50 characters"),
  nextDue: z.string().min(1, "Next due date is required"),
});

export const incidentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title must be less than 100 characters"),
  location: z.string().min(1, "Location is required"),
  priority: z.enum(["low", "medium", "high", "critical"]),
  reportedBy: z.string().trim().min(1, "Reporter name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().trim().max(500, "Description must be less than 500 characters").optional(),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "Vendor name is required").max(100, "Name must be less than 100 characters"),
  category: z.string().trim().min(1, "Category is required"),
  vendorType: z.string().min(1, "Vendor type is required"),
  contactPerson: z.string().trim().min(1, "Contact person is required").max(100, "Name must be less than 100 characters"),
  phone: z.string().trim().min(10, "Valid phone number required").max(15, "Phone must be less than 15 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
});

export const expenseSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(200, "Description must be less than 200 characters"),
  category: z.string().trim().min(1, "Category is required"),
  amount: z.coerce.number().min(1, "Amount is required").max(1000000, "Amount seems too high"),
  date: z.string().min(1, "Date is required"),
  vendor: z.string().trim().max(100, "Vendor must be less than 100 characters").optional(),
});

export const utilityReadingSchema = z.object({
  store: z.string().min(1, "Store is required"),
  utilityType: z.string().min(1, "Utility type is required"),
  meterReading: z.coerce.number().min(0, "Reading must be 0 or more").max(100000, "Reading seems too high"),
  readingDate: z.string().min(1, "Date is required"),
});

export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().trim().min(10, "Valid phone number required").max(15, "Phone must be less than 15 characters"),
  department: z.string().trim().min(1, "Department is required").max(50, "Department must be less than 50 characters"),
  position: z.string().trim().min(1, "Position is required").max(50, "Position must be less than 50 characters"),
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
