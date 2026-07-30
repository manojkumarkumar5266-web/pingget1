export type FoodItem = {
  name: string
  price: number
}

export type FoodCategory = {
  name: string
  icon: string
  items: FoodItem[]
}

export const FOOD_CATEGORIES: FoodCategory[] = [
  {
    name: 'Biryani',
    icon: '🍚',
    items: [
      { name: 'Chicken Biryani', price: 180 },
      { name: 'Mutton Biryani', price: 280 },
      { name: 'Veg Biryani', price: 140 },
      { name: 'Hyderabadi Dum Biryani', price: 220 },
      { name: 'Egg Biryani', price: 160 },
      { name: 'Fish Biryani', price: 250 },
      { name: 'Prawns Biryani', price: 320 },
      { name: 'Boneless Chicken Biryani', price: 240 },
    ],
  },
  {
    name: 'Andhra Meals',
    icon: '🌶️',
    items: [
      { name: 'Andhra Meals Plate', price: 120 },
      { name: 'Gongura Chicken', price: 220 },
      { name: 'Andhra Chicken Curry', price: 200 },
      { name: 'Royyala Iguru (Prawns)', price: 280 },
      { name: 'Natu Kodi Pulusu', price: 240 },
      { name: 'Endu Chepala Pulusu', price: 260 },
      { name: 'Gongura Pappu', price: 100 },
      { name: 'Andhra Pickle (Avakaya)', price: 60 },
    ],
  },
  {
    name: 'Chinese',
    icon: '🥡',
    items: [
      { name: 'Veg Fried Rice', price: 120 },
      { name: 'Chicken Fried Rice', price: 160 },
      { name: 'Veg Noodles', price: 110 },
      { name: 'Chicken Noodles', price: 150 },
      { name: 'Chilli Chicken', price: 220 },
      { name: 'Manchurian (Veg/Chicken)', price: 180 },
      { name: 'Schezwan Noodles', price: 140 },
      { name: 'Hakka Noodles', price: 130 },
      { name: 'Spring Rolls', price: 90 },
      { name: 'Sweet Corn Soup', price: 80 },
    ],
  },
  {
    name: 'Italian',
    icon: '🍝',
    items: [
      { name: 'Margherita Pizza', price: 250 },
      { name: 'Farmhouse Pizza', price: 320 },
      { name: 'Pepperoni Pizza', price: 380 },
      { name: 'Pasta Alfredo', price: 220 },
      { name: 'Pasta Arrabbiata', price: 200 },
      { name: 'Garlic Bread', price: 100 },
      { name: 'Lasagna', price: 280 },
      { name: 'Bruschetta', price: 120 },
    ],
  },
  {
    name: 'North Indian',
    icon: '🍛',
    items: [
      { name: 'Butter Chicken', price: 240 },
      { name: 'Paneer Butter Masala', price: 200 },
      { name: 'Dal Makhani', price: 140 },
      { name: 'Chole Bhature', price: 120 },
      { name: 'Rajma Chawal', price: 110 },
      { name: 'Aloo Gobi', price: 130 },
      { name: 'Kadai Paneer', price: 210 },
      { name: 'Shahi Paneer', price: 220 },
      { name: 'Tandoori Roti', price: 20 },
      { name: 'Butter Naan', price: 30 },
    ],
  },
  {
    name: 'South Indian',
    icon: '🥞',
    items: [
      { name: 'Masala Dosa', price: 80 },
      { name: 'Plain Dosa', price: 60 },
      { name: 'Idli Sambar (2 pcs)', price: 50 },
      { name: 'Vada Sambar', price: 50 },
      { name: 'Uttapam', price: 90 },
      { name: 'Upma', price: 60 },
      { name: 'Pongal', price: 70 },
      { name: 'Curd Rice', price: 80 },
      { name: 'Sambar Rice', price: 80 },
      { name: 'Filter Coffee', price: 40 },
    ],
  },
  {
    name: 'Fast Food',
    icon: '🍔',
    items: [
      { name: 'Veg Burger', price: 90 },
      { name: 'Chicken Burger', price: 130 },
      { name: 'French Fries', price: 80 },
      { name: 'Veg Roll', price: 70 },
      { name: 'Chicken Roll', price: 110 },
      { name: 'Momos (6 pcs)', price: 80 },
      { name: 'Fried Momos', price: 100 },
      { name: 'Pav Bhaji', price: 90 },
    ],
  },
  {
    name: 'Tandoor & Kebabs',
    icon: '🔥',
    items: [
      { name: 'Tandoori Chicken (Half)', price: 180 },
      { name: 'Tandoori Chicken (Full)', price: 340 },
      { name: 'Chicken Tikka', price: 220 },
      { name: 'Seekh Kebab', price: 200 },
      { name: 'Mutton Kebab', price: 280 },
      { name: 'Fish Tikka', price: 260 },
      { name: 'Paneer Tikka', price: 190 },
      { name: 'Hara Bhara Kebab', price: 150 },
    ],
  },
  {
    name: 'Desserts',
    icon: '🍮',
    items: [
      { name: 'Gulab Jamun (2 pcs)', price: 60 },
      { name: 'Rasmalai', price: 70 },
      { name: 'Ice Cream Scoop', price: 50 },
      { name: 'Falooda', price: 90 },
      { name: 'Double Ka Meetha', price: 80 },
      { name: 'Qubani Ka Meetha', price: 100 },
      { name: 'Jalebi (250g)', price: 80 },
      { name: 'Rasgulla (2 pcs)', price: 50 },
    ],
  },
  {
    name: 'Beverages',
    icon: '🥤',
    items: [
      { name: 'Masala Chai', price: 25 },
      { name: 'Filter Coffee', price: 40 },
      { name: 'Fresh Lime Soda', price: 50 },
      { name: 'Buttermilk (Chaas)', price: 40 },
      { name: 'Lassi', price: 60 },
      { name: 'Cold Coffee', price: 80 },
      { name: 'Mango Milkshake', price: 90 },
      { name: 'Coconut Water', price: 50 },
    ],
  },
]
