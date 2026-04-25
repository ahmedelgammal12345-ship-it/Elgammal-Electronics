import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { Page } from "../App";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  FileText,
  Store,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Warehouse,
  BarChart2,
  Settings,
  Users,
  BookOpen,
  Truck,
  UserCheck,
  RotateCcw,
  Clock,
  FileUp,
  Camera,
  BadgeCheck,
  PackageCheck,
  MoreHorizontal,
  Landmark,
} from "lucide-react";

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  selectedStoreId: Id<"stores"> | null;
  setSelectedStoreId: (id: Id<"stores"> | null) => void;
  stores: Array<{ _id: Id<"stores">; name: string }>;
  isManager: boolean;
}

const mainNavItems = [
  { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { id: "pos" as Page, label: "POS Terminal", icon: ShoppingCart },
  { id: "catalog" as Page, label: "Catalog Search", icon: BookOpen },
  { id: "products" as Page, label: "Products", icon: Package },
  { id: "sales" as Page, label: "Sales", icon: Receipt },
  { id: "quotations" as Page, label: "Quotations", icon: FileText },
  { id: "inventory" as Page, label: "Inventory", icon: Warehouse },
  { id: "analytics" as Page, label: "Analytics", icon: BarChart2 },
  { id: "customers" as Page, label: "Customers", icon: UserCheck },
  { id: "purchase-orders" as Page, label: "Purchase Orders", icon: Truck },
  { id: "returns" as Page, label: "Returns & Refunds", icon: RotateCcw },
  { id: "shifts" as Page, label: "Shift Management", icon: Clock },
  { id: "cheques" as Page, label: "Cheques", icon: Landmark },
];

const adminNavItems = [
  { id: "stores" as Page, label: "Stores", icon: Store },
  { id: "roles" as Page, label: "User Roles", icon: Users },
  { id: "import" as Page, label: "Product Import", icon: FileUp },
  { id: "bulk-photos" as Page, label: "Bulk Photo Upload", icon: Camera },
  { id: "salesmen" as Page, label: "Salesmen", icon: BadgeCheck },
  { id: "warehouses" as Page, label: "Warehouses", icon: Warehouse },
  { id: "fulfillment" as Page, label: "Fulfillment", icon: PackageCheck },
];

// Bottom nav shows the 4 most important pages on mobile
const mobileBottomNav = [
  { id: "dashboard" as Page, label: "Home", icon: LayoutDashboard },
  { id: "pos" as Page, label: "POS", icon: ShoppingCart },
  { id: "sales" as Page, label: "Sales", icon: Receipt },
  { id: "customers" as Page, label: "Customers", icon: UserCheck },
];

export default function Sidebar({
  currentPage,
  setCurrentPage,
  selectedStoreId,
  setSelectedStoreId,
  stores,
  isManager,
}: SidebarProps) {
  const { signOut } = useAuthActions();
  const [storeOpen, setStoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const selectedStore = stores.find((s) => s._id === selectedStoreId);
  const allNavItems = [...mainNavItems, ...(isManager ? adminNavItems : [])];

  const NavButton = ({ item, onClick }: { item: { id: Page; label: string; icon: React.ElementType }; onClick?: () => void }) => {
    const Icon = item.icon;
    const active = currentPage === item.id;
    return (
      <button
        key={item.id}
        onClick={() => { setCurrentPage(item.id); onClick?.(); }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
          active
            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
            : "text-slate-400 hover:text-white hover:bg-slate-800"
        } ${collapsed ? "justify-center" : ""}`}
        title={collapsed ? item.label : undefined}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
      </button>
    );
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } hidden md:flex transition-all duration-300 bg-slate-900 flex-col h-screen border-r border-slate-800 flex-shrink-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-sm">POS System</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        </div>

        {/* Store Selector */}
        {!collapsed && (
          <div className="p-3 border-b border-slate-800">
            <button
              onClick={() => setStoreOpen(!storeOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-left"
            >
              <Store className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-sm text-slate-200 flex-1 truncate">
                {selectedStore ? selectedStore.name : "All Stores"}
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${storeOpen ? "rotate-180" : ""}`} />
            </button>
            {storeOpen && (
              <div className="mt-1 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                <button
                  onClick={() => { setSelectedStoreId(null); setStoreOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${!selectedStoreId ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700"}`}
                >
                  All Stores
                </button>
                {stores.map((store) => (
                  <button
                    key={store._id}
                    onClick={() => { setSelectedStoreId(store._id); setStoreOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${selectedStoreId === store._id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700"}`}
                  >
                    {store.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {mainNavItems.map((item) => (
            <NavButton key={item.id} item={item} />
          ))}
          {isManager && (
            <>
              {!collapsed && (
                <div className="pt-3 pb-1">
                  <div className="flex items-center gap-2 px-3">
                    <Settings className="w-3 h-3 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</span>
                  </div>
                </div>
              )}
              {collapsed && <div className="border-t border-slate-800 my-2" />}
              {adminNavItems.map((item) => (
                <NavButton key={item.id} item={item} />
              ))}
            </>
          )}
        </nav>

        {/* Sign Out */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => signOut()}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 py-3 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-sm">POS System</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Store selector pill */}
          <button
            onClick={() => setStoreOpen(!storeOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium"
          >
            <Store className="w-3 h-3 text-blue-400" />
            <span className="max-w-24 truncate">{selectedStore ? selectedStore.name : "All Stores"}</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${storeOpen ? "rotate-180" : ""}`} />
          </button>
          {/* Hamburger for full menu */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile store dropdown */}
        {storeOpen && (
          <div className="absolute top-full left-0 right-0 bg-slate-900 border-b border-slate-700 shadow-xl z-50">
            <button
              onClick={() => { setSelectedStoreId(null); setStoreOpen(false); }}
              className={`w-full text-left px-4 py-3 text-sm transition-colors ${!selectedStoreId ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
            >
              All Stores
            </button>
            {stores.map((store) => (
              <button
                key={store._id}
                onClick={() => { setSelectedStoreId(store._id); setStoreOpen(false); }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors border-t border-slate-800 ${selectedStoreId === store._id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
              >
                {store.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── MOBILE FULL MENU DRAWER ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="relative w-72 bg-slate-900 h-full flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-white text-sm">POS System</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              {mainNavItems.map((item) => (
                <NavButton key={item.id} item={item} onClick={() => setMobileMenuOpen(false)} />
              ))}
              {isManager && (
                <>
                  <div className="pt-3 pb-1">
                    <div className="flex items-center gap-2 px-3">
                      <Settings className="w-3 h-3 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</span>
                    </div>
                  </div>
                  {adminNavItems.map((item) => (
                    <NavButton key={item.id} item={item} onClick={() => setMobileMenuOpen(false)} />
                  ))}
                </>
              )}
            </nav>

            <div className="p-3 border-t border-slate-800">
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 flex items-center safe-area-bottom">
        {mobileBottomNav.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
                active ? "text-blue-400" : "text-slate-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
              {active && <span className="absolute bottom-0 w-8 h-0.5 bg-blue-500 rounded-full" />}
            </button>
          );
        })}
        {/* "More" button opens full drawer */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
            !mobileBottomNav.some(n => n.id === currentPage) ? "text-blue-400" : "text-slate-500"
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-xs font-medium">More</span>
        </button>
      </nav>
    </>
  );
}
