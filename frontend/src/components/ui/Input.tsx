import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  // TODO: implement styled input with optional label and error message
  return (
    <div>
      {label && <label>{label}</label>}
      <input {...props} className={className} />
      {error && <span>{error}</span>}
    </div>
  );
}
