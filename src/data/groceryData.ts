export type GroceryItem = {
  name: string
  unit: string
  price: number
}

export type GroceryCategory = {
  name: string
  icon: string
  items: GroceryItem[]
}

export const GROCERY_CATEGORIES: GroceryCategory[] = [
  {
    name: 'Rice & Grains',
    icon: '🌾',
    items: [
      { name: 'Sona Masoori Rice (1kg)', unit: 'kg', price: 55 },
      { name: 'Basmati Rice (1kg)', unit: 'kg', price: 120 },
      { name: 'Idli Rice (1kg)', unit: 'kg', price: 60 },
      { name: 'Wheat Flour (1kg)', unit: 'kg', price: 45 },
      { name: 'Toor Dal (1kg)', unit: 'kg', price: 130 },
      { name: 'Moong Dal (1kg)', unit: 'kg', price: 110 },
      { name: 'Chana Dal (1kg)', unit: 'kg', price: 90 },
      { name: 'Urad Dal (1kg)', unit: 'kg', price: 120 },
    ],
  },
  {
    name: 'Cooking Oil & Ghee',
    icon: '🫗',
    items: [
      { name: 'Sunflower Oil (1L)', unit: 'L', price: 160 },
      { name: 'Groundnut Oil (1L)', unit: 'L', price: 180 },
      { name: 'Mustard Oil (1L)', unit: 'L', price: 150 },
      { name: 'Coconut Oil (500ml)', unit: 'ml', price: 120 },
      { name: 'Ghee (500g)', unit: 'g', price: 280 },
      { name: 'Olive Oil (500ml)', unit: 'ml', price: 350 },
    ],
  },
  {
    name: 'Spices & Masala',
    icon: '🧂',
    items: [
      { name: 'Turmeric Powder (100g)', unit: 'g', price: 25 },
      { name: 'Red Chilli Powder (100g)', unit: 'g', price: 30 },
      { name: 'Coriander Powder (100g)', unit: 'g', price: 20 },
      { name: 'Cumin Seeds (100g)', unit: 'g', price: 35 },
      { name: 'Garam Masala (100g)', unit: 'g', price: 40 },
      { name: 'Mustard Seeds (100g)', unit: 'g', price: 25 },
      { name: 'Asafoetida (Hing) 25g', unit: 'g', price: 50 },
      { name: 'Curry Leaves (1 bunch)', unit: 'bunch', price: 10 },
    ],
  },
  {
    name: 'Vegetables',
    icon: '🥬',
    items: [
      { name: 'Onions (1kg)', unit: 'kg', price: 40 },
      { name: 'Potatoes (1kg)', unit: 'kg', price: 30 },
      { name: 'Tomatoes (1kg)', unit: 'kg', price: 35 },
      { name: 'Green Chillies (100g)', unit: 'g', price: 15 },
      { name: 'Ginger (100g)', unit: 'g', price: 25 },
      { name: 'Garlic (100g)', unit: 'g', price: 30 },
      { name: 'Spinach (1 bunch)', unit: 'bunch', price: 20 },
      { name: 'Coriander (1 bunch)', unit: 'bunch', price: 10 },
      { name: 'Carrots (500g)', unit: 'g', price: 30 },
      { name: 'Cauliflower (1 pc)', unit: 'pc', price: 40 },
    ],
  },
  {
    name: 'Dairy & Eggs',
    icon: '🥛',
    items: [
      { name: 'Milk (1L)', unit: 'L', price: 55 },
      { name: 'Curd (500g)', unit: 'g', price: 40 },
      { name: 'Paneer (250g)', unit: 'g', price: 90 },
      { name: 'Butter (100g)', unit: 'g', price: 55 },
      { name: 'Eggs (6 pcs)', unit: 'pcs', price: 45 },
      { name: 'Cheese (200g)', unit: 'g', price: 120 },
      { name: 'Buttermilk (500ml)', unit: 'ml', price: 25 },
    ],
  },
  {
    name: 'Snacks & Biscuits',
    icon: '🍪',
    items: [
      { name: 'Marie Biscuits (1 pack)', unit: 'pack', price: 25 },
      { name: 'Good Day Biscuits (1 pack)', unit: 'pack', price: 30 },
      { name: 'Potato Chips (1 pack)', unit: 'pack', price: 20 },
      { name: 'Namkeen (200g)', unit: 'g', price: 50 },
      { name: 'Rusk (1 pack)', unit: 'pack', price: 40 },
      { name: 'Chocolate Bar', unit: 'pc', price: 30 },
    ],
  },
  {
    name: 'Tea & Coffee',
    icon: '☕',
    items: [
      { name: 'Tea Powder (250g)', unit: 'g', price: 80 },
      { name: 'Coffee Powder (250g)', unit: 'g', price: 120 },
      { name: 'Green Tea (25 bags)', unit: 'bag', price: 90 },
      { name: 'Sugar (1kg)', unit: 'kg', price: 45 },
      { name: 'Honey (500g)', unit: 'g', price: 180 },
    ],
  },
  {
    name: 'Household Items',
    icon: '🧹',
    items: [
      { name: 'Dishwash Liquid (500ml)', unit: 'ml', price: 65 },
      { name: 'Detergent Powder (1kg)', unit: 'kg', price: 90 },
      { name: 'Bathing Soap (4 pcs)', unit: 'pcs', price: 60 },
      { name: 'Shampoo (200ml)', unit: 'ml', price: 120 },
      { name: 'Toothpaste (100g)', unit: 'g', price: 45 },
      { name: 'Toilet Cleaner (500ml)', unit: 'ml', price: 75 },
    ],
  },
]

