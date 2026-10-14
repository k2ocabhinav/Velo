# Velo — API Reference

## Entry Points

- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- Controller inventory: **100 HTTP operations across 10 groups**

## Security

- Public: `POST /auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`; `GET /api/v1/public/tenant/branding`.
- All other application endpoints require a bearer token. `GET /actuator/health` is public; `/actuator/prometheus` is disabled unless explicitly enabled and requires ADMIN.
- Integration tests may use `X-Test-User-Id`, `X-Test-Email`, and `X-Test-Role` through `TestSecurityConfig`.

## Authentication (6)

- `POST /auth/login`, `/auth/signup`, `/auth/onBoardNewDriver/{userId}`, `/auth/forgot-password`, `/auth/reset-password`
- `PUT /auth/profile`

## Rider (20)

- `POST /riders/fare-estimate`, `/riders/requestRide`, `/riders/cancelRide/{rideId}`, `/riders/endRide/{rideId}`
- `POST /riders/rateDriver`, `/riders/rateDriver/{rideId}/{rating}`, `/riders/schedule-ride`
- `GET /riders/getMyProfile`, `/riders/getMyRides`, `/riders/active-ride`, `/riders/scheduled-rides`
- `GET /riders/recurring-trip-templates`
- `POST /riders/recurring-trip-templates`
- `PUT /riders/recurring-trip-templates/{id}`
- `POST /riders/recurring-trip-templates/{id}/pause`, `/resume`
- `DELETE /riders/recurring-trip-templates/{id}`
- `GET /riders/wallet?page=0&size=10` — current rider balance and paginated recent transactions
- `PUT /riders/scheduled-rides/{id}/reschedule`
- `DELETE /riders/scheduled-rides/{id}`

## Driver (11)

- `POST /drivers/acceptRide/{rideRequestId}`, `/drivers/startRide/{rideId}`, `/drivers/endRide/{rideId}`, `/drivers/cancelRide/{rideId}`
- `POST /drivers/rateRider`, `/drivers/rateRider/{rideId}/{rating}`
- `GET /drivers/ride-requests/{rideRequestId}`, `/drivers/getMyProfile`, `/drivers/getMyRides`
- `PUT /drivers/availability`, `/drivers/location`

## Driver Earnings (5)

- `GET /drivers/earnings`, `/drivers/earnings/summary`, `/drivers/earnings/balance`, `/drivers/earnings/payouts`
- `POST /drivers/earnings/payout`

## Notifications (4)

- `GET /notifications`, `/notifications/unread-count`
- `POST /notifications/{id}/read`, `/notifications/read-all`
- WebSocket: `/user/queue/notifications` over STOMP/SockJS at `/ws`

## Payment Methods (4)

- `GET /payment-methods`
- `POST /payment-methods`
- `DELETE /payment-methods/{id}`
- `PUT /payment-methods/{id}/default`

## Promo Codes (5)

- `GET /promo-codes/active`, `/api/v1/admin/promo-codes`
- `POST /api/v1/admin/promo-codes`
- `PUT /api/v1/admin/promo-codes/{id}`
- `POST /api/v1/admin/promo-codes/{id}/deactivate`

## Tenant Branding (4)

- `GET /api/v1/public/tenant/branding`, `/api/v1/tenant/branding`, `/api/v1/admin/branding`
- `PUT /api/v1/admin/branding`

## Admin (34)

- `GET /api/v1/admin/stats/dashboard`, `/api/v1/admin/stats/daily`, `/api/v1/admin/stats/revenue`
- `GET /api/v1/admin/stats/revenue/top-drivers?days=30` — top drivers by gross, commission, net earnings, and trips (1–90 days)
- `GET /api/v1/admin/drivers/pending`, `/api/v1/admin/drivers`, `/api/v1/admin/users`
- `POST /api/v1/admin/drivers/{id}/approve`, `/api/v1/admin/drivers/{id}/suspend`, `/api/v1/admin/drivers/{id}/reject`, `/api/v1/admin/drivers/{id}/revoke`
- `POST /api/v1/admin/users/{id}/activate`, `/api/v1/admin/users/{id}/deactivate`
- `GET /api/v1/admin/payouts/pending`
- `POST /api/v1/admin/payouts/{id}/approve`, `/api/v1/admin/payouts/{id}/reject`, `/api/v1/admin/payouts/{id}/process`
- `GET /api/v1/admin/scheduled-rides`
- `GET /api/v1/admin/trip-sheet?date=YYYY-MM-DD&assignment=ALL|ASSIGNED|UNASSIGNED`
- `GET /api/v1/admin/trip-sheet/attention`, `/attention/count`
- `GET /api/v1/admin/trip-sheet/export?date=YYYY-MM-DD` — CSV includes booking and reason fields
- `POST /api/v1/admin/trip-sheet/{rideRequestId}/cancel`, `/no-show`
- `GET /api/v1/admin/dispatch/requests`, `/api/v1/admin/dispatch/active-rides`, `/api/v1/admin/dispatch/requests/{rideRequestId}/offers`, `/api/v1/admin/dispatch/audit`
- `POST /api/v1/admin/dispatch/requests`, `/api/v1/admin/dispatch/requests/{rideRequestId}/assign`, `/api/v1/admin/dispatch/requests/{rideRequestId}/cancel`
- `POST /api/v1/admin/dispatch/rides/{rideId}/reassign`, `/api/v1/admin/dispatch/rides/{rideId}/cancel`
- `GET /api/v1/admin/ops-health`

## Recurring trips (13)

- Admin: `GET /api/v1/admin/recurring-trip-templates`, `/riders`; `POST /api/v1/admin/recurring-trip-templates`; `PUT /api/v1/admin/recurring-trip-templates/{id}`; `POST /api/v1/admin/recurring-trip-templates/{id}/pause`, `/resume`; `DELETE /api/v1/admin/recurring-trip-templates/{id}`
- Rider: `GET`, `POST /api/v1/riders/recurring-trip-templates`; `PUT /api/v1/riders/recurring-trip-templates/{id}`; `POST /api/v1/riders/recurring-trip-templates/{id}/pause`, `/resume`; `DELETE /api/v1/riders/recurring-trip-templates/{id}`
- Weekly materialization defaults to seven days ahead. The unique template/date key makes retries safe; generated requests enter the existing scheduled dispatcher.
- Reason codes: `RIDER_CANCELLED`, `DRIVER_CANCELLED`, `OPERATOR_CANCELLED`, `WEATHER`, `VEHICLE_ISSUE`, `CUSTOMER_NO_SHOW`, `OTHER`.
