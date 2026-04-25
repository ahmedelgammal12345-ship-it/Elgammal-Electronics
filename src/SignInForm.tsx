import { useState } from "react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { Toaster } from "sonner";
import { Id } from "../convex/_generated/dataModel";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import POSTerminal from "./components/POSTerminal";
import ProductsPage from "./components/ProductsPage";
import SalesPage from "./components/SalesPage";
import QuotationsPage from "./components/QuotationsPage";
import InventoryPage from "./components/InventoryPage";
import AnalyticsPage from "./components/AnalyticsPage";
import StoresPage from "./components/StoresPage";
import UserRolesPage from "./components/UserRolesPage";
import CatalogSearchPage from "./components/CatalogSearchPage";
import CustomersPage from "./components/CustomersPage";
import PurchaseOrdersPage from "./components/PurchaseOrdersPage";
import ReturnsPage from "./components/ReturnsPage";
import ShiftsPage from "./components/ShiftsPage";
import ProductImportPage from "./components/ProductImportPage";
import SalesmenPage from "./components/SalesmenPage";
import WarehousesPage from "./components/WarehousesPage";
import FulfillmentPage from "./components/FulfillmentPage";
import ChequesPage from "./components/ChequesPage";
import BulkPhotoUploadPage from "./components/BulkPhotoUploadPage";

export type Page =
  | "dashboard"
  | "pos"
  | "products"
  | "sales"
  | "quotations"
  | "inventory"
  | "analytics"
  | "stores"
  | "roles"
  | "catalog"
  | "customers"
  | "purchase-orders"
  | "returns"
  | "shifts"
  | "import"
  | "salesmen"
  | "warehouses"
  | "fulfillment"
  | "cheques"
  | "bulk-photos";

export default function App() {
  return (
    <>
      <Authenticated>
        <MainApp />
      </Authenticated>
      <Unauthenticated>
        <AuthPage />
      </Unauthenticated>
      <Toaster position="top-right" richColors />
    </>
  );
}

function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">POS System</h1>
          <p className="text-slate-400">Multi-Store Point of Sale</p>
        </div>
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
          <SignInForm />
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [selectedStoreId, setSelectedStoreId] = useState<Id<"stores"> | null>(null);
  const stores = useQuery(api.stores.list);
  const myRole = useQuery(api.userRoles.myRole);

  const isManager = !myRole || myRole.role === "manager";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        selectedStoreId={selectedStoreId}
        setSelectedStoreId={setSelectedStoreId}
        stores={stores ?? []}
        isManager={isManager}
      />
      {/* pt-14 = mobile top bar height, pb-16 = mobile bottom nav height */}
      <main className="flex-1 overflow-auto pt-14 pb-16 md:pt-0 md:pb-0">
        {currentPage === "dashboard" && (
          <Dashboard selectedStoreId={selectedStoreId} stores={stores ?? []} />
        )}
        {currentPage === "pos" && (
          <POSTerminal selectedStoreId={selectedStoreId} stores={stores ?? []} />
        )}
        {currentPage === "products" && <ProductsPage isManager={isManager} />}
        {currentPage === "sales" && (
          <SalesPage selectedStoreId={selectedStoreId} stores={stores ?? []} />
        )}
        {currentPage === "quotations" && (
          <QuotationsPage selectedStoreId={selectedStoreId} stores={stores ?? []} />
        )}
        {currentPage === "inventory" && (
          <InventoryPage selectedStoreId={selectedStoreId} stores={stores ?? []} isManager={isManager} />
        )}
        {currentPage === "analytics" && (
          <AnalyticsPage selectedStoreId={selectedStoreId} stores={stores ?? []} />
        )}
        {currentPage === "customers" && (
          <CustomersPage selectedStoreId={selectedStoreId} stores={stores ?? []} />
        )}
        {currentPage === "purchase-orders" && (
          <PurchaseOrdersPage selectedStoreId={selectedStoreId} stores={stores ?? []} isManager={isManager} />
        )}
        {currentPage === "returns" && (
          <ReturnsPage selectedStoreId={selectedStoreId} stores={stores ?? []} isManager={isManager} />
        )}
        {currentPage === "shifts" && (
          <ShiftsPage selectedStoreId={selectedStoreId} stores={stores ?? []} isManager={isManager} />
        )}
        {currentPage === "stores" && isManager && <StoresPage />}
        {currentPage === "roles" && isManager && <UserRolesPage stores={stores ?? []} />}
        {currentPage === "catalog" && <CatalogSearchPage />}
        {currentPage === "import" && (
          <ProductImportPage
            selectedStoreId={selectedStoreId}
            stores={stores ?? []}
            isManager={isManager}
          />
        )}
        {currentPage === "salesmen" && isManager && (
          <SalesmenPage
            selectedStoreId={selectedStoreId}
            stores={stores ?? []}
            isManager={isManager}
          />
        )}
        {currentPage === "warehouses" && isManager && (
          <WarehousesPage
            selectedStoreId={selectedStoreId}
            stores={stores ?? []}
            isManager={isManager}
          />
        )}
        {currentPage === "fulfillment" && (
          <FulfillmentPage
            selectedStoreId={selectedStoreId}
            stores={stores ?? []}
            isManager={isManager}
          />
        )}
        {currentPage === "cheques" && (
          <ChequesPage
            selectedStoreId={selectedStoreId}
            stores={stores ?? []}
            isManager={isManager}
          />
        )}
        {currentPage === "bulk-photos" && isManager && <BulkPhotoUploadPage />}
        {(currentPage === "stores" || currentPage === "roles" || currentPage === "salesmen" || currentPage === "warehouses") && !isManager && (
          <AccessDenied />
        )}
      </main>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V9m0 0V7m0 2h2m-2 0H10" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Access Denied</h2>
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    </div>
  );
}
