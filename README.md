# WedPlan Server

Wedding Planning Platform — Backend API (Express.js, MongoDB, JWT, Stripe)

## Description

WedPlan is a full-stack wedding planning platform. This is the **server** repository (Express.js + MongoDB Atlas native driver + JWT + Stripe). It exposes REST APIs for services, bookings, payments, vendor/customer/admin dashboards, and authentication token verification. The client lives in [`wedplan-client`](https://github.com/Jubairhatem/wedplan-client).

## Tech Stack

- **Runtime**: Node.js, Express.js
- **Database**: MongoDB (native driver), MongoDB Atlas
- **Authentication**: JWT (jsonwebtoken), verified against shared `JWT_SECRET`
- **Payments**: Stripe Checkout (test mode) + signature-verified webhooks
- **Validation**: Zod
- **Security**: Helmet, CORS (whitelist), cookie-parser

## API Reference

### Public
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/services` | Search, category/location filter, price sort, pagination (approved + active only) |
| GET | `/api/services/featured` | Featured services for homepage |
| GET | `/api/services/categories` | Category list with counts |
| GET | `/api/services/:id` | Single service details |

### Authentication (JWT-protected)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/users/me` | Authenticated | Current user profile (safe fields only) |
| PATCH | `/api/users/me` | Authenticated | Update name/image/businessName (allow-listed) |

### Bookings
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/bookings` | Customer | Create booking (active service check, duplicate prevention, past-date rejection) |
| GET | `/api/bookings/my` | Customer | List own bookings with service/vendor enrichment |
| PATCH | `/api/bookings/:id/cancel` | Customer (owner, pending only) | Cancel a pending booking |
| GET | `/api/bookings/:id` | Customer/Vendor (owner) | View booking details |

### Vendor
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/vendor/services` | Vendor | Create service (pending; free plan max 3 active) |
| GET | `/api/vendor/services` | Vendor | List own services |
| PATCH | `/api/vendor/services/:id` | Vendor (owner) | Update service / toggle availability |
| DELETE | `/api/vendor/services/:id` | Vendor (owner) | Delete service |
| GET | `/api/vendor/overview` | Vendor | Service/booking stats + subscription status |
| GET | `/api/vendor/bookings` | Vendor | Received booking requests |
| PATCH | `/api/vendor/bookings/:id/accept\|reject` | Vendor (owner, pending only) | Accept or reject a booking |

### Payments
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/payments/create-checkout-session` | Vendor | Create Stripe Checkout session (vendor ID from JWT) |
| GET | `/api/payments/session/:id` | Vendor | Read-only session status (never activates premium) |
| POST | `/api/webhooks/stripe` | Stripe signature | Verified webhook: activates premium, extends expiry, handles failures/cancellations |

### Admin (`requireRole('admin')`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/overview` | Platform-wide stats (users, vendors, customers, services, transactions, bookings) |
| GET | `/api/admin/users` | Searchable, role-filtered, paginated user list |
| GET | `/api/admin/users/:id` | Single user details |
| PATCH | `/api/admin/users/:id/block\|unblock` | Block/unblock (cannot block self or other admins) |
| GET | `/api/admin/services` | Searchable, status/category-filtered service list |
| PATCH | `/api/admin/services/:id/status` | Approve/reject/toggle active status |
| DELETE | `/api/admin/services/:id` | Delete service |
| GET | `/api/admin/transactions` | Read-only transaction list with vendor enrichment |

## Database Design

Three business collections (`services`, `bookings`, `transactions`) plus Better Auth's own collections (`user`, `session`, `account`, `verification`).

**Indexes**:
- `transactions.stripeSessionId` — unique
- `bookings(serviceId, customerId, eventDate)` — compound (prevents duplicate active bookings)
- `services(status, isActive)` — filter index
- `services.serviceName` — text index (search)

## Installation Instructions

```bash
# Clone the repository
git clone https://github.com/Jubairhatem/wedplan-server.git
cd wedplan-server

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and fill in all required values (see Environment Variables below)

# Seed the admin account (optional)
npm run seed

# Run the development server
npm run dev
```

The server runs on `http://localhost:5000` by default.

## How to Run Locally

1. Ensure MongoDB is running (Atlas or local)
2. Copy `.env.example` to `.env` and configure all variables
3. Run `npm run seed` to create/promote the admin account
4. Run `npm run dev` — server starts on port 5000
5. Health check: `curl http://localhost:5000/`

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `PORT` | Server port (default 5000) | No |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `DB_NAME` | Database name (default wedplan) | No |
| `JWT_SECRET` | Secret for signing/verifying backend JWTs | Yes |
| `CLIENT_URL` | Client origin for CORS (e.g. http://localhost:3000) | Yes |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) | No (Stripe disabled if placeholder) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | No |
| `STRIPE_PREMIUM_PRICE_ID` | Stripe price ID for premium subscription | No |
| `IMGBB_API_KEY` | ImgBB API key (server-side upload proxy) | No |
| `ADMIN_EMAIL` | Admin email for seed script | No |
| `ADMIN_PASSWORD` | Admin password for seed script | No |

> **Never commit `.env` or any `.env*` file.** Only `.env.example` is committed.

## Repository Links

- **Server**: https://github.com/Jubairhatem/wedplan-server
- **Client**: https://github.com/Jubairhatem/wedplan-client

## Test Credentials (Optional)

- **Admin**: `admin@wedplan.com` / `Admin123!@#` (seeded via `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- **Stripe test card**: `4242 4242 4242 4242` (test mode only)

## Scripts

| Script | Description |
|---|---|
| `npm start` | Start production server |
| `npm run dev` | Start development server with file watch |
| `npm run seed` | Seed/promote admin account from env variables |

## Security Notes

- All protected routes enforce: `verifyJWT → checkBlocked → requireRole → ownership check`
- Role and subscription status are re-synchronized from the database on every request to prevent token privilege escalation
- Premium status is activated **only** through a verified Stripe webhook, never from client-side redirects
- Profile updates use a strict field allow-list; `role`, `subscriptionPlan`, `isBlocked` are never writable by clients
- Transaction records are read-only; no API exists to modify them
