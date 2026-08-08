# Image Asset Guide

Replace any image by copying a new PNG into this folder with the **same filename**. Screens load paths from `src/lib/customImages.ts` — no code changes needed.

When you have a zip of final art, unpack into `public/images/` keeping these filenames.

## Root images

| File | Screen / usage |
|------|----------------|
| `logo.png` | Optional asset (logos removed from UI chrome for now) |
| `welcome.png` | Customer welcome splash |
| `welcome-dp.png` | Partner welcome splash |
| `landing-hero.png` | Customer landing / Get Started |
| `landing-background.png` | Landing page background |
| `home-hero.png` | User home "Get Things Done" card background |
| `hai-hand.png` | Greeting hand next to user name |
| `user-waiting.png` | Scanning — waiting illustration |
| `order-accepted.png` | 2s interstitial after DP accepts → tracking |
| `order-picked-up.png` | Legacy / pickup step alias |
| `bike-marker.png` | Bike marker on free street map |
| `payment-received.png` | Above rating after payment accepted |
| `thank-you-rating.png` | Rating thank-you (optional) |
| `customer-thank-you.png` | After rating / DP payment accept |
| `empty-state.png` | Empty lists |
| `tracking.png` | Fallback tracking image |

## `feature/`

| File | Usage |
|------|--------|
| `card-1.png` … `card-9.png` | Home carousel (9 cards, auto-loop) |
| `instant-booking.png` | Get Things Done — Instant |
| `advance-booking.png` | Get Things Done — Advance |

## `tracking/`

| File | Step |
|------|------|
| `reached-store.png` | Reached store |
| `order-picked-up.png` | Order picked up |
| `on-the-way.png` | On the way |
| `arrived.png` | Arrived |
| `delivered.png` | Delivered |

## `category/`

Advance booking category grid images.
