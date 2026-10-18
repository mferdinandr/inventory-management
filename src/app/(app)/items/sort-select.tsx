"use client";

import type { ComponentProps } from "react";
import { NativeSelect } from "@/components/ui";

/** Submits its GET form as soon as a value is picked, so the list re-sorts instantly. */
export function SortSelect(props: ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect
      {...props}
      onChange={(e) => {
        props.onChange?.(e);
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
