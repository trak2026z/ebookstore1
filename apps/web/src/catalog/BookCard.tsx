import type { PublicBookListItem } from "@ebookstore/contracts";
import { useId } from "react";

import { formatPrice } from "./format-price";

export interface BookCardProps {
  readonly book: PublicBookListItem;
}

function joinNames(names: readonly string[], emptyLabel: string): string {
  return names.length > 0 ? names.join(", ") : emptyLabel;
}

export function BookCard({ book }: BookCardProps) {
  const titleId = useId();
  const authors = joinNames(
    book.authors.map((author) => author.displayName),
    "Autor nieznany",
  );
  const categories = joinNames(
    book.categories.map((category) => category.name),
    "Bez kategorii",
  );
  const formattedPrice = formatPrice(book.price);

  return (
    <article className="book-card" aria-labelledby={titleId}>
      <div className="book-card__heading">
        <h2 id={titleId}>{book.title}</h2>
        <span className="book-card__format">{book.format}</span>
      </div>

      <dl className="book-card__metadata">
        <div>
          <dt>Autorzy</dt>
          <dd>{authors}</dd>
        </div>
        <div>
          <dt>Kategorie</dt>
          <dd>{categories}</dd>
        </div>
      </dl>

      <p className="book-card__price" aria-label={`Cena: ${formattedPrice}`}>
        {formattedPrice}
      </p>
    </article>
  );
}
