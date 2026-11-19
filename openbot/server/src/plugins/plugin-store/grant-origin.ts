export const PACKAGE_GRANT = "tenant-package";
export const PACKAGE_GRANT_REVOKED = "tenant-package:revoked";

export function isPackageGrantRevoked(grantedBy: string | null): boolean {
  return grantedBy === PACKAGE_GRANT_REVOKED;
}
