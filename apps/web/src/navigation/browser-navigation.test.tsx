// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  createAdminUserPath,
  createAdminUsersPath,
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
  it("creates encoded application paths and rejects invalid input", () => {
    expect(createBookPath(" TypeScript i React ")).toBe("/books/TypeScript%20i%20React");
    expect(createAdminUsersPath(1)).toBe("/admin/users");
    expect(createAdminUsersPath(3)).toBe("/admin/users?page=3");
    expect(createAdminUserPath(" user/id ", 2)).toBe("/admin/users/user%2Fid?page=2");

    expect(() => createBookPath("   ")).toThrow(TypeError);
    expect(() => createAdminUsersPath(0)).toThrow(TypeError);
    expect(() => createAdminUserPath("   ")).toThrow(TypeError);
  });

  it("resolves public, authentication, profile, admin, detail and unknown routes", () => {
    expect(readBrowserRoute("/")).toEqual({
      name: "catalog",
    });
    expect(readBrowserRoute("/login/")).toEqual({
      name: "login",
    });
    expect(readBrowserRoute("/register/")).toEqual({
      name: "register",
    });
    expect(readBrowserRoute("/profile/")).toEqual({
      name: "profile",
    });
    expect(readBrowserRoute("/admin/users/", "?page=2")).toEqual({
      name: "admin-users",
      page: 2,
    });
    expect(readBrowserRoute("/admin/users/", "?page=invalid")).toEqual({
      name: "admin-users",
      page: 1,
    });
    expect(readBrowserRoute("/admin/users/user%2Fid", "?page=3")).toEqual({
      name: "admin-user-details",
      userId: "user/id",
      returnPage: 3,
    });
    expect(readBrowserRoute("/books/typescript%20bez%20tajemnic/")).toEqual({
      name: "book-details",
      slug: "typescript bez tajemnic",
    });
    expect(readBrowserRoute("/konto")).toEqual({
      name: "not-found",
    });
    expect(readBrowserRoute("/admin/users/%E0%A4%A")).toEqual({
      name: "not-found",
    });
    expect(readBrowserRoute("/books/%E0%A4%A")).toEqual({
      name: "not-found",
    });
  });

  it("intercepts application links with search parameters without reloading", () => {
    const routes: AppRoute[] = [];
    const uninstall = installBrowserNavigation((route) => {
      routes.push(route);
    });

    render(
      <a href="/admin/users/user-id?page=2" data-app-link="true">
        Szczegóły
      </a>,
    );

    fireEvent.click(
      screen.getByRole("link", {
        name: "Szczegóły",
      }),
    );

    expect(window.location.pathname).toBe("/admin/users/user-id");
    expect(window.location.search).toBe("?page=2");
    expect(routes).toEqual([
      {
        name: "admin-user-details",
        userId: "user-id",
        returnPage: 2,
      },
    ]);

    uninstall();
  });

  it("reacts to browser history navigation", () => {
    const routes: AppRoute[] = [];
    const uninstall = installBrowserNavigation((route) => {
      routes.push(route);
    });

    window.history.replaceState(null, "", "/admin/users?page=4");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(routes).toEqual([
      {
        name: "admin-users",
        page: 4,
      },
    ]);

    uninstall();
  });
});
