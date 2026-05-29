"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import { LogOut, Menu, Settings as SettingsIcon, User, Languages, Coins, Sun, Moon } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useTheme } from "@/hooks/use-theme";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const pageTitles: Record<string, string> = {
  "/dashboard/products": "Product Catalog",
  "/dashboard/orders": "Order Tracking",
  "/dashboard/agents": "AI Agent Configuration",
  "/dashboard": "Dashboard",
  "/inbox": "Inbox",
  "/contacts": "Contacts",
  "/pipelines": "Pipelines",
  "/broadcasts": "Broadcasts",
  "/automations": "Automations",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname.startsWith(path));
  return match ? match[1] : "Dashboard";
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const { theme, toggleTheme, mounted } = useTheme();
  const title = t(getPageTitle(pathname));

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger — mobile only. 44×44 hit target per Apple HIG. */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-base font-semibold text-white sm:text-lg">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none cursor-pointer"
          aria-label="Toggle theme"
        >
          {!mounted ? (
            <div className="h-5 w-5" />
          ) : theme === "dark" ? (
            <Sun className="h-5 w-5 theme-icon-spin" />
          ) : (
            <Moon className="h-5 w-5 theme-icon-spin" />
          )}
        </button>

        {/* Currency selector */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none"
            aria-label="Change currency"
          >
            <Coins className="h-5 w-5" />
            <span className="hidden text-xs font-semibold uppercase sm:inline-block">
              {currency}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-[120px] bg-slate-900 text-slate-100 ring-slate-700"
          >
            <DropdownMenuItem
              onClick={() => setCurrency("XOF")}
              className={`text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer ${currency === "XOF" ? "bg-slate-800 text-white font-medium" : ""}`}
            >
              XOF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setCurrency("USD")}
              className={`text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer ${currency === "USD" ? "bg-slate-800 text-white font-medium" : ""}`}
            >
              Dollar (USD)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setCurrency("EUR")}
              className={`text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer ${currency === "EUR" ? "bg-slate-800 text-white font-medium" : ""}`}
            >
              Euro (EUR)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language selector */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none"
            aria-label="Change language"
          >
            <Languages className="h-5 w-5" />
            <span className="hidden text-xs font-semibold uppercase sm:inline-block">
              {language}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-[120px] bg-slate-900 text-slate-100 ring-slate-700"
          >
            <DropdownMenuItem
              onClick={() => setLanguage("fr")}
              className={`text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer ${language === "fr" ? "bg-slate-800 text-white font-medium" : ""}`}
            >
              Français (FR)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage("en")}
              className={`text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer ${language === "en" ? "bg-slate-800 text-white font-medium" : ""}`}
            >
              English (EN)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-slate-800/70 focus:bg-slate-800/70 focus:outline-none data-popup-open:bg-slate-800/70 sm:gap-3 sm:pl-1 sm:pr-3"
            aria-label="Open account menu"
          >
            <Avatar className="size-8">
              {profile?.avatar_url ? (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={profile.full_name ?? "Avatar"}
                />
              ) : null}
              <AvatarFallback className="bg-violet-500/10 text-sm font-medium text-violet-500">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium text-white sm:inline">
              {profile?.full_name ?? "User"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-56 bg-slate-900 text-slate-100 ring-slate-700"
          >
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium text-white">
                {profile?.full_name ?? "User"}
              </p>
              <p className="truncate text-xs text-slate-400">
                {profile?.email ?? ""}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              render={
                <Link
                  href="/settings?tab=profile"
                  className="text-slate-200 focus:bg-slate-800 focus:text-white"
                />
              }
            >
              <User className="size-4" />
              {t("Profile")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href="/settings?tab=whatsapp"
                  className="text-slate-200 focus:bg-slate-800 focus:text-white"
                />
              }
            >
              <SettingsIcon className="size-4" />
              {t("Settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={signOut}
              className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer"
            >
              <LogOut className="size-4" />
              {t("Sign out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

