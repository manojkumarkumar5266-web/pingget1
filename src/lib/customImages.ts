/**
 * Global Image Asset Manager
 *
 * Replace any image by copying a new PNG into public/images/ with the same filename.
 * No screen code changes needed.
 *
 * See public/images/README.md for which image maps to which screen.
 */
export const Images = {
  logo: '/images/logo.png',

  welcome: '/images/welcome.png',
  landingHero: '/images/landing-hero.png',
  landingBackground: '/images/landing-background.png',

  homeHero: '/images/home-hero.png',
  haiHand: '/images/hai-hand.png',

  scanning: '/images/scanning.png',
  tracking: '/images/tracking.png',
  emptyState: '/images/empty-state.png',
  userWaiting: '/images/user-waiting.png',
  orderPickedUp: '/images/order-picked-up.png',
  paymentReceived: '/images/payment-received.png',
  thankYouRating: '/images/thank-you-rating.png',

  feature: {
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
    confirmed: '/images/tracking/confirmed.png',
    startedShopping: '/images/tracking/started-shopping.png',
    itemsPurchased: '/images/tracking/items-purchased.png',
    orderPickedUp: '/images/tracking/order-picked-up.png',
    onTheWay: '/images/tracking/on-the-way.png',
    arrived: '/images/tracking/arrived.png',
    delivered: '/images/tracking/delivered.png',
  },
} as const

/** Map advance/instant category display names → image paths */
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
  Electronics: Images.category.custom,
  Vegetables: Images.category.groceries,
  Fruits: Images.category.food,
  Stationery: Images.category.documents,
  Sports: Images.category.custom,
}

export function getCategoryImage(name: string): string {
  return CATEGORY_IMAGE_MAP[name] || Images.category.custom
}

/** Status → tracking step image */
export const STATUS_STEP_IMAGE: Record<string, string> = {
  accepted: Images.trackingStep.confirmed,
  confirmed: Images.trackingStep.confirmed,
  shopping: Images.trackingStep.startedShopping,
  purchased: Images.trackingStep.itemsPurchased,
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
