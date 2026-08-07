# Image Asset Guide

Replace any image by copying a new PNG into this folder with the **same filename**. Screens load paths from `src/lib/customImages.ts` — no code changes needed.

## Root images

| File | Screen / usage |
|------|----------------|
| `logo.png` | Brand mark everywhere (welcome, landing, auth, headers). Replaces all "pinGGet" text. |
| `welcome.png` | Welcome splash after sign-in — "Hello welcome to pinGGet" |
| `landing-hero.png` | Landing / Get Started page hero |
| `landing-background.png` | Landing page background |
| `home-hero.png` | User home "Get Things Done" card background |
| `hai-hand.png` | Greeting hand illustration next to user name |
| `scanning.png` | Optional scanning accent |
| `tracking.png` | Fallback tracking image |
| `empty-state.png` | Empty lists / no orders |
| `user-waiting.png` | Scanning page — left side below scanner |
| `order-picked-up.png` | 2s interstitial before chat after DP accepts |
| `payment-received.png` | Shown above rating after payment accepted |
| `thank-you-rating.png` | After user submits rating (2s then home) |

## `feature/`

| File | Usage |
|------|--------|
| `instant.png` | Home carousel — Instant Delivery |
| `advance.png` | Home carousel — Advance Booking |
| `order-way.png` | Home carousel — Order Your Way |
| `ask-anything.png` | Home carousel — Ask Anything |
| `get-everything.png` | Home carousel — Get Everything |
| `local-partners.png` | Home carousel — Local Partners |
| `track-live.png` | Home carousel — Track Live |
| `instant-booking.png` | Get Things Done card — Instant Booking |
| `advance-booking.png` | Get Things Done card — Advance Booking |

## `category/`

Used on Advance Request category grid (and anywhere category icons appear).

| File | Category |
|------|----------|
| `shopping.png` | Shopping |
| `pickup.png` | Pickup |
| `delivery.png` | Delivery |
| `documents.png` | Documents |
| `medicine.png` | Medicine |
| `food.png` | Food |
| `flowers.png` | Flowers |
| `gifts.png` | Gifts |
| `groceries.png` | Groceries |
| `laundry.png` | Laundry |
| `courier.png` | Courier |
| `assistant.png` | Personal Assistant |
| `custom.png` | Custom Request |

## `tracking/`

Replaces the sine-wave tracker. Shown when DP confirms each step.

| File | Status |
|------|--------|
| `confirmed.png` | Order confirmed |
| `started-shopping.png` | Start shopping |
| `items-purchased.png` | Items purchased |
| `order-picked-up.png` | Order picked up |
| `on-the-way.png` | On the way |
| `arrived.png` | Arrived at location |
| `delivered.png` | Delivered |

## Tips

- Prefer PNG or WebP, roughly matching existing dimensions.
- Keep filenames exact (case-sensitive on some hosts).
- After replacing files, hard-refresh or clear app cache to see updates.
