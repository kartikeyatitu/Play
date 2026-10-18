"use client";

import * as React from "react";
import { Toaster } from "sonner";

/** Sonner toasts that follow the app theme (light / dark) instead of always rendering dark. */
export function ThemedToaster() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  React.useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    read();
    window.addEventListener("triq:theme", read);
    return () => window.removeEventListener("triq:theme", read);
  }, []);
  return <Toaster theme={theme} position="top-right" richColors />;
}
