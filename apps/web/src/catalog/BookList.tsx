import type { PublicBookListItem } from "@ebookstore/contracts";

import { BookCard } from "./BookCard";

export interface BookListProps {
  readonly books: readonly PublicBookListItem[];
}

export function BookList({ books }: BookListProps) {
  if (books.length === 0) {
    return (
      <p className="book-list-empty" role="status">
        Brak książek do wyświetlenia.
      </p>
    );
  }

  return (
    <ul className="book-list" aria-label="Książki">
      {books.map((book) => (
        <li key={book.id}>
          <BookCard book={book} />
        </li>
      ))}
    </ul>
  );
}
