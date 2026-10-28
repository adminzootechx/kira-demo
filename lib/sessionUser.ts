/** Fields this app adds to next-auth's session.user, shared by every place
 *  that reads them (proxy.ts, lib/access.ts, API routes, RoleContext).
 *
 * `roleId`/`roleLabel` are a plain designation shown next to the user's
 * name — they carry no access rights. Everything access-related comes from
 * the group (`groupId`/`isSystem`/`scopeOwnData`), except when
 * `permissionMode` is `"manual"`, in which case page access is checked
 * against this user's own permissions instead of the group's. */
export type AppSessionUser = {
  id: string;
  email: string;
  name: string;
  roleId: number;
  roleKey: string;
  roleLabel: string;
  groupId: number;
  groupKey: string;
  groupLabel: string;
  isSystem: boolean;
  scopeOwnData: boolean;
  permissionMode: "inherit" | "manual";
  departmentId: number | null;
  departmentName: string | null;
  marketId: number | null;
  marketName: string | null;
  ownerName: string | null;
  /** ISO timestamp — used for "member since" display. */
  createdAt: string;
};
