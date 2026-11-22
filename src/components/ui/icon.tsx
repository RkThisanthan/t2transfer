/* eslint-disable @next/next/no-img-element */

// Static SVG icons exported from Figma live in /public/icons. Each SVG carries its own
// width/height, so the wrapper only reserves the slot size used in the design.
export type IconName =
  | "route" | "user-round" | "eye" | "eye-off" | "arrow-right" | "shield-check" | "shield-check-16"
  | "log-out" | "list-checks" | "sliders-horizontal" | "calendar-days" | "search" | "search-white"
  | "chevron-up" | "plane-landing" | "plane-takeoff" | "map-pin" | "external-link" | "pencil"
  | "message-circle" | "trash-2";

type IconProps = { name: IconName; size: number; className?: string };

export function Icon({ name, size, className }: IconProps) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`} style={{ width: size, height: size }}>
      <img src={`/icons/${name}.svg`} alt="" width={size} height={size} draggable={false} />
    </span>
  );
}

/**
 * Same Figma SVG used as a mask, so it takes the text colour (currentColor).
 * Used where one icon appears in several colours, e.g. active vs inactive navigation.
 */
export function MaskIcon({ src, size, className }: { src: string; size: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className ?? ""}`}
      style={{ width: size, height: size, mask: `url(${src}) center / contain no-repeat`, WebkitMask: `url(${src}) center / contain no-repeat` }}
    />
  );
}
