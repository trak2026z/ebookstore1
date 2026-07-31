// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type {
  AdminUserListItem,
  AdminUserListResponse,
  AuthUserResponse,
  LoginRequest,
  LoginResponse,
  PublicBookDetailsResponse,
  PublicBookListItem,
  PublicBookListResponse,
} from "@ebookstore/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App, { type AppCatalogApi } from "./App";
import type { AdminUsersApi } from "./api/admin-users-api";
import type { RegistrationApi } from "./auth/RegisterPage";

const bookListItem: PublicBookListItem = {
  id: "book-1",
  slug: "typescript-bez-tajemnic",
  title: "TypeScript bez tajemnic",
  authors: [
    {
      id: "author-1",
      displayName: "Ada Lovelace",
      slug: "ada-lovelace",
    },
  ],
  categories: [
    {
      id: "category-1",
      name: "Programowanie",
      slug: "programowanie",
    },
  ],
  price: {
    amountMinor: 4_999,
    currency: "PLN",
  },
  format: "EPUB",
  coverUrl: null,
};

const bookDetails: PublicBookDetailsResponse = {
  ...bookListItem,
  isbn: "978-83-00000-00-1",
  description: "Praktyczny przewodnik po TypeScript.",
};

const authUser: AuthUserResponse = {
  id: "user-1",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  createdAt: "2026-07-22T10:00:00.000Z",
};

const loginResponse: LoginResponse = {
  accessToken: "signed.jwt.token",
  tokenType: "Bearer",
  expiresIn: 900,
  user: authUser,
};

function createListResponse(items: readonly PublicBookListItem[]): PublicBookListResponse {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 12,
      totalItems: items.length,
      totalPages: items.length > 0 ? 1 : 0,
    },
  };
}

function createCatalog(): AppCatalogApi {
  return {
    async getBooks() {
      return createListResponse([]);
    },

    async getBook() {
      return bookDetails;
    },
  };
}

function createAdminUsers(
  listUsers: AdminUsersApi["listUsers"],
  getUser: AdminUsersApi["getUser"] = async () => {
    throw new Error("Unexpected getUser request.");
  },
): AdminUsersApi {
  return {
    listUsers,
    getUser,

    async updateUserRole() {
      throw new Error("Unexpected updateUserRole request.");
    },

    async updateUserStatus() {
      throw new Error("Unexpected updateUserStatus request.");
    },
  };
}

function createAuth(user: AuthUserResponse): RegistrationApi {
  return {
    async register() {
      return user;
    },

    async login() {
      return {
        ...loginResponse,
        user,
      };
    },
  };
}

function submitLogin(): void {
  fireEvent.change(screen.getByLabelText("Adres e-mail"), {
    target: {
      value: " user@example.com ",
    },
  });

  fireEvent.change(screen.getByLabelText("Hasło"), {
    target: {
      value: "Correct-Horse-42",
    },
  });

  fireEvent.click(
    screen.getByRole("button", {
      name: "Zaloguj się",
    }),
  );
}

afterEach(() => {
  cleanup();

  window.history.replaceState(null, "", "/");
});

