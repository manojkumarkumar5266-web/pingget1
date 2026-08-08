/**
 * Global Image Asset Manager — replace PNGs in public/images/ (same filenames).
 * See public/images/README.md
 */
export const Images = {
  logo: '/images/logo.png',

  welcome: '/images/welcome.png',
  welcomeDp: '/images/welcome-dp.png',
  landingHero: '/images/landing-hero.png',
  landingBackground: '/images/landing-background.png',

  homeHero: '/images/home-hero.png',

  scanning: '/images/scanning.png',
  tracking: '/images/tracking.png',
  emptyState: '/images/empty-state.png',
  userWaiting: '/images/user-waiting.png',
  orderAccepted: '/images/order-accepted.png',
  orderPickedUp: '/images/order-picked-up.png',
  paymentReceived: '/images/payment-received.png',
  thankYouRating: '/images/thank-you-rating.png',
  customerThankYou: '/images/customer-thank-you.png',
  bikeMarker: '/images/bike-marker.png',

  feature: {
    card1: '/images/feature/card-1.png',
    card2: '/images/feature/card-2.png',
    card3: '/images/feature/card-3.png',
    card4: '/images/feature/card-4.png',
    card5: '/images/feature/card-5.png',
    card6: '/images/feature/card-6.png',
    card7: '/images/feature/card-7.png',
    card8: '/images/feature/card-8.png',
    card9: '/images/feature/card-9.png',
    instant: '/images/feature/instant.png',
    advance: '/images/feature/advance.png',
    orderWay: '/images/feature/order-way.png',
    askAnything: '/images/feature/ask-anything.png',
    getEverything: '/images/feature/get-everything.png',
    localPartners: '/images/feature/local-partners.png',
    trackLive: '/images/feature/track-live.png',
    instantBooking: '/images/feature/instant-booking.png',
    advanceBooking: '/images/feature/advance-booking.png',
  },

  category: {
    shopping: '/images/category/shopping.png',
    pickup: '/images/category/pickup.png',
    delivery: '/images/category/delivery.png',
    documents: '/images/category/documents.png',
    medicine: '/images/category/medicine.png',
    food: '/images/category/food.png',
    flowers: '/images/category/flowers.png',
    gifts: '/images/category/gifts.png',
    groceries: '/images/category/groceries.png',
    laundry: '/images/category/laundry.png',
    courier: '/images/category/courier.png',
    assistant: '/images/category/assistant.png',
    custom: '/images/category/custom.png',
  },

  trackingStep: {
    reachedStore: '/images/tracking/reached-store.png',
    orderPickedUp: '/images/tracking/order-picked-up.png',
    onTheWay: '/images/tracking/on-the-way.png',
    arrived: '/images/tracking/arrived.png',
    delivered: '/images/tracking/delivered.png',
    // legacy aliases
    confirmed: '/images/tracking/reached-store.png',
    startedShopping: '/images/tracking/reached-store.png',
    itemsPurchased: '/images/tracking/order-picked-up.png',
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
