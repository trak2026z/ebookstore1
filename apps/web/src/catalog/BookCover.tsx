import { useState } from "react";

export type BookCoverVariant = "card" | "details";

export interface BookCoverProps {
  readonly title: string;
  readonly coverUrl: string | null;
  readonly variant: BookCoverVariant;
}

function normalizeCoverUrl(coverUrl: string | null): string | null {
  const normalizedCoverUrl = coverUrl?.trim() ?? "";

  return normalizedCoverUrl ? normalizedCoverUrl : null;
}

export function BookCover({ title, coverUrl, variant }: BookCoverProps) {
  const normalizedCoverUrl = normalizeCoverUrl(coverUrl);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);

  const shouldRenderImage = normalizedCoverUrl !== null && failedCoverUrl !== normalizedCoverUrl;

  const className = `book-cover book-cover--${variant}`;

  if (!shouldRenderImage) {
    return (
      <div
        className={`${className} book-cover--placeholder`}
        role="img"
        aria-label={`Brak okładki książki ${title}`}
      >
        <span aria-hidden="true">Brak okładki</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={normalizedCoverUrl}
      alt={`Okładka książki ${title}`}
      width={320}
      height={480}
      loading={variant === "card" ? "lazy" : "eager"}
      decoding="async"
      onError={() => {
        setFailedCoverUrl(normalizedCoverUrl);
      }}
    />
  );
}
