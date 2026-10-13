import type { ComponentProps } from "react";

const field =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

export function Label({ children, ...props }: ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor
    <label className="mb-1 block text-sm font-medium text-slate-700" {...props}>
      {children}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input className={field} {...props} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select className={field} {...props} />;
}

export function Button({
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-teal-700 text-white hover:bg-teal-800",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
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
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${styles}`}
    >
      {children}
    </p>
  );
}
