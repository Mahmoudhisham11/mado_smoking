/**
 * Firestore Central Export Module (Domain Services Barrel)
 * Provides organized, domain-driven services while maintaining 100% backward compatibility.
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
  updateCustody,
  adjustCustodyAmount,
  transferCustodyAmount,
  createMissingCustodies,
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
  updateStoreProductQuantity,
  setStoreProductQuantity,
  applyInvoiceToInventory,
  subscribeToStoreTransfers,
  addStoreTransfer,
  deleteStoreTransfer,
} from './services/stores.service';

// Suppliers & Sources Services
export {
  subscribeToSources,
  addSource,
  updateSource,
  deleteSource,
  getSource,
  addSourceInvoice,
  subscribeAllSourceInvoices,
  subscribeToSourceInvoices,
  deleteSourceInvoice,
  addSourcePayment,
  subscribeToSourcePayments,
  deleteSourcePayment,
  getSourcePaymentsByInvoiceId,
  updateSourceInvoice,
} from './services/sources.service';

// Customer & Sales Services
export {
  subscribeToCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomer,
  subscribeAllCustomerInvoices,
  subscribeToCustomerInvoices,
  addCustomerInvoice,
  updateCustomerInvoice,
  deleteCustomerInvoice,
  getCustomerPaymentsByInvoiceId,
  subscribeToCustomerPayments,
  addCustomerPayment,
  deleteCustomerPayment,
} from './services/customers.service';

// Expenses Services
export {
  subscribeToExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
} from './services/expenses.service';
