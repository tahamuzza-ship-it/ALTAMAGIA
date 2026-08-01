import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, Hammer, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import burritoCampo from "@/assets/burrito-campo.jpeg";

export function Sidebar() {
  const [location] = useLocation();

  const routes = [
    { href: "/", label: "Panel", icon: LayoutDashboard },
    { href: "/materiales", label: "Catálogo de Materiales", icon: Hammer },
  ];

  return (
    <aside
      className="w-64 border-r flex-shrink-0 hidden md:flex flex-col relative bg-cover bg-center"
      style={{ backgroundImage: `url(${burritoCampo})` }}
    >
      {/* Velo claro para que el texto se lea sobre la foto */}
      <div className="absolute inset-0 bg-card/35" />
      <div className="relative flex flex-col flex-1">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-serif font-bold text-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            B
          </div>
          BioCasa
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Diseño en Guadua y Tierra
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {routes.map((route) => {
          const isActive =
            route.href === "/"
              ? location === "/"
              : location.startsWith(route.href);
          
          return (
            <Link 
              key={route.href} 
              href={route.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <route.icon className="w-5 h-5" />
              {route.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t text-xs text-muted-foreground text-center">
        BioCasa Studio v1.0
      </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  return (
    <div className="md:hidden flex items-center justify-between p-4 border-b bg-card">
      <h1 className="text-xl font-serif font-bold text-primary flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs">
          B
        </div>
        BioCasa
      </h1>
      <Button variant="ghost" size="icon">
        <Menu className="w-5 h-5" />
      </Button>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <MobileNav />
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
