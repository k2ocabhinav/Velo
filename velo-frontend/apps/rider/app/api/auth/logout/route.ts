import { performLogoutProxy } from "../../../login/_lib/auth";

export async function POST() {
  return performLogoutProxy();
}
