/**
 * Firestore Central Export Module (Domain Services Barrel)
 * كل عمليات الفلوس والمخزون بتتم جوه transactions في الـ services.
 */

// Common Database Configuration & Helpers
export { db } from './config';
export { getUserIds } from './services/helpers';

// User Management Services
export {
  createUser,
  createUserByOwner,
  getUsersByOwner,
  updateUserRole,
  updateUserData,
  getUser,
  updateUser,
  deleteUser,
  subscribeToUser,
} from './services/users.service';

// Financial Custody Services
export {
  subscribeToCustodies,
  subscribeToCustodyMovements,
  updateCustody,
  transferCustodyAmount,
  createMissingCustodies,
  ensureCustody,
} from './services/custodies.service';

// Products & Inventory Items Services
export {
  getProducts,
  subscribeToProducts,
  getProduct,
  addProduct,
  updateProduct,
  deleteProduct,
} from './services/products.service';

// Stores & Warehouse Services
export {
  subscribeToStores,
  addStore,
  updateStore,
  deleteStore,
  getStore,
  subscribeToStoreProducts,
  subscribeToAllStoreProducts,
  subscribeToProductStock,
  importStoreQuantities,
  subscribeToStoreTransfers,
  addStoreTransfer,
  updateStoreTransfer,
  deleteStoreTransfer,
} from './services/stores.service';

// Suppliers & Sources Services
export {
  subscribeToSources,
  subscribeToSource,
  addSource,
  updateSource,
  deleteSource,
  getSource,
  addSourceInvoice,
  subscribeToSourceInvoices,
  subscribeProductSourceInvoices,
  deleteSourceInvoice,
  addSourcePayment,
  subscribeToSourcePayments,
  deleteSourcePayment,
  updateSourceInvoice,
  fetchSourceLedger,
  fetchSourceInvoicePayments,
} from './services/sources.service';

// Customer & Sales Services
export {
  subscribeToCustomers,
  subscribeToCustomer,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomer,
  subscribeToCustomerInvoices,
  subscribeProductCustomerInvoices,
  addCustomerInvoice,
  updateCustomerInvoice,
  deleteCustomerInvoice,
  subscribeToCustomerPayments,
  addCustomerPayment,
  deleteCustomerPayment,
  fetchCustomerLedger,
  fetchCustomerInvoicePayments,
} from './services/customers.service';

// Reports
export { fetchPeriodData } from './services/reports.service';

// Expenses Services
export {
  subscribeToExpenses,
  subscribeTodayExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
} from './services/expenses.service';

// Data migration (one-time per owner)
export {
  subscribeToMigrationStatus,
  runMigration,
  exportBackup,
  MIGRATION_VERSION,
} from './services/migration.service';
