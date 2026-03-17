"use client";
import { useState } from "react";
// import { Await, Link, useLocation, useNavigate } from "react-router-dom";
import Link from "next/link";
import { useRouter,usePathname } from "next/navigation";
import { useAuthStore } from "../store/authStore";
//  import { useCartStore } from "../store/cartStore";
import { useCartStore } from "@/admin_new/src/store/cartStore";
import { useThemeStore } from "../store/themeStore";
// import { useAuthStore } from "@/store/authStore";
// import { UseBoundStore } from ""
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ShoppingCart, UtensilsCrossed, Menu, Moon, Sun, Heart, Trophy, LogOut, User, Search } from "lucide-react";
import { CartDrawer } from "./CartDrawer";
import { ShoppingBag } from "lucide-react";
import CartPage from "./CartPage";
import { ChatSupport, ChatButton } from "./ChatSupport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
}


export function Layout_comp({ children }: LayoutProps) {
  const [cartOpen, setCartOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  // const location = useLocation();
  // const navigate = useNavigate();
  // const navigate = useRouter().push;
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const getCartCount = useCartStore((state) => state.getCartCount);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const cartCount = getCartCount();

const handleLogout = async() => {
//  const onSubmit = async
   try {
  await logout();
  router.push("/login");
  } catch (err: any) {
    console.log(err);
    
  }
};
  return (
    <div className="size-full min-h-screen bg-accent/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <UtensilsCrossed className="h-8 w-8 text-primary" />
            <h2>Delicious Bites</h2>
          </Link>

          <div className="flex items-center gap-4">
            {/* Desktop Menu */}
            <nav className="hidden md:flex items-center gap-2">
              <Button
                variant={pathname === "/" ? "default" : "ghost"}
                asChild
              >
                <Link href="/">Home</Link>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={pathname.includes("/recipes") ? "default" : "ghost"}
                  >
                    Recipes
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link href="/recipes">Browse Recipes</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/recipes/suggestions">Recipe Suggestions</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                variant={pathname === "/search" ? "default" : "ghost"}
                className="gap-2"
                asChild
              >
                <Link href="/search">
                  <Search className="h-4 w-4" />
                  <span className="hidden lg:inline">Search</span>
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={pathname.includes("/reviews") ? "default" : "ghost"}
                  >
                    Reviews
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem asChild>
                    <Link href="/search">Search</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reviews">All Reviews</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reviews/my-reviews">My Reviews</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                variant={pathname === "/orders" ? "default" : "ghost"}
                asChild
              >
                <Link href="/orders">Orders</Link>
              </Button>
              
              <Button
                variant={pathname === "/favorites" ? "default" : "ghost"}
                className="gap-2"
                asChild
              >
                <Link href="/favorites">
                  <Heart className="h-4 w-4" />
                  <span className="hidden lg:inline">Favorites</span>
                </Link>
              </Button>
              
              <Button
                variant={pathname === "/loyalty" ? "default" : "ghost"}
                className="gap-2"
                asChild
              >
                <Link href="/loyalty">
                  <Trophy className="h-4 w-4" />
                  <span className="hidden lg:inline">Rewards</span>
                </Link>
              </Button>

              {!user?.isAdmin && (
                <Button
                  variant={pathname === "/admin" ? "default" : "ghost"}
                  asChild
                >
                  <Link href="/admin">Admin</Link>
                </Button>
              )}
            </nav>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/">Home</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/recipes">Browse Recipes</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/recipes/suggestions">Recipe Suggestions</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/search">Search</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reviews">All Reviews</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/reviews/my-reviews">My Reviews</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/orders">Orders</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/favorites">Favorites</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/loyalty">Rewards</Link>
                  </DropdownMenuItem>
                  {!user?.isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin">Admin Dashboard</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5">
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="relative"
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>

            {/* Cart Button */}
            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 py-8">{children}</main>

      {/* Cart Drawer */}
      <CartDrawer
      // onClick(navigate('/cart'));
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          router.push("/checkout");
        }}
      />
      {/* <Button>take it light  </Button>
      <Button
  onClick={() => navigate("/cart")}
  variant="ghost"
  className="flex items-center gap-2"
>
  <ShoppingBag className="h-5 w-5" />
  View Cart
</Button> */}


      {/* Chat Support */}
      {!chatOpen && <ChatButton onClick={() => setChatOpen(true)} />}
      {chatOpen && <ChatSupport isOpen={chatOpen} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