describe("App", () => {
  it("renders the public catalog shell and loads its first page", async () => {
    const requestedPages: number[] = [];

    const catalog: AppCatalogApi = {
      async getBooks(query) {
        requestedPages.push(query.page ?? 1);

        return createListResponse([]);
      },

      async getBook() {
        return bookDetails;
      },
    };

    render(<App catalog={catalog} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Ebookstore",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Publiczny katalog e-booków")).toBeInTheDocument();

    expect(await screen.findByText("Brak książek do wyświetlenia.")).toBeInTheDocument();

    expect(requestedPages).toEqual([1]);
  });

  it("opens a book from the catalog without reloading the application", async () => {
    const requestedSlugs: string[] = [];

    const catalog: AppCatalogApi = {
      async getBooks() {
        return createListResponse([bookListItem]);
      },

      async getBook(slug) {
        requestedSlugs.push(slug);

        return bookDetails;
      },
    };

    render(<App catalog={catalog} />);

    fireEvent.click(
      await screen.findByRole("link", {
        name: bookListItem.title,
      }),
    );

    expect(window.location.pathname).toBe(`/books/${bookListItem.slug}`);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: bookDetails.title,
      }),
    ).toBeInTheDocument();

    expect(requestedSlugs).toEqual([bookListItem.slug]);
  });

  it("renders a direct book URL and returns to the catalog through history", async () => {
    const catalog = createCatalog();

    window.history.replaceState(null, "", `/books/${bookDetails.slug}`);

    render(<App catalog={catalog} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: bookDetails.title,
      }),
    ).toBeInTheDocument();

    window.history.pushState(null, "", "/");

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Ebookstore",
      }),
    ).toBeInTheDocument();
  });

  it("renders the login page from a direct URL", () => {
    const auth: RegistrationApi = {
      async register() {
        return authUser;
      },

      async login() {
        return loginResponse;
      },
    };

    window.history.replaceState(null, "", "/login");

    render(<App catalog={createCatalog()} auth={auth} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Zaloguj się",
      }),
    ).toBeInTheDocument();
  });

  it("blocks an anonymous admin route without calling the API", () => {
    const listUsers = vi.fn<AdminUsersApi["listUsers"]>();

    window.history.replaceState(null, "", "/admin/users");

    render(<App catalog={createCatalog()} adminUsers={createAdminUsers(listUsers)} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Panel administratora wymaga logowania",
      }),
    ).toBeInTheDocument();

    expect(listUsers).not.toHaveBeenCalled();
  });

  it("blocks a regular user without calling the admin API", async () => {
    const listUsers = vi.fn<AdminUsersApi["listUsers"]>();

    window.history.replaceState(null, "", "/login");

    render(
      <App
        catalog={createCatalog()}
        auth={createAuth(authUser)}
        adminUsers={createAdminUsers(listUsers)}
      />,
    );

    submitLogin();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Ebookstore",
      }),
    ).toBeInTheDocument();

    window.history.pushState(null, "", "/admin/users");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Brak dostępu do panelu administratora",
      }),
    ).toBeInTheDocument();

    expect(listUsers).not.toHaveBeenCalled();
  });

  it("lets an administrator open the protected users list", async () => {
    const adminUser: AuthUserResponse = {
      ...authUser,
      email: "admin@example.com",
      role: "ADMIN",
    };

    const response: AdminUserListResponse = {
      items: [
        {
          id: "managed-user",
          email: "managed@example.com",
          displayName: "Managed User",
          role: "USER",
          isActive: true,
          createdAt: "2026-07-22T10:00:00.000Z",
          updatedAt: "2026-07-23T10:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    };

    const listUsers = vi.fn<AdminUsersApi["listUsers"]>().mockResolvedValue(response);

    window.history.replaceState(null, "", "/login");

    render(
      <App
        catalog={createCatalog()}
        auth={createAuth(adminUser)}
        adminUsers={createAdminUsers(listUsers)}
      />,
    );

    submitLogin();

    fireEvent.click(
      await screen.findByRole("link", {
        name: "Użytkownicy",
      }),
    );

    expect(window.location.pathname).toBe("/admin/users");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Użytkownicy",
      }),
    ).toBeInTheDocument();

    expect(await screen.findByText("managed@example.com")).toBeInTheDocument();

    expect(listUsers).toHaveBeenCalledWith("signed.jwt.token", {
      page: 1,
      pageSize: 20,
    });
  });

  it("opens protected user details without reloading the application", async () => {
    const adminUser: AuthUserResponse = {
      ...authUser,
      email: "admin@example.com",
      role: "ADMIN",
    };

    const managedUser: AdminUserListItem = {
      id: "managed-user",
      email: "managed@example.com",
      displayName: "Managed User",
      role: "USER",
      isActive: true,
      createdAt: "2026-07-22T10:00:00.000Z",
      updatedAt: "2026-07-23T10:00:00.000Z",
    };

    const response: AdminUserListResponse = {
      items: [managedUser],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    };

    const listUsers = vi.fn<AdminUsersApi["listUsers"]>().mockResolvedValue(response);
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue(managedUser);

    window.history.replaceState(null, "", "/login");

    render(
      <App
        catalog={createCatalog()}
        auth={createAuth(adminUser)}
        adminUsers={createAdminUsers(listUsers, getUser)}
      />,
    );

    submitLogin();

    fireEvent.click(
      await screen.findByRole("link", {
        name: "Użytkownicy",
      }),
    );

    fireEvent.click(
      await screen.findByRole("link", {
        name: "Szczegóły: managed@example.com",
      }),
    );

    expect(window.location.pathname).toBe("/admin/users/managed-user");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Szczegóły użytkownika",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("managed@example.com")).toBeInTheDocument();

    expect(getUser).toHaveBeenCalledWith("signed.jwt.token", "managed-user");
  });

  it("stores a successful session in memory and returns to the catalog", async () => {
    const requests: LoginRequest[] = [];

    const auth: RegistrationApi = {
      async register() {
        return authUser;
      },

      async login(request) {
        requests.push(request);

        return loginResponse;
      },
    };

    window.history.replaceState(null, "", "/login");

    render(<App catalog={createCatalog()} auth={auth} />);

    fireEvent.change(screen.getByLabelText("Adres e-mail"), {
      target: {
        value: " user@example.com ",
      },
    });

    fireEvent.change(screen.getByLabelText("Hasło"), {
      target: {
        value: "Correct-Horse-42",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Zaloguj się",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Ebookstore",
      }),
    ).toBeInTheDocument();

    expect(window.location.pathname).toBe("/");

    expect(screen.getByLabelText("Zalogowano jako user@example.com")).toHaveTextContent(
      "user@example.com",
    );

    expect(requests).toEqual([
      {
        email: "user@example.com",
        password: "Correct-Horse-42",
      },
    ]);
  });
});
