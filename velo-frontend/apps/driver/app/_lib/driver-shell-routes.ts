const PUBLIC_ROUTES = ["/login", "/register"];

export function isPublicDriverRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function shouldPublishIdleDriverLocation(pathname: string): boolean {
  return pathname !== "/" && !/^\/ride\/[^/]+$/.test(pathname) && !isPublicDriverRoute(pathname);
}
