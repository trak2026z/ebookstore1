// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import { BookCover } from "./BookCover";

afterEach(cleanup);

const title = "TypeScript bez tajemnic";
const coverUrl = "/api/v1/books/book-1/cover";

describe("BookCover", () => {
  it("renders a lazy card image with an accessible description", () => {
    render(
      <BookCover
        title={title}
        coverUrl={coverUrl}
        variant="card"
      />,
    );

    const image = screen.getByRole("img", {
      name: `Okładka książki ${title}`,
    });

    expect(image).toHaveAttribute("src", coverUrl);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
  });

  it("loads the main details image eagerly", () => {
    render(
      <BookCover
        title={title}
        coverUrl={coverUrl}
        variant="details"
      />,
    );

    expect(
      screen.getByRole("img", {
        name: `Okładka książki ${title}`,
      }),
    ).toHaveAttribute("loading", "eager");
  });

  it("renders a placeholder instead of an image for a missing URL", () => {
    render(
      <BookCover
        title={title}
        coverUrl={null}
        variant="card"
      />,
    );

    expect(
      screen.getByRole("img", {
        name: `Brak okładki książki ${title}`,
      }),
    ).toHaveTextContent("Brak okładki");

    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("replaces a failed image and accepts a new URL", () => {
    const { rerender } = render(
      <BookCover
        title={title}
        coverUrl={coverUrl}
        variant="card"
      />,
    );

    fireEvent.error(
      screen.getByRole("img", {
        name: `Okładka książki ${title}`,
      }),
    );

    expect(
      screen.getByRole("img", {
        name: `Brak okładki książki ${title}`,
      }),
    ).toBeInTheDocument();

    const nextCoverUrl = "/api/v1/books/book-2/cover";

    rerender(
      <BookCover
        title={title}
        coverUrl={nextCoverUrl}
        variant="card"
      />,
    );

    expect(
      screen.getByRole("img", {
        name: `Okładka książki ${title}`,
      }),
    ).toHaveAttribute("src", nextCoverUrl);
  });
});
