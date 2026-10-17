import type { SVGProps } from "react";

function Icon({ paths, ...props }: SVGProps<SVGSVGElement> & { paths: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths}
    </svg>
  );
}

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M4 3h7v7H4zM9 9h4v4H9zM13 3h7v7h-7zM4 14h7v7H4z" opacity="0.55" />
      <path d="M14 13h6v6h-6z" opacity="0.55" />
      <path d="M9 14h4v4H9zM3 12h2v2H3zM19 12h2v2h-2zM12 3h2v2h-2z" opacity="0.9" />
    </svg>
  );
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon
      paths={
        <>
          <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
          <path d="M4.5 20.25a7.5 7.5 0 0 1 15 0" />
        </>
      }
      {...props}
    />
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon
      paths={
        <>
          <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75" />
          <path d="M21 11.25a.75.75 0 0 0-.75-.75H3.75a.75.75 0 0 0-.75.75v7.5c0 .414.336.75.75.75h16.5a.75.75 0 0 0 .75-.75v-7.5Z" />
        </>
      }
      {...props}
    />
  );
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon
      paths={
        <>
          <path d="M2.036 12.322a1 1 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </>
      }
      {...props}
    />
  );
}

export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon
      paths={
        <path d="M3.98 8.223A10.5 10.5 0 0 0 2.036 11.683a1 1 0 0 0 0 .639C3.423 16.49 7.361 19.5 12 19.5c.983 0 1.934-.14 2.83-.41M5.229 5.23A10.67 10.67 0 0 1 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639a10.46 10.46 0 0 1-2.03 3.16M5.229 5.23 3 3M5.229 5.23l3.54 3.54M9.632 9.632A3.75 3.75 0 0 0 14.368 14.368M14.368 14.368 21 21" />
      }
      {...props}
    />
  );
}
