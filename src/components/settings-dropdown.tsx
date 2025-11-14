"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Shield, Sun, Moon } from "lucide-react";

import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useTheme } from "@/contexts/theme-context";
import { useIsConfigAdmin } from "@/hooks/use-is-config-admin";
import { cn } from "@/lib/utils";

export function SettingsDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const { isConfigAdmin } = useIsConfigAdmin();
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handleThemeChange = (nextTheme: "light" | "dark") => {
    setTheme(nextTheme);
    setOpen(false);
  };

  const handleAdminPanel = () => {
    router.push("/dashboard/admin");
    setOpen(false);
  };

  const toggleDropdown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen((prev) => !prev);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <SidebarMenuButton
        tooltip="Configurações"
        aria-haspopup="menu"
        aria-expanded={open}
        type="button"
        onClick={toggleDropdown}
      >
        <Settings />
        <span>Configurações</span>
      </SidebarMenuButton>

      {open && (
        <div className="settings-menu" role="menu">
          <p className="settings-menu__header">Tema</p>
          <div className="settings-menu__group" role="none">
            <button
              type="button"
              className={cn(
                "settings-menu__item",
                theme === "light" && "settings-menu__item--active"
              )}
              onClick={() => handleThemeChange("light")}
              role="menuitemradio"
              aria-checked={theme === "light"}
            >
              <Sun className="h-4 w-4" />
              <span>Claro</span>
            </button>
            <button
              type="button"
              className={cn(
                "settings-menu__item",
                theme === "dark" && "settings-menu__item--active"
              )}
              onClick={() => handleThemeChange("dark")}
              role="menuitemradio"
              aria-checked={theme === "dark"}
            >
              <Moon className="h-4 w-4" />
              <span>Escuro</span>
            </button>
          </div>

          {isConfigAdmin && (
            <>
              <div className="settings-menu__divider" role="separator" />
              <button
                type="button"
                className="settings-menu__item"
                onClick={handleAdminPanel}
                role="menuitem"
              >
                <Shield className="h-4 w-4" />
                <span>Painel do Admin</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

