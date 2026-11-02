"use client";

import { Boxes, LogOut, Monitor, Moon, Palette, Settings, Sun, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { OfflineBanner, ConnectionIndicator } from "@/components/connectivity/connectivity";
import { Confirm } from "@/components/feedback/confirm";
import { useAppearance } from "@/components/providers/appearance-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { FONTS, SCALES, type Appearance, type Font, type Mode, type Scale } from "@/lib/appearance";
import { signOut } from "@/lib/auth-client";
import { THEMES } from "@/lib/theme-tokens";
import type { Permission, Role } from "@/server/authz/catalog";
import { PreferenceSync } from "@/modules/preferences/preference-sync";
import { navFor } from "./nav";

export type ShellUser = {
  name: string;
  email: string;
  image: string | null;
  role: Role;
  officeName: string | null;
  permissions: Permission[];
  preferences: Record<string, unknown> | null;
};

const ROLE_LABEL: Record<Role, string> = { developer: "Developer", admin: "Admin", user: "User" };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function AppSidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Inventory">
              <Link href="/dashboard">
                <span className="brand-mark text-primary-foreground shadow-card flex size-8 shrink-0 items-center justify-center rounded-md">
                  <Boxes className="size-4" aria-hidden />
                </span>
                <span className="font-semibold">Inventory</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navFor(user.permissions).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    {item.href ? (
                      <SidebarMenuButton asChild tooltip={item.label} isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}>
                        <Link href={item.href}>
                          <item.icon aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton disabled tooltip={`${item.label} (coming soon)`}>
                        <item.icon aria-hidden />
                        <span>{item.label}</span>
                        <Badge variant="outline" className="ml-auto text-[0.625rem]">
                          Soon
                        </Badge>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <p className="text-muted-foreground truncate px-2 text-xs group-data-[collapsible=icon]:hidden">
          {user.officeName ?? "All offices"}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

const MODES: { id: Mode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

function AppearanceMenu() {
  const { mode, theme, scale, font, update } = useAppearance();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance">
          <Palette aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[80vh] w-52 overflow-y-auto">
        <DropdownMenuLabel>Mode</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => update({ mode: value as Mode })}>
          {MODES.map((m) => (
            <DropdownMenuRadioItem key={m.id} value={m.id}>
              <m.icon aria-hidden />
              {m.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>UI scale</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={scale} onValueChange={(value) => update({ scale: value as Scale })}>
          {SCALES.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              {s.label}
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">{s.percent}%</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Font</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={font} onValueChange={(value) => update({ font: value as Font })}>
          {FONTS.map((f) => (
            <DropdownMenuRadioItem key={f.id} value={f.id} style={{ fontFamily: f.variable }}>
              {f.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Color theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => update({ theme: value })}>
          {THEMES.map((t) => (
            <DropdownMenuRadioItem key={t.id} value={t.id}>
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  return (
    <>
    <Confirm
      open={confirmingSignOut}
      onOpenChange={setConfirmingSignOut}
      title="Sign out?"
      description="You'll need a new emailed code to sign in again."
      confirmLabel="Sign out"
      onConfirm={() => signOut()}
    />
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
          <Avatar className="size-7">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {ROLE_LABEL[user.role]}
            {user.officeName ? ` · ${user.officeName}` : ""}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User aria-hidden />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setConfirmingSignOut(true)}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <SidebarProvider>
      <PreferenceSync saved={user.preferences as Appearance | null} />
      <a
        href="#main"
        className="bg-background sr-only z-50 rounded-md border p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="bg-background/90 shadow-card sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger aria-label="Toggle sidebar" />
          <div className="ml-auto flex items-center gap-1">
            <ConnectionIndicator />
            <AppearanceMenu />
            <UserMenu user={user} />
          </div>
        </header>
        <OfflineBanner />
        <main id="main" className="app-canvas flex-1 px-4 py-6 md:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
