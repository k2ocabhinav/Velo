import assert from "node:assert/strict";

const ADMIN_FRONTEND_BASE_URL =
  process.env.VELO_ADMIN_FRONTEND_BASE_URL ?? process.env.VELO_FRONTEND_BASE_URL ?? "http://localhost:3000";
const RIDER_FRONTEND_BASE_URL = process.env.VELO_RIDER_FRONTEND_BASE_URL ?? "http://localhost:3001";
const DRIVER_FRONTEND_BASE_URL = process.env.VELO_DRIVER_FRONTEND_BASE_URL ?? "http://localhost:3002";
const BACKEND_BASE_URL = process.env.VELO_BACKEND_BASE_URL ?? "http://localhost:8080";

const ADMIN_EMAIL = process.env.VELO_E2E_ADMIN_EMAIL ?? "admin@velo-platform.com";
const ADMIN_PASSWORD = process.env.VELO_E2E_ADMIN_PASSWORD ?? "password123";
const RIDER_EMAIL = process.env.VELO_E2E_RIDER_EMAIL ?? "alice@example.com";
const RIDER_PASSWORD = process.env.VELO_E2E_RIDER_PASSWORD ?? "password123";
const DRIVER_EMAIL = process.env.VELO_E2E_DRIVER_EMAIL ?? "eve.driver@example.com";
const DRIVER_PASSWORD = process.env.VELO_E2E_DRIVER_PASSWORD ?? "password123";

const PROFILE_CONTEXT = (process.env.VELO_PROFILE_CONTEXT ?? "local-dev").toLowerCase();
const EXPECT_OPENAPI_IN_CONTEXT = new Set(["local", "dev", "development", "local-dev"]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestWithRetry(url, init = {}, attempts = 60) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: init.redirect ?? "manual",
      });
      if (response.ok || response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }

    await delay(2_000);
  }

  throw lastError ?? new Error(`Unable to reach ${url}`);
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function unwrapData(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }

  return payload;
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

function extractPageContent(payload) {
  const value = unwrapData(payload);
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value.content)) {
    return value.content;
  }

  if (Array.isArray(value.items)) {
    return value.items;
  }

  return [];
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

function assertAuthCookiePolicy(setCookieValues, appName) {
  assert.ok(
    setCookieValues.some((cookie) => /HttpOnly/i.test(cookie)),
    `${appName} auth cookie should be HttpOnly`,
  );
  assert.ok(
    setCookieValues.some((cookie) => /SameSite=Lax/i.test(cookie)),
    `${appName} auth cookie should enforce SameSite=Lax`,
  );
  assert.ok(
    setCookieValues.some((cookie) => /Secure/i.test(cookie)),
    `${appName} auth cookie should be Secure in production mode`,
  );
}

