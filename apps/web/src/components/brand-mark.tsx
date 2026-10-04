type BrandMarkProps = {
  className: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg className={className} viewBox="0 0 36 36" aria-hidden="true">
      <path d="M4 10h7c6 0 6 8 12 8h9" />
      <path d="M4 26h7c6 0 6-8 12-8" />
      <circle cx="4" cy="10" r="2" />
      <circle cx="4" cy="26" r="2" />
      <circle cx="32" cy="18" r="2" />
    </svg>
  );
}
