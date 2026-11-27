import type { SVGProps } from "react";

/** One outline set, 1.5px stroke, drawn in currentColor. Shapes follow Lucide (ISC). */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.25" />
    <path d="M12 7.5v5.25" />
    <path d="M12 16.25h.01" strokeWidth={2.25} />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.25" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.75" y="10.75" width="14.5" height="10" rx="2" />
    <path d="M8 10.75V7.5a4 4 0 0 1 8 0v3.25" />
  </Icon>
);

export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </Icon>
);

export const OfflineIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19.5h.01" strokeWidth={2.25} />
    <path d="M8.5 16a5 5 0 0 1 7 0" />
    <path d="M5 12.5a10 10 0 0 1 4.2-2.4" />
    <path d="M19 12.5a10 10 0 0 0-2.1-1.6" />
    <path d="M2 9a15 15 0 0 1 4.5-2.8" />
    <path d="M22 9a15 15 0 0 0-9.6-3.9" />
    <path d="m3 3 18 18" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.25" />
    <path d="m8.25 12.25 2.5 2.5 5-5.25" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5" />
    <path d="m11 18-6-6 6-6" />
  </Icon>
);

/** Branching paths: one start, three outcomes. The empty state's mark. */
export const PathsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="4.5" cy="12" r="1.75" />
    <circle cx="19.5" cy="5" r="1.75" />
    <circle cx="19.5" cy="12" r="1.75" />
    <circle cx="19.5" cy="19" r="1.75" />
    <path d="M6.25 12h11.5" />
    <path d="M6.25 12c5 0 6-7 11.5-7" />
    <path d="M6.25 12c5 0 6 7 11.5 7" />
  </Icon>
);

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="animate-spin motion-reduce:[animation-duration:2.4s]">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
