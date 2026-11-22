# WedPlan Server

Wedding Planning Platform — Backend API

## Tech Stack
- Express.js
- MongoDB (native driver)
- JWT Authentication
- Stripe Payments
- Zod Validation

## Getting Started

```bash
npm install
cp .env.example .env
# Fill in your .env values
npm run dev
```

## Database Collections

### services
`_id, vendorId, serviceName, category, description, price, location, images[], status (pending|approved|rejected), isActive (bool), createdAt, updatedAt`

### bookings
`_id, serviceId, vendorId, customerId, eventDate, eventLocation, message, status (pending|accepted|rejected|cancelled), createdAt`

### transactions
`_id, vendorId, plan, amount, currency, stripeSessionId (unique), stripeSubscriptionId, status (paid|failed|pending|cancelled|expired), createdAt`

## Indexes
- `transactions.stripeSessionId` — unique index
- `bookings(serviceId, customerId, eventDate)` — compound index (prevents duplicates)
- `services(status, isActive)` — filter index
- `services.serviceName` — text index (search)
