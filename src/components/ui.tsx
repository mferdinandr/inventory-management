import type { ComponentProps } from "react";

export const fieldClass =
  "block w-full rounded-lg border border-ink-300 bg-white px-3 py-3 text-base shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30";

export function Label({ children, ...props }: ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor
    <label className="mb-1 block text-sm font-medium text-ink-700" {...props}>
      {children}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input className={fieldClass} {...props} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select className={fieldClass} {...props} />;
}

export function Button({
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-800",
    secondary: "border border-ink-300 bg-white text-ink-800 hover:bg-ink-100",
    danger: "border border-danger-300 bg-white text-danger-700 hover:bg-danger-50",
  }[variant];
  return (
    <button
      className={`min-h-11 rounded-lg px-4 py-2 text-base font-medium disabled:opacity-50 ${styles}`}
      {...props}
    />
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-danger-200 bg-danger-50 text-danger-800"
      : "border-success-200 bg-success-50 text-success-800";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${styles}`}
    >
      {children}
    </p>
  );
}
