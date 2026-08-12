/**
 * Global Image Asset Manager — optimized WebP assets in public/images/
 * See public/images/README.md
 */
export const Images = {
  logo: '/images/logo.webp',

  welcome: '/images/welcome.webp',
  welcomeDp: '/images/welcome-dp.webp',
  landingHero: '/images/landing-hero.webp',
  landingBackground: '/images/landing-background.webp',

  homeHero: '/images/home-hero.webp',

  scanning: '/images/scanning.webp',
  tracking: '/images/tracking.webp',
  emptyState: '/images/empty-state.webp',
  userWaiting: '/images/user-waiting.webp',
  orderAccepted: '/images/order-accepted.webp',
  orderPickedUp: '/images/order-picked-up.webp',
  paymentReceived: '/images/payment-received.webp',
  thankYouRating: '/images/thank-you-rating.webp',
  customerThankYou: '/images/customer-thank-you.webp',
  bikeMarker: '/images/bike-marker.webp',

  feature: {
    card1: '/images/feature/card-1.webp',
    card2: '/images/feature/card-2.webp',
    card3: '/images/feature/card-3.webp',
    card4: '/images/feature/card-4.webp',
    card5: '/images/feature/card-5.webp',
    card6: '/images/feature/card-6.webp',
    card7: '/images/feature/card-7.webp',
    card8: '/images/feature/card-8.webp',
    card9: '/images/feature/card-9.webp',
    instant: '/images/feature/instant.webp',
    advance: '/images/feature/advance.webp',
    orderWay: '/images/feature/order-way.webp',
    askAnything: '/images/feature/ask-anything.webp',
    getEverything: '/images/feature/get-everything.webp',
    localPartners: '/images/feature/local-partners.webp',
    trackLive: '/images/feature/track-live.webp',
    instantBooking: '/images/feature/instant-booking.webp',
    advanceBooking: '/images/feature/advance-booking.webp',
  },

  category: {
    shopping: '/images/category/shopping.webp',
    pickup: '/images/category/pickup.webp',
    delivery: '/images/category/delivery.webp',
    documents: '/images/category/documents.webp',
    medicine: '/images/category/medicine.webp',
    food: '/images/category/food.webp',
    flowers: '/images/category/flowers.webp',
    gifts: '/images/category/gifts.webp',
    groceries: '/images/category/groceries.webp',
    laundry: '/images/category/laundry.webp',
    courier: '/images/category/courier.webp',
    assistant: '/images/category/assistant.webp',
    custom: '/images/category/custom.webp',
  },

  trackingStep: {
    reachedStore: '/images/tracking/reached-store.webp',
    orderPickedUp: '/images/tracking/order-picked-up.webp',
    onTheWay: '/images/tracking/on-the-way.webp',
    arrived: '/images/tracking/arrived.webp',
    delivered: '/images/tracking/delivered.webp',
    // legacy aliases
    confirmed: '/images/tracking/reached-store.webp',
    startedShopping: '/images/tracking/reached-store.webp',
    itemsPurchased: '/images/tracking/order-picked-up.webp',
  },
} as const

export const CATEGORY_IMAGE_MAP: Record<string, string> = {
  Shopping: Images.category.shopping,
  Pickup: Images.category.pickup,
  Delivery: Images.category.delivery,
  Documents: Images.category.documents,
  Medicine: Images.category.medicine,
  Food: Images.category.food,
  Flowers: Images.category.flowers,
  Gifts: Images.category.gifts,
  Groceries: Images.category.groceries,
  Grocery: Images.category.groceries,
  Laundry: Images.category.laundry,
  Courier: Images.category.courier,
  'Personal Assistant': Images.category.assistant,
  'Custom Request': Images.category.custom,
  Parcel: Images.category.delivery,
  Gift: Images.category.gifts,
}

export function getCategoryImage(name: string): string {
  return CATEGORY_IMAGE_MAP[name] || Images.category.custom
}

/** Status → tracking step image (store → delivered) */
export const STATUS_STEP_IMAGE: Record<string, string> = {
  accepted: Images.trackingStep.reachedStore,
  confirmed: Images.trackingStep.reachedStore,
  task_started: Images.trackingStep.reachedStore,
  shopping: Images.trackingStep.reachedStore,
  purchased: Images.trackingStep.orderPickedUp,
  on_the_way: Images.trackingStep.onTheWay,
  arrived: Images.trackingStep.arrived,
  delivered: Images.trackingStep.delivered,
  cash_received: Images.trackingStep.delivered,
  completed: Images.trackingStep.delivered,
}

export function getTrackingStepImage(status: string): string {
  return STATUS_STEP_IMAGE[status] || Images.tracking
}

export const SELECTED_ADDRESS_KEY = 'pingget_selected_address_id'
