export const ADMIN_USER_SORT_FIELDS = [
  "createdAt",
  "email",
  "displayName",
  "role",
  "status",
] as const;

export type AdminUserSortField = (typeof ADMIN_USER_SORT_FIELDS)[number];

export const ADMIN_USER_SORT_ORDERS = ["asc", "desc"] as const;

export type AdminUserSortOrder = (typeof ADMIN_USER_SORT_ORDERS)[number];
