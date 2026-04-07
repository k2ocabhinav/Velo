import assert from "node:assert/strict";

const FRONTEND_BASE_URL = process.env.VELO_FRONTEND_BASE_URL ?? "http://localhost:3000";
const BACKEND_BASE_URL = process.env.VELO_BACKEND_BASE_URL ?? "http://localhost:8080";
const ADMIN_EMAIL = process.env.VELO_E2E_ADMIN_EMAIL ?? "admin@velo-platform.com";
const ADMIN_PASSWORD = process.env.VELO_E2E_ADMIN_PASSWORD ?? "password123";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestWithRetry(url, init = {}, attempts = 60) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: init.redirect ?? "manual"
      });
      if (response.ok || response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }

    await delay(2000);
  }

  throw lastError ?? new Error(`Unable to reach ${url}`);
}

function extractToken(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (typeof payload.token === "string") {
    return payload.token;
  }

  if (payload.data && typeof payload.data === "object" && typeof payload.data.token === "string") {
    return payload.data.token;
  }

  return null;
}

function splitCombinedSetCookieHeader(headerValue) {
  if (!headerValue) {
    return [];
  }

  if (Array.isArray(headerValue)) {
    return headerValue.flatMap(splitCombinedSetCookieHeader);
  }

  return String(headerValue)
    .split(/,(?=\s*[^;,]+=[^;,]+)/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildCookieHeader(setCookieValues) {
  if (!setCookieValues || setCookieValues.length === 0) {
    return "";
  }

  return setCookieValues
    .map((header) => {
      const match = String(header).match(/^[^=;]+=[^;]+/);
      return match ? match[0] : "";
    })
    .filter(Boolean)
    .join("; ");
}

function getSetCookieValues(response) {
  if (typeof response.headers.getSetCookie === "function") {
    const setCookies = response.headers.getSetCookie();
    if (Array.isArray(setCookies) && setCookies.length > 0) {
      return splitCombinedSetCookieHeader(setCookies);
    }
  }

  return splitCombinedSetCookieHeader(response.headers.get("set-cookie"));
}

async function main() {
  const backendHealth = await requestWithRetry(`${BACKEND_BASE_URL}/actuator/health`);
  assert.equal(backendHealth.status, 200, "Backend health check should respond with 200");

  const publicLoginPage = await requestWithRetry(`${FRONTEND_BASE_URL}/login`);
  assert.equal(publicLoginPage.status, 200, "Login page should be reachable");

  const protectedRedirect = await requestWithRetry(`${FRONTEND_BASE_URL}/`);
  assert.match(
    protectedRedirect.headers.get("location") ?? "",
    /\/login(\?next=.*)?$/,
    "Protected route without a cookie should redirect to login"
  );

  const frontendLogin = await requestWithRetry(`${FRONTEND_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });

  assert.equal(frontendLogin.status, 200, "Frontend login BFF should return 200");
  const frontendPayload = await frontendLogin.json();
  const frontendToken = extractToken(frontendPayload);
  assert.ok(frontendToken, "Frontend login should return a JWT token");

  const setCookieValues = getSetCookieValues(frontendLogin);
  const cookieHeader = buildCookieHeader(setCookieValues);
  assert.match(cookieHeader, /velo_token=/, "Frontend login should set the auth cookie");
  assert.ok(
    setCookieValues.some((cookie) => /HttpOnly/i.test(cookie)),
    "Auth cookie should be HttpOnly"
  );

  const backendLogin = await requestWithRetry(`${BACKEND_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });

  assert.equal(backendLogin.status, 200, "Backend login should return 200");
  const backendPayload = await backendLogin.json();
  const backendToken = extractToken(backendPayload);
  assert.ok(backendToken, "Backend login should return a JWT token");

  const adminStats = await requestWithRetry(`${BACKEND_BASE_URL}/api/v1/admin/stats/dashboard`, {
    headers: {
      Authorization: `Bearer ${frontendToken}`
    }
  });
  assert.equal(adminStats.status, 200, "Backend protected admin endpoint should accept the token");

  const authenticatedHome = await requestWithRetry(`${FRONTEND_BASE_URL}/`, {
    headers: {
      Cookie: cookieHeader
    }
  });
  assert.equal(authenticatedHome.status, 200, "Authenticated admin home should render");

  const authenticatedHtml = await authenticatedHome.text();
  assert.match(authenticatedHtml, /Phase 1 control center|Dashboard/, "Admin page should render expected shell copy");

  console.log("Frontend-backend handshake checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
