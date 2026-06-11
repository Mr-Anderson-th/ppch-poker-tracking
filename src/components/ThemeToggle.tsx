import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ size = "icon" }: { size?: "icon" | "sm" }) {
  const { theme, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size={size === "icon" ? "icon" : "sm"}
      onClick={toggle}
      className="btn-glow relative overflow-hidden"
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
    >
      <Sun className={`size-[18px] transition-all duration-300 ${theme === "dark" ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`} />
      <Moon className={`absolute size-[18px] transition-all duration-300 ${theme === "dark" ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0"}`} />
    </Button>
  );
}