export type ParcelType = {
  name: string
  icon: string
  description: string
}

export const PARCEL_TYPES: ParcelType[] = [
  { name: 'Documents', icon: '📄', description: 'Letters, certificates, legal documents' },
  { name: 'Electronics', icon: '📱', description: 'Phones, laptops, chargers, accessories' },
  { name: 'Clothes', icon: '👕', description: 'Garments, sarees, dresses' },
  { name: 'Books', icon: '📚', description: 'Books, notebooks, study material' },
  { name: 'Gifts', icon: '🎁', description: 'Gift boxes, festival items' },
  { name: 'Medicine', icon: '💊', description: 'Pharmacy items, prescription medicines' },
  { name: 'Food Container', icon: '🍱', description: 'Home-cooked food, tiffin boxes' },
  { name: 'Other', icon: '📦', description: 'Any other parcel or package' },
]

export type StationeryItem = {
  name: string
  unit: string
  price: number
}

export const STATIONERY_ITEMS: StationeryItem[] = [
  { name: 'A4 Paper (500 sheets)', unit: 'ream', price: 250 },
  { name: 'Notebook (200 pages)', unit: 'pc', price: 60 },
  { name: 'Blue Pen (5 pcs)', unit: 'pcs', price: 40 },
  { name: 'Pencil (10 pcs)', unit: 'pcs', price: 30 },
  { name: 'Eraser', unit: 'pc', price: 10 },
  { name: 'Sharpener', unit: 'pc', price: 10 },
  { name: 'Scale (30cm)', unit: 'pc', price: 15 },
  { name: 'Glue Stick', unit: 'pc', price: 25 },
  { name: 'Scissors', unit: 'pc', price: 40 },
  { name: 'Stapler', unit: 'pc', price: 80 },
  { name: 'Staples Box', unit: 'box', price: 20 },
  { name: 'Highlighter (5 pcs)', unit: 'pcs', price: 75 },
  { name: 'Marker Pen', unit: 'pc', price: 30 },
  { name: 'File Folder', unit: 'pc', price: 35 },
  { name: 'Envelope (10 pcs)', unit: 'pcs', price: 25 },
]

export type HardwareItem = {
  name: string
  unit: string
  price: number
}

export const HARDWARE_ITEMS: HardwareItem[] = [
  { name: 'Screwdriver Set', unit: 'set', price: 150 },
  { name: 'Hammer', unit: 'pc', price: 120 },
  { name: 'Pliers', unit: 'pc', price: 90 },
  { name: 'Wrench Set', unit: 'set', price: 250 },
  { name: 'Nails (100g)', unit: 'g', price: 40 },
  { name: 'Screws (100g)', unit: 'g', price: 50 },
  { name: 'Measuring Tape', unit: 'pc', price: 80 },
  { name: 'Drill Bit Set', unit: 'set', price: 200 },
  { name: 'PVC Pipe (1m)', unit: 'm', price: 60 },
  { name: 'Electrical Wire (1m)', unit: 'm', price: 25 },
  { name: 'Bulb LED 9W', unit: 'pc', price: 120 },
  { name: 'Switch', unit: 'pc', price: 35 },
  { name: 'Socket', unit: 'pc', price: 40 },
  { name: 'Tape (Insulation)', unit: 'roll', price: 20 },
]

export type PersonalCareItem = {
  name: string
  unit: string
  price: number
}

export const PERSONAL_CARE_ITEMS: PersonalCareItem[] = [
  { name: 'Shampoo (200ml)', unit: 'ml', price: 120 },
  { name: 'Conditioner (200ml)', unit: 'ml', price: 130 },
  { name: 'Body Wash (250ml)', unit: 'ml', price: 110 },
  { name: 'Face Wash (100g)', unit: 'g', price: 90 },
  { name: 'Toothbrush (2 pcs)', unit: 'pcs', price: 40 },
  { name: 'Toothpaste (100g)', unit: 'g', price: 45 },
  { name: 'Deodorant (150ml)', unit: 'ml', price: 180 },
  { name: 'Hair Oil (200ml)', unit: 'ml', price: 80 },
  { name: 'Body Lotion (200ml)', unit: 'ml', price: 150 },
  { name: 'Face Cream (50g)', unit: 'g', price: 120 },
  { name: 'Sunscreen (50g)', unit: 'g', price: 200 },
  { name: 'Razor (2 pcs)', unit: 'pcs', price: 60 },
  { name: 'Sanitary Pads (10 pcs)', unit: 'pcs', price: 50 },
  { name: 'Hand Wash (500ml)', unit: 'ml', price: 70 },
]

export type GiftItem = {
  name: string
  unit: string
  price: number
}

export const GIFT_ITEMS: GiftItem[] = [
  { name: 'Flower Bouquet', unit: 'bunch', price: 250 },
  { name: 'Chocolate Box', unit: 'box', price: 200 },
  { name: 'Greeting Card', unit: 'pc', price: 50 },
  { name: 'Gift Wrap Paper', unit: 'pc', price: 20 },
  { name: 'Teddy Bear (Small)', unit: 'pc', price: 300 },
  { name: 'Scented Candle Set', unit: 'set', price: 350 },
  { name: 'Photo Frame', unit: 'pc', price: 200 },
  { name: 'Custom Gift Hamper', unit: 'hamper', price: 500 },
]
