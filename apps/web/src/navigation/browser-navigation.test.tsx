// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  createAdminUserPath,
  createAdminUsersPath,
  createBookPath,
  EMPTY_ADMIN_USERS_QUERY,
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
    expect(createAdminUsersPath()).toBe("/admin/users");
    expect(
      createAdminUsersPath({
        page: 3,
        query: " Tomasz Rak ",
        role: "USER",
        status: "inactive",
      }),
    ).toBe("/admin/users?page=3&query=Tomasz+Rak&role=USER&status=inactive");
    expect(
      createAdminUserPath(" user/id ", {
        page: 2,
        query: "tomasz",
        role: "ADMIN",
        status: "active",
      }),
    ).toBe("/admin/users/user%2Fid?page=2&query=tomasz&role=ADMIN&status=active");

    expect(() => createBookPath("   ")).toThrow(TypeError);
    expect(() =>
      createAdminUsersPath({
        ...EMPTY_ADMIN_USERS_QUERY,
        page: 0,
      }),
    ).toThrow(TypeError);
    expect(() => createAdminUserPath("   ")).toThrow(TypeError);
  });

  it("resolves admin list and details filters from direct URLs", () => {
    const filters = {
      page: 2,
      query: "Tomasz Rak",
      role: "USER",
      status: "inactive",
    } as const;

    expect(
      readBrowserRoute(
        "/admin/users/",
        "?page=2&query=%20Tomasz%20Rak%20&role=USER&status=inactive",
      ),
    ).toEqual({
      name: "admin-users",
      query: filters,
    });

    expect(
      readBrowserRoute(
        "/admin/users/user%2Fid",
        "?page=2&query=Tomasz+Rak&role=USER&status=inactive",
      ),
    ).toEqual({
      name: "admin-user-details",
      userId: "user/id",
      returnQuery: filters,
    });
  });

  it("falls back safely for invalid pagination and filter values", () => {
    expect(readBrowserRoute("/admin/users/", "?page=invalid&role=OWNER&status=disabled")).toEqual({
      name: "admin-users",
      query: EMPTY_ADMIN_USERS_QUERY,
    });
  });

  it("resolves public, authentication, profile and unknown routes", () => {
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

  it("intercepts filtered application links without reloading", () => {
    const routes: AppRoute[] = [];
    const uninstall = installBrowserNavigation((route) => {
      routes.push(route);
    });

    render(
      <a
        href="/admin/users/user-id?page=2&query=tomasz&role=USER&status=active"
        data-app-link="true"
      >
        Szczegóły
      </a>,
    );

    fireEvent.click(
      screen.getByRole("link", {
        name: "Szczegóły",
      }),
    );

    expect(window.location.pathname).toBe("/admin/users/user-id");
    expect(window.location.search).toBe("?page=2&query=tomasz&role=USER&status=active");
    expect(routes).toEqual([
      {
        name: "admin-user-details",
        userId: "user-id",
        returnQuery: {
          page: 2,
          query: "tomasz",
          role: "USER",
          status: "active",
        },
      },
    ]);

    uninstall();
  });

  it("reacts to browser history navigation", () => {
    const routes: AppRoute[] = [];
    const uninstall = installBrowserNavigation((route) => {
      routes.push(route);
    });

    window.history.replaceState(null, "", "/admin/users?page=4&role=ADMIN");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(routes).toEqual([
      {
        name: "admin-users",
        query: {
          page: 4,
          query: "",
          role: "ADMIN",
          status: "",
        },
      },
    ]);

    uninstall();
  });
});
