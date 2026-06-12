import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}

export function Button({ variant = "primary", loading = false, children, className = "", ...props }: ButtonProps) {
  // TODO: implement styled button with variant classes and loading spinner
  return (
    <button {...props} className={className} disabled={loading || props.disabled}>
      {children}
    </button>
  );
}
