# Velo — API Reference

## Entry Points (local)
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- Title: `Velo Platform API`
- Path count: 60

## Security
- `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password` are public
- All other endpoints require `Authorization: Bearer <token>`
- Integration tests use `TestSecurityConfig` with `X-Test-User-Id`, `X-Test-Email`, `X-Test-Role` headers

## Tagged Groups

### Authentication
- `POST /auth/login` — get JWT token
- `POST /auth/signup` — register new rider
- `POST /auth/onBoardNewDriver/{userId}` — convert rider to driver
- `PUT /auth/profile` — update profile (authenticated)
- `POST /auth/forgot-password` — request password reset
- `POST /auth/reset-password` — reset password with token

### Rider (11 endpoints)
- `POST /riders/fare-estimate` — fare + ETA before ride
- `POST /riders/requestRide` — request immediate ride
- `POST /riders/cancelRide/{rideId}` — cancel active ride
- `POST /riders/rateDriver` — rate driver post-ride
- `POST /riders/rateDriver/{rideId}/{rating}` — alternative rating
- `GET /riders/getMyProfile` — rider profile
- `GET /riders/getMyRides` — paginated ride history
- `POST /riders/schedule-ride` — schedule future ride
- `GET /riders/scheduled-rides` — list scheduled rides
- `PUT /riders/scheduled-rides/{id}/reschedule` — change scheduled time
- `DELETE /riders/scheduled-rides/{id}` — cancel scheduled ride

### Driver (9 endpoints)
- `POST /drivers/acceptRide/{rideRequestId}` — accept ride request
- `POST /drivers/startRide/{rideRequestId}` — start ride with OTP
- `POST /drivers/endRide/{rideId}` — complete ride
- `POST /drivers/cancelRide/{rideId}` — cancel assigned ride
- `POST /drivers/rateRider` — rate rider
- `POST /drivers/rateRider/{rideId}/{rating}` — alternative rating
- `GET /drivers/getMyProfile` — driver profile
- `GET /drivers/getMyRides` — driver ride history
- `PUT /drivers/availability` — toggle online/offline

### Driver Earnings (5 endpoints)
- `GET /drivers/earnings` — earnings history
- `GET /drivers/earnings/summary` — daily/weekly/monthly summary
- `GET /drivers/earnings/balance` — available balance
- `POST /drivers/earnings/payout` — request payout
- `GET /drivers/earnings/payouts` — payout history

### Notifications (4 endpoints)
- `GET /notifications` — paginated notifications
- `GET /notifications/unread-count` — badge count
- `POST /notifications/{id}/read` — mark single as read
- `POST /notifications/read-all` — mark all as read
- WebSocket: `/user/queue/notifications` (STOMP over SockJS at `/ws`)

### Payment Methods (4 endpoints)
- `GET /payment-methods` — list user's payment methods
- `POST /payment-methods` — add payment method
- `DELETE /payment-methods/{id}` — delete payment method
- `PUT /payment-methods/{id}/default` — set default

### Promo Codes (4 endpoints)
- `GET /promo-codes/active` — available promos (RIDER/ADMIN)
- `POST /api/v1/admin/promo-codes` — create promo (ADMIN)
- `PUT /api/v1/admin/promo-codes/{id}` — update promo (ADMIN)
- `POST /api/v1/admin/promo-codes/{id}/deactivate` — deactivate (ADMIN)

### Admin (14 endpoints)
- `GET /api/v1/admin/stats/dashboard` — dashboard overview
- `GET /api/v1/admin/stats/daily` — daily statistics
- `GET /api/v1/admin/stats/revenue` — revenue reports
- `GET /api/v1/admin/drivers/pending` — driver approvals queue
- `POST /api/v1/admin/drivers/{id}/approve` — approve driver
- `POST /api/v1/admin/drivers/{id}/reject` — reject driver
- `GET /api/v1/admin/users` — user management
- `POST /api/v1/admin/users/{id}/activate` — activate user
- `POST /api/v1/admin/users/{id}/deactivate` — deactivate user
- `GET /api/v1/admin/payouts/pending` — payout approvals
- `POST /api/v1/admin/payouts/{id}/approve` — approve payout
- `POST /api/v1/admin/payouts/{id}/reject` — reject payout
- `POST /api/v1/admin/payouts/{id}/process` — process payout
- `GET /api/v1/admin/scheduled-rides` — all scheduled rides
