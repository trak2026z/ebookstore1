// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { CatalogFilters, EMPTY_CATALOG_FILTERS, type CatalogFilterValues } from "./CatalogFilters";

afterEach(cleanup);

function CatalogFiltersHarness({
  onApply,
  onClear,
}: {
  readonly onApply: (values: CatalogFilterValues) => void;
  readonly onClear: () => void;
}) {
  const [values, setValues] = useState(EMPTY_CATALOG_FILTERS);

  return (
    <CatalogFilters
      values={values}
      authors={[
        {
          name: "Ada Lovelace",
          slug: "ada-lovelace",
        },
      ]}
      categories={[
        {
          name: "Programowanie",
          slug: "programowanie",
        },
      ]}
      optionsLoading={false}
      optionsWarning={null}
      onChange={setValues}
      onApply={() => {
        onApply(values);
      }}
      onClear={() => {
        setValues({ ...EMPTY_CATALOG_FILTERS });
        onClear();
      }}
    />
  );
}

describe("CatalogFilters", () => {
  it("collects search, filters and sorting before applying", () => {
    const appliedValues: CatalogFilterValues[] = [];

    render(
      <CatalogFiltersHarness
        onApply={(values) => {
          appliedValues.push(values);
        }}
        onClear={() => undefined}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Szukaj" }), {
      target: { value: "  TypeScript  " },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Kategoria" }), {
      target: { value: "programowanie" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Autor" }), {
      target: { value: "ada-lovelace" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Sortuj według" }), {
      target: { value: "price" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Kierunek" }), {
      target: { value: "asc" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Zastosuj" }));

    expect(appliedValues).toEqual([
      {
        query: "  TypeScript  ",
        category: "programowanie",
        author: "ada-lovelace",
        sortBy: "price",
        sortOrder: "asc",
      },
    ]);
  });

  it("clears visible values without submitting the form", () => {
    let clearCount = 0;

    render(
      <CatalogFiltersHarness
        onApply={() => undefined}
        onClear={() => {
          clearCount += 1;
        }}
      />,
    );

    const searchInput = screen.getByRole("searchbox", {
      name: "Szukaj",
    });
    fireEvent.change(searchInput, {
      target: { value: "React" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Wyczyść" }));

    expect(searchInput).toHaveValue("");
    expect(clearCount).toBe(1);
  });
});
