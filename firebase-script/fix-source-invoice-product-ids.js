import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";

// ======================================
// Firebase Configuration
// ======================================

const firebaseConfig = {
  apiKey: "AIzaSyDqMxeFdns0hikFfyCoUfgxf4zqgBS75U0",
  authDomain: "smartbarbar-b28f2.firebaseapp.com",
  projectId: "smartbarbar-b28f2",
  storageBucket: "smartbarbar-b28f2.firebasestorage.app",
  messagingSenderId: "269036618921",
  appId: "1:269036618921:web:6b0088e1dc00d14d6115b8",
};

// ======================================
// Initialize Firebase
// ======================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ======================================
// Collections
// ======================================

const PRODUCTS_COLLECTION = "smokingProducts";
const SOURCE_INVOICES_COLLECTION = "sourceInvoices";

// ======================================
// Normalize Product Name
// ======================================

function normalizeName(name) {
  if (!name) return "";

  return String(name)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// ======================================
// Main Function
// ======================================

async function fixSourceInvoiceProductIds() {
  console.log("🚀 بدأ تشغيل سكربت إصلاح productId...\n");

  // ======================================
  // 1. قراءة كل المنتجات
  // ======================================

  console.log(
    `📦 قراءة المنتجات من collection: ${PRODUCTS_COLLECTION}`
  );

  const productsSnapshot = await getDocs(
    collection(db, PRODUCTS_COLLECTION)
  );

  const productsByName = new Map();

  let duplicateProducts = 0;

  for (const productDoc of productsSnapshot.docs) {
    const productData = productDoc.data();

    const productName = normalizeName(productData.name);

    if (!productName) {
      console.warn(
        `⚠️ تم تجاهل المنتج ${productDoc.id} لأنه لا يحتوي على name`
      );

      continue;
    }

    // لو فيه أكثر من منتج بنفس الاسم
    if (productsByName.has(productName)) {
      duplicateProducts++;

      console.warn(
        `⚠️ يوجد أكثر من منتج بنفس الاسم: "${productData.name}"`
      );

      continue;
    }

    productsByName.set(productName, {
      id: productDoc.id,
      name: productData.name,
    });
  }

  console.log(
    `✅ تم تحميل ${productsByName.size} منتج\n`
  );

  // ======================================
  // 2. قراءة فواتير الموردين
  // ======================================

  console.log(
    `🧾 قراءة الفواتير من collection: ${SOURCE_INVOICES_COLLECTION}`
  );

  const invoicesSnapshot = await getDocs(
    collection(db, SOURCE_INVOICES_COLLECTION)
  );

  console.log(
    `✅ تم العثور على ${invoicesSnapshot.size} فاتورة\n`
  );

  // ======================================
  // Counters
  // ======================================

  let totalInvoices = 0;
  let changedInvoices = 0;
  let changedProducts = 0;
  let alreadyCorrect = 0;
  let notFoundProducts = 0;
  let invalidProducts = 0;

  // Firebase batch limit is 500 writes
  const MAX_BATCH_SIZE = 450;

  let currentBatch = writeBatch(db);
  let currentBatchOperations = 0;

  // ======================================
  // Process Invoices
  // ======================================

  for (const invoiceDoc of invoicesSnapshot.docs) {
    totalInvoices++;

    const invoiceData = invoiceDoc.data();

    const products = invoiceData.products || [];

    if (!Array.isArray(products)) {
      console.warn(
        `⚠️ الفاتورة ${invoiceDoc.id} لا تحتوي على products array`
      );

      continue;
    }

    let invoiceChanged = false;

    const updatedProducts = products.map((line, index) => {
      if (!line || typeof line !== "object") {
        invalidProducts++;

        console.warn(
          `⚠️ بيانات غير صالحة في الفاتورة ${invoiceDoc.id} - المنتج رقم ${
            index + 1
          }`
        );

        return line;
      }

      const productName = normalizeName(
        line.productName || line.name
      );

      if (!productName) {
        invalidProducts++;

        console.warn(
          `⚠️ المنتج رقم ${index + 1} في الفاتورة ${
            invoiceDoc.id
          } لا يحتوي على productName`
        );

        return line;
      }

      const matchedProduct = productsByName.get(productName);

      // المنتج غير موجود في smokingProducts
      if (!matchedProduct) {
        notFoundProducts++;

        console.warn(
          `❌ لم يتم العثور على المنتج "${line.productName}" في smokingProducts`
        );

        return line;
      }

      const currentProductId = line.productId;
      const correctProductId = matchedProduct.id;

      // الـ productId صحيح بالفعل
      if (currentProductId === correctProductId) {
        alreadyCorrect++;

        return line;
      }

      // تعديل المنتج
      invoiceChanged = true;
      changedProducts++;

      console.log(
        `🔧 تعديل المنتج: "${line.productName}"`
      );

      console.log(
        `   الفاتورة: ${invoiceDoc.id}`
      );

      console.log(
        `   القديم: ${currentProductId || "غير موجود"}`
      );

      console.log(
        `   الجديد: ${correctProductId}`
      );

      return {
        ...line,
        productId: correctProductId,
      };
    });

    // ======================================
    // Add Invoice Update to Batch
    // ======================================

    if (invoiceChanged) {
      changedInvoices++;

      const invoiceRef = doc(
        db,
        SOURCE_INVOICES_COLLECTION,
        invoiceDoc.id
      );

      currentBatch.update(invoiceRef, {
        products: updatedProducts,
      });

      currentBatchOperations++;

      // Commit batch before reaching Firebase limit
      if (currentBatchOperations >= MAX_BATCH_SIZE) {
        console.log(
          "\n💾 حفظ Batch من التعديلات..."
        );

        await currentBatch.commit();

        console.log(
          "✅ تم حفظ Batch بنجاح\n"
        );

        currentBatch = writeBatch(db);
        currentBatchOperations = 0;
      }
    }
  }

  // ======================================
  // Commit Remaining Changes
  // ======================================

  if (currentBatchOperations > 0) {
    console.log(
      "\n💾 حفظ آخر Batch من التعديلات..."
    );

    await currentBatch.commit();

    console.log(
      "✅ تم حفظ آخر Batch بنجاح"
    );
  }

  // ======================================
  // Final Report
  // ======================================

  console.log("\n");
  console.log("======================================");
  console.log("🎉 انتهى السكربت بنجاح");
  console.log("======================================");

  console.log(
    `📄 إجمالي الفواتير: ${totalInvoices}`
  );

  console.log(
    `✏️ الفواتير التي تم تعديلها: ${changedInvoices}`
  );

  console.log(
    `🔧 إجمالي المنتجات التي تم تعديلها: ${changedProducts}`
  );

  console.log(
    `✅ المنتجات التي كان ID الخاص بها صحيحًا: ${alreadyCorrect}`
  );

  console.log(
    `❌ المنتجات التي لم يتم العثور عليها: ${notFoundProducts}`
  );

  console.log(
    `⚠️ المنتجات ذات البيانات غير الصالحة: ${invalidProducts}`
  );

  console.log(
    `⚠️ المنتجات المكررة في smokingProducts: ${duplicateProducts}`
  );

  console.log("\n✅ تم الانتهاء من تعديل البيانات.");
}

// ======================================
// Run Script
// ======================================

fixSourceInvoiceProductIds()
  .then(() => {
    console.log("\n🏁 انتهى البرنامج.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ حدث خطأ أثناء تشغيل السكربت:");
    console.error(error);

    process.exit(1);
  });