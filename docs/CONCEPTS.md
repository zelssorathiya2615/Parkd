# Core Concepts & Business Logic

This document outlines the domain knowledge and business rules implemented in the Parkd system.

## 1. Hierarchy of Location
- **Facility:** A distinct physical location (e.g., "Central Plaza Parking"). A facility is managed by a Local Admin.
- **Zone:** A distinct area within a facility (e.g., "Zone A", "Zone B"). Zones dictate the pricing tier.
- **Slot:** An individual parking space within a zone (e.g., "A-01", "B-02"). Slots are what users actually book.

## 2. Pricing Tiers
Zones are categorized into one of three tiers, which determine the base hourly rate:
- **General:** Standard pricing (e.g., $10/hr).
- **Gold:** Premium pricing, usually closer to entrances (e.g., $15/hr).
- **Platinum:** Luxury pricing, VIP spots (e.g., $25/hr).

## 3. Subscription Plans (User Tiers)
Users also have a subscription plan, which provides varying levels of discounts:
- **General Plan:** 0% discount.
- **Gold Plan:** 10% discount on all bookings.
- **Platinum Plan:** 20% discount on all bookings.

*Example Billing Calculation:*
A Gold Plan user parks in a Platinum Zone ($25/hr) for 2 hours.
Base Cost = 2 * $25 = $50.
Discount = 10% of $50 = $5.
Final Bill = $45.

## 4. State Machine: Slots and Tickets
**Slots** have three primary states:
1. `FREE` - Available for booking.
2. `OCCUPIED` - Currently parked in by a user with an active ticket.
3. `RESERVED` - Pre-booked but the user hasn't arrived yet (planned future feature).

**Tickets** have three states:
1. `ACTIVE` - The user is currently parked. The clock is ticking.
2. `PENDING_PAYMENT` - The user has initiated exit, the final cost is calculated, waiting for payment.
3. `COMPLETED` - Payment received. Slot is released back to `FREE`.

## 5. The Queueing System
When a facility reaches 100% capacity (all slots are `OCCUPIED`), users who attempt to book are instead placed in a Queue.
- Users can view their queue position in real-time.
- As `COMPLETED` tickets release slots, the system automatically allocates the freed slot to the user at the front of the queue, changing their status from `QUEUED` to `ACTIVE`.

## 6. User Roles
- **User:** Can book slots, join queues, view history, and pay bills.
- **Local Admin:** Manages a specific facility. Can view revenue and capacity metrics exclusively for their assigned facility.
- **Super Admin:** Full system access. Can manage all facilities, local admins, adjust global tier pricing, and view system-wide analytics.
