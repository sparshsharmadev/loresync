import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

type BrandProps = {
  className?: string;
  markClassName?: string;
  href?: string;
};

export function Brand({ className = "landing-brand", markClassName = "landing-mark", href = "/" }: BrandProps) {
  return (
    <Link href={href} className={`brand-lockup ${className}`} aria-label="LoreSync home">
      <BrandMark className={`brand-symbol ${markClassName}`} />
      <span className="brand-wordmark">LoreSync</span>
    </Link>
  );
}