async function loginViaFrontend({ appName, baseUrl, email, password }) {
  const loginResponse = await requestWithRetry(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(loginResponse.status, 200, `${appName} login BFF should return 200`);
  const payload = await readJsonSafe(loginResponse);
  const token = extractToken(payload);
  assert.ok(token, `${appName} login should return a JWT token`);

  const setCookieValues = getSetCookieValues(loginResponse);
  const cookieHeader = buildCookieHeader(setCookieValues);
  assert.match(cookieHeader, /velo_token=/, `${appName} login should set the auth cookie`);
  assertAuthCookiePolicy(setCookieValues, appName);

  return {
    payload,
    token,
    setCookieValues,
    cookieHeader,
  };
}

async function assertPublicLoginAndProtectedRedirect(baseUrl, appName) {
  const loginPage = await requestWithRetry(`${baseUrl}/login`);
  assert.equal(loginPage.status, 200, `${appName} login page should be reachable`);

  const protectedRedirect = await requestWithRetry(`${baseUrl}/`);
  assert.match(
    protectedRedirect.headers.get("location") ?? "",
    /\/login(\?next=.*)?$/,
    `${appName} protected route without cookie should redirect to login`,
  );
}

async function runAdminFrontendChecks() {
  await assertPublicLoginAndProtectedRedirect(ADMIN_FRONTEND_BASE_URL, "Admin");

  const adminLogin = await loginViaFrontend({
    appName: "Admin",
    baseUrl: ADMIN_FRONTEND_BASE_URL,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  const adminStats = await requestWithRetry(`${BACKEND_BASE_URL}/api/v1/admin/stats/dashboard`, {
    headers: {
      Authorization: `Bearer ${adminLogin.token}`,
    },
  });
  assert.equal(adminStats.status, 200, "Backend protected admin endpoint should accept frontend-issued token");

  const authenticatedHome = await requestWithRetry(`${ADMIN_FRONTEND_BASE_URL}/`, {
    headers: {
      Cookie: adminLogin.cookieHeader,
    },
  });
  assert.equal(authenticatedHome.status, 200, "Authenticated admin home should render");

  const authenticatedHtml = await authenticatedHome.text();
  assert.match(authenticatedHtml, /Phase 1 control center|Dashboard/, "Admin page should render expected shell copy");

  const usersResponse = await requestWithRetry(`${ADMIN_FRONTEND_BASE_URL}/api/proxy/api/v1/admin/users?page=0&size=10`, {
    headers: {
      Cookie: adminLogin.cookieHeader,
    },
  });
  assert.equal(usersResponse.status, 200, "Admin users list should be reachable via frontend proxy");
  const usersPayload = await readJsonSafe(usersResponse);
  const users = extractPageContent(usersPayload);
  const targetUser = users.find(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.id === "number" &&
      typeof item.email === "string" &&
      item.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase(),
  );

  assert.ok(targetUser, "Admin integration requires at least one non-admin user for mutation validation");

  const mutateAction = targetUser.active === false ? "activate" : "deactivate";
  const revertAction = mutateAction === "activate" ? "deactivate" : "activate";

  const mutateResponse = await requestWithRetry(
    `${ADMIN_FRONTEND_BASE_URL}/api/proxy/api/v1/admin/users/${targetUser.id}/${mutateAction}`,
    {
      method: "POST",
      headers: {
        Cookie: adminLogin.cookieHeader,
      },
    },
  );
  assert.equal(mutateResponse.status, 200, "Admin user mutation should succeed via frontend proxy");

  const revertResponse = await requestWithRetry(
    `${ADMIN_FRONTEND_BASE_URL}/api/proxy/api/v1/admin/users/${targetUser.id}/${revertAction}`,
    {
      method: "POST",
      headers: {
        Cookie: adminLogin.cookieHeader,
      },
    },
  );
  assert.equal(revertResponse.status, 200, "Admin user mutation revert should succeed via frontend proxy");
}

async function runRiderFrontendChecks() {
  await assertPublicLoginAndProtectedRedirect(RIDER_FRONTEND_BASE_URL, "Rider");

  const riderLogin = await loginViaFrontend({
    appName: "Rider",
    baseUrl: RIDER_FRONTEND_BASE_URL,
    email: RIDER_EMAIL,
    password: RIDER_PASSWORD,
  });

  const authenticatedHome = await requestWithRetry(`${RIDER_FRONTEND_BASE_URL}/`, {
    headers: {
      Cookie: riderLogin.cookieHeader,
    },
  });
  assert.equal(authenticatedHome.status, 200, "Authenticated rider home should render");

  const riderRidePayload = {
    pickupLocation: {
      type: "Point",
      coordinates: [77.5946, 12.9716],
    },
    dropOffLocation: {
      type: "Point",
      coordinates: [77.58, 12.96],
    },
    paymentMethod: "WALLET",
  };

  const fareEstimate = await requestWithRetry(`${RIDER_FRONTEND_BASE_URL}/api/backend/riders/fare-estimate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: riderLogin.cookieHeader,
    },
    body: JSON.stringify(riderRidePayload),
  });
  assert.equal(fareEstimate.status, 200, "Rider fare estimate should succeed via frontend backend proxy");

  const rideRequest = await requestWithRetry(`${RIDER_FRONTEND_BASE_URL}/api/backend/riders/requestRide`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: riderLogin.cookieHeader,
    },
    body: JSON.stringify(riderRidePayload),
  });
  assert.equal(rideRequest.status, 200, "Rider request ride should succeed via frontend backend proxy");

  const ridesResponse = await requestWithRetry(
    `${RIDER_FRONTEND_BASE_URL}/api/backend/riders/getMyRides?pageOffset=0&pageSize=10`,
    {
      headers: {
        Cookie: riderLogin.cookieHeader,
      },
    },
  );
  assert.equal(ridesResponse.status, 200, "Rider trip lane source should be reachable via frontend backend proxy");

  const activeRideResponse = await requestWithRetry(`${RIDER_FRONTEND_BASE_URL}/api/backend/riders/active-ride`, {
    headers: {
      Cookie: riderLogin.cookieHeader,
    },
  });
  assert.equal(activeRideResponse.status, 200, "Rider active-ride tracking endpoint should be reachable via frontend backend proxy");

  const invalidRideRequest = await requestWithRetry(`${RIDER_FRONTEND_BASE_URL}/api/backend/riders/requestRide`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: riderLogin.cookieHeader,
    },
    body: JSON.stringify({ paymentMethod: "WALLET" }),
  });
  assert.ok(invalidRideRequest.status >= 400, "Invalid rider request payload should be rejected");
}

async function runDriverFrontendChecks() {
  await assertPublicLoginAndProtectedRedirect(DRIVER_FRONTEND_BASE_URL, "Driver");

  const driverLogin = await loginViaFrontend({
    appName: "Driver",
    baseUrl: DRIVER_FRONTEND_BASE_URL,
    email: DRIVER_EMAIL,
    password: DRIVER_PASSWORD,
  });

  const authenticatedHome = await requestWithRetry(`${DRIVER_FRONTEND_BASE_URL}/`, {
    headers: {
      Cookie: driverLogin.cookieHeader,
    },
  });
  assert.equal(authenticatedHome.status, 200, "Authenticated driver home should render");

  const driverProfile = await requestWithRetry(`${DRIVER_FRONTEND_BASE_URL}/api/backend/drivers/getMyProfile`, {
    headers: {
      Cookie: driverLogin.cookieHeader,
    },
  });
  assert.equal(driverProfile.status, 200, "Driver profile should be reachable via frontend backend proxy");

  const availabilityOn = await requestWithRetry(`${DRIVER_FRONTEND_BASE_URL}/api/backend/drivers/availability`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: driverLogin.cookieHeader,
    },
    body: JSON.stringify({ available: true }),
  });
  assert.equal(availabilityOn.status, 200, "Driver availability toggle-on should return 200");

  const availabilityOff = await requestWithRetry(`${DRIVER_FRONTEND_BASE_URL}/api/backend/drivers/availability`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: driverLogin.cookieHeader,
    },
    body: JSON.stringify({ available: false }),
  });
  assert.ok(
    availabilityOff.status === 200 || availabilityOff.status === 409,
    `Driver availability toggle-off should return 200/409, got ${availabilityOff.status}`,
  );

  const locationUpdate = await requestWithRetry(`${DRIVER_FRONTEND_BASE_URL}/api/backend/drivers/location`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: driverLogin.cookieHeader,
    },
    body: JSON.stringify({
      lat: 12.9716,
      lng: 77.5946,
      heading: 90,
      speedKph: 24,
      accuracyM: 8,
      capturedAt: new Date().toISOString(),
    }),
  });
  assert.equal(locationUpdate.status, 200, "Driver location publish should return 200");
}

async function main() {
  const backendHealth = await requestWithRetry(`${BACKEND_BASE_URL}/actuator/health`);
  assert.equal(backendHealth.status, 200, "Backend health check should respond with 200");

  const openApi = await requestWithRetry(`${BACKEND_BASE_URL}/v3/api-docs`);
  if (EXPECT_OPENAPI_IN_CONTEXT.has(PROFILE_CONTEXT)) {
    assert.equal(openApi.status, 200, `Backend OpenAPI should be reachable in ${PROFILE_CONTEXT} context`);
  } else {
    assert.ok(openApi.status >= 400, `Backend OpenAPI should be disabled outside local/dev contexts, got ${openApi.status}`);
  }

  await runAdminFrontendChecks();
  await runRiderFrontendChecks();
  await runDriverFrontendChecks();

  console.log("Frontend-backend integration handshake checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
