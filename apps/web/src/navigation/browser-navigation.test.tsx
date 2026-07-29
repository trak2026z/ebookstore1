// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  createBookPath,
  installBrowserNavigation,
  readBrowserRoute,
  type AppRoute,
} from "./browser-navigation";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("browser navigation", () => {
  it("creates encoded book paths and rejects empty slugs", () => {
    expect(createBookPath(" TypeScript i React ")).toBe("/books/TypeScript%20i%20React");

    expect(() => createBookPath("   ")).toThrow(TypeError);
  });

  it("resolves catalog, login, detail and unknown routes", () => {
    expect(readBrowserRoute("/")).toEqual({
      name: "catalog",
    });

    expect(readBrowserRoute("/login/")).toEqual({
      name: "login",
    });

    expect(readBrowserRoute("/books/typescript%20bez%20tajemnic/")).toEqual({
      name: "book-details",
      slug: "typescript bez tajemnic",
    });

    expect(readBrowserRoute("/konto")).toEqual({
      name: "not-found",
    });

    expect(readBrowserRoute("/books/%E0%A4%A")).toEqual({
      name: "not-found",
    });
  });

  it("intercepts application links without reloading", () => {
    const routes: AppRoute[] = [];
    const uninstall = installBrowserNavigation((route) => {
      routes.push(route);
    });

    render(
      <a href="/books/typescript" data-app-link="true">
        TypeScript
      </a>,
    );

    fireEvent.click(
      screen.getByRole("link", {
        name: "TypeScript",
      }),
    );

    expect(window.location.pathname).toBe("/books/typescript");

    expect(routes).toEqual([
      {
        name: "book-details",
        slug: "typescript",
      },
    ]);

    uninstall();
  });

  it("reacts to browser history navigation", () => {
    const routes: AppRoute[] = [];
    const uninstall = installBrowserNavigation((route) => {
      routes.push(route);
    });

    window.history.replaceState(null, "", "/books/react");

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(routes).toEqual([
      {
        name: "book-details",
        slug: "react",
      },
    ]);

    uninstall();
  });
});
