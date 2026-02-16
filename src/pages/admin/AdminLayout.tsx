import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Package, 
  Music, 
  ShoppingCart, 
  Users,
  FolderOpen,
  LogOut,
  ChevronLeft,
  DatabaseBackup,
  LinkIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";

const AdminLayout = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { href: "/admin", label: "Översikt", icon: LayoutDashboard, exact: true },
    { href: "/admin/programs", label: "Produkter", icon: Package },
    { href: "/admin/categories", label: "Kategorier", icon: FolderOpen },
    { href: "/admin/audio", label: "Program", icon: Music },
    { href: "/admin/purchases", label: "Köp", icon: ShoppingCart },
    { href: "/admin/users", label: "Användare", icon: Users },
    { href: "/admin/import", label: "WP Import", icon: DatabaseBackup },
    { href: "/admin/affiliates", label: "Affiliates", icon: LinkIcon },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm">Tillbaka till sidan</span>
          </Link>
        </div>
        
        <div className="p-6">
          <img src={logo} alt="Mentalträning Admin" className="h-12 w-auto" />
          <p className="text-sm text-muted-foreground mt-2">Administration</p>
        </div>

        <nav className="flex-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1",
                isActive(item.href, item.exact)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logga ut
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
