import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all disabled:opacity-50",
          size === "sm" && "px-3 py-1.5 text-sm",
          size === "md" && "px-4 py-2 text-sm",
          size === "lg" && "px-6 py-3 text-base",
          variant === "primary" && "brand-gradient text-white shadow-sm hover:opacity-90",
          variant === "secondary" && "bg-forward-100 text-forward-900 hover:bg-forward-200",
          variant === "ghost" && "text-forward-600 hover:bg-forward-100 hover:text-forward-900",
          variant === "danger" && "bg-red-50 text-red-700 hover:bg-red-100",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
