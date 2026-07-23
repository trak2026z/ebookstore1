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

export interface BookListItem {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly priceCents: number;
  readonly coverUrl: string | null;
  readonly author: BookReference;
  readonly category: BookReference;
}

export interface BookDetailsResponse extends BookListItem {
  readonly description: string;
  readonly publishedAt: string | null;
}

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
