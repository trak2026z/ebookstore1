export interface HealthResponse {
  readonly status: "ok";
}

export interface ReadinessResponse {
  readonly status: "ready";
  readonly checks: {
    readonly database: "ok";
  };
}

export interface BookReference {
  readonly name: string;
  readonly slug: string;
}

export interface AuthorListItem {
  readonly name: string;
  readonly slug: string;
}

export interface AuthorListResponse {
  readonly items: readonly AuthorListItem[];
}

export interface CategoryListItem {
  readonly name: string;
  readonly slug: string;
}

export interface CategoryListResponse {
  readonly items: readonly CategoryListItem[];
}

export type PublicBookFormat = "PDF" | "EPUB";

export interface PublicBookPrice {
  readonly amountMinor: number;
  readonly currency: string;
}

export interface PublicBookAuthor {
  readonly id: string;
  readonly displayName: string;
  readonly slug: string;
}

export interface PublicBookCategory {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface PublicBookListItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly authors: readonly PublicBookAuthor[];
  readonly categories: readonly PublicBookCategory[];
  readonly price: PublicBookPrice;
  readonly format: PublicBookFormat;
  readonly coverUrl: string | null;
}

export interface PublicBookDetailsResponse extends PublicBookListItem {
  readonly isbn: string;
  readonly description: string;
}

export interface PublicBookListResponse {
  readonly items: readonly PublicBookListItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

/** @deprecated Use PublicBookListItem for the Sprint 12 public API. */
export interface BookListItem {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly priceCents: number;
  readonly coverUrl: string | null;
  readonly author: BookReference;
  readonly category: BookReference;
}

/** @deprecated Use PublicBookDetailsResponse for the Sprint 12 public API. */
export interface BookDetailsResponse extends BookListItem {
  readonly description: string;
  readonly publishedAt: string | null;
}

/** @deprecated Use PublicBookListResponse for the Sprint 12 public API. */
export interface BookListResponse {
  readonly items: readonly BookListItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export type AdminUserRole = "USER" | "ADMIN";

export interface AdminUserListItem {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: AdminUserRole;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminUserListResponse {
  readonly items: readonly AdminUserListItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface UpdateAdminUserRoleRequest {
  readonly role: AdminUserRole;
}

export interface UpdateAdminUserStatusRequest {
  readonly isActive: boolean;
}
