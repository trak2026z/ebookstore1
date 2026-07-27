// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the public catalog foundation", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Ebookstore" })).toBeInTheDocument();
    expect(screen.getByText("Publiczny katalog e-booków")).toBeInTheDocument();
    expect(screen.getByText("Gotowość na klienta API")).toBeInTheDocument();
  });
});
