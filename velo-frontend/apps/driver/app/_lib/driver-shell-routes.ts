const PUBLIC_ROUTES = ["/login", "/register"];

export function isPublicDriverRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
