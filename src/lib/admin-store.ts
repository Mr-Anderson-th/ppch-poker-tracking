// Client-side admin unlock state (session only).
import { useEffect, useState } from "react";

const KEY = "ppch_admin_pw";

export function getAdminPassword(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function setAdminPassword(pw: string | null) {
  if (typeof window === "undefined") return;
  if (pw) sessionStorage.setItem(KEY, pw);
  else sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("admin-pw-change"));
}

export function useAdminUnlocked() {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    const update = () => setUnlocked(!!getAdminPassword());
    update();
    window.addEventListener("admin-pw-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("admin-pw-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return unlocked;
}
