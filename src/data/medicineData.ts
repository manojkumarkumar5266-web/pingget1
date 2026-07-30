export type MedicineItem = {
  name: string
  brand: string
  category: string
  price: number
}

export const MEDICINE_LIST: MedicineItem[] = [
  // Pain & Fever
  { name: 'Paracetamol 500mg', brand: 'Crocin', category: 'Pain & Fever', price: 25 },
  { name: 'Paracetamol 650mg', brand: 'Dolo 650', category: 'Pain & Fever', price: 30 },
  { name: 'Ibuprofen 400mg', brand: 'Brufen', category: 'Pain & Fever', price: 35 },
  { name: 'Aspirin 75mg', brand: 'Disprin', category: 'Pain & Fever', price: 20 },
  { name: 'Nimesulide 100mg', brand: 'Nise', category: 'Pain & Fever', price: 40 },
  { name: 'Diclofenac 50mg', brand: 'Voveran', category: 'Pain & Fever', price: 45 },
  { name: 'Mefenamic Acid 500mg', brand: 'Meftal-Spas', category: 'Pain & Fever', price: 50 },
  { name: 'Aceclofenac 100mg', brand: 'Hifenac', category: 'Pain & Fever', price: 55 },

  // Cold, Cough & Allergy
  { name: 'Cetirizine 10mg', brand: 'Cetzine', category: 'Cold & Allergy', price: 15 },
  { name: 'Levocetirizine 5mg', brand: 'Xyzal', category: 'Cold & Allergy', price: 35 },
  { name: 'Montelukast 10mg', brand: 'Singulair', category: 'Cold & Allergy', price: 80 },
  { name: 'Chlorpheniramine 4mg', brand: 'Piriton', category: 'Cold & Allergy', price: 12 },
  { name: 'Ambroxol Syrup', brand: 'Ambrodil', category: 'Cold & Allergy', price: 60 },
  { name: 'Dextromethorphan Syrup', brand: 'Benadryl', category: 'Cold & Allergy', price: 90 },
  { name: 'Terbutaline Sulphate', brand: 'Bricanyl', category: 'Cold & Allergy', price: 70 },
  { name: 'Fexofenadine 120mg', brand: 'Allegra', category: 'Cold & Allergy', price: 95 },

  // Antibiotics
  { name: 'Amoxicillin 500mg', brand: 'Mox 500', category: 'Antibiotics', price: 80 },
  { name: 'Amoxicillin + Clavulanic Acid', brand: 'Augmentin 625', category: 'Antibiotics', price: 180 },
  { name: 'Azithromycin 500mg', brand: 'Azee 500', category: 'Antibiotics', price: 120 },
  { name: 'Ciprofloxacin 500mg', brand: 'Ciplox 500', category: 'Antibiotics', price: 90 },
  { name: 'Doxycycline 100mg', brand: 'Doxy 100', category: 'Antibiotics', price: 70 },
  { name: 'Metronidazole 400mg', brand: 'Flagyl 400', category: 'Antibiotics', price: 40 },
  { name: 'Cefixime 200mg', brand: 'Taxim-O 200', category: 'Antibiotics', price: 150 },
  { name: 'Levofloxacin 500mg', brand: 'Leva 500', category: 'Antibiotics', price: 110 },

  // Digestive & Stomach
  { name: 'Pantoprazole 40mg', brand: 'Pan 40', category: 'Digestive', price: 60 },
  { name: 'Omeprazole 20mg', brand: 'Omez 20', category: 'Digestive', price: 45 },
  { name: 'Rabeprazole 20mg', brand: 'Razo 20', category: 'Digestive', price: 70 },
  { name: 'Ranitidine 150mg', brand: 'Zinetac', category: 'Digestive', price: 25 },
  { name: 'Domperidone 10mg', brand: 'Domstal', category: 'Digestive', price: 30 },
  { name: 'Ondansetron 4mg', brand: 'Emset', category: 'Digestive', price: 35 },
  { name: 'Loperamide 2mg', brand: 'Lomofen', category: 'Digestive', price: 20 },
  { name: 'ORS Powder', brand: 'Electral', category: 'Digestive', price: 22 },
  { name: 'Pudin Hara', brand: 'Pudin Hara', category: 'Digestive', price: 15 },
  { name: 'Eno Sachet', brand: 'Eno', category: 'Digestive', price: 18 },

  // Diabetes
  { name: 'Metformin 500mg', brand: 'Glycomet 500', category: 'Diabetes', price: 40 },
  { name: 'Metformin 1000mg', brand: 'Glycomet 1000', category: 'Diabetes', price: 65 },
  { name: 'Glimepiride 2mg', brand: 'Amaryl 2', category: 'Diabetes', price: 90 },
  { name: 'Sitagliptin 50mg', brand: 'Januvia 50', category: 'Diabetes', price: 280 },
  { name: 'Insulin Glargine', brand: 'Lantus', category: 'Diabetes', price: 1200 },
  { name: 'Vildagliptin 50mg', brand: 'Galvus 50', category: 'Diabetes', price: 220 },

  // Blood Pressure & Heart
  { name: 'Amlodipine 5mg', brand: 'Amlong 5', category: 'Cardiac', price: 35 },
  { name: 'Telmisartan 40mg', brand: 'Telma 40', category: 'Cardiac', price: 80 },
  { name: 'Losartan 50mg', brand: 'Losar 50', category: 'Cardiac', price: 70 },
  { name: 'Atenolol 50mg', brand: 'Tenormin 50', category: 'Cardiac', price: 30 },
  { name: 'Rosuvastatin 10mg', brand: 'Rozavel 10', category: 'Cardiac', price: 150 },
  { name: 'Atorvastatin 10mg', brand: 'Atorva 10', category: 'Cardiac', price: 100 },
  { name: 'Clopidogrel 75mg', brand: 'Clopitab 75', category: 'Cardiac', price: 90 },

  // Vitamins & Supplements
  { name: 'Vitamin C 500mg', brand: 'Celin 500', category: 'Vitamins', price: 30 },
  { name: 'Vitamin D3 60K', brand: 'D-Rise 60K', category: 'Vitamins', price: 120 },
  { name: 'Vitamin B12 1500mcg', brand: 'Neurobion Forte', category: 'Vitamins', price: 90 },
  { name: 'Multivitamin', brand: 'Revital H', category: 'Vitamins', price: 250 },
  { name: 'Iron + Folic Acid', brand: 'Autrin', category: 'Vitamins', price: 80 },
  { name: 'Calcium + Vitamin D3', brand: 'Shelcal 500', category: 'Vitamins', price: 110 },
  { name: 'Zinc 50mg', brand: 'Zincovit', category: 'Vitamins', price: 60 },
  { name: 'Omega-3 Fish Oil', brand: 'Maxepa', category: 'Vitamins', price: 200 },

  // First Aid
  { name: 'Dettol Antiseptic', brand: 'Dettol', category: 'First Aid', price: 65 },
  { name: 'Savlon Antiseptic', brand: 'Savlon', category: 'First Aid', price: 60 },
  { name: 'Band-Aid (10 pcs)', brand: 'Band-Aid', category: 'First Aid', price: 45 },
  { name: 'Cotton Roll', brand: 'Surgicare', category: 'First Aid', price: 40 },
  { name: 'Gauze Pads', brand: 'Surgicare', category: 'First Aid', price: 35 },
  { name: 'Antiseptic Cream', brand: 'Soframycin', category: 'First Aid', price: 75 },
  { name: 'Burnol', brand: 'Burnol', category: 'First Aid', price: 55 },

  // Eye & Ear Care
  { name: 'Lubricant Eye Drops', brand: 'Refresh Tears', category: 'Eye & Ear', price: 120 },
  { name: 'Ciprofloxacin Eye Drops', brand: 'Ciplox Eye', category: 'Eye & Ear', price: 80 },
  { name: 'Ofloxacin Ear Drops', brand: 'Otek-AC', category: 'Eye & Ear', price: 90 },
  { name: 'Ciprofloxacin Ear Drops', brand: 'Ciplox Ear', category: 'Eye & Ear', price: 75 },

  // Skin Care
  { name: 'Clotrimazole Cream', brand: 'Candid-B', category: 'Skin Care', price: 85 },
  { name: 'Calamine Lotion', brand: 'Lacto Calamine', category: 'Skin Care', price: 70 },
  { name: 'Ketoconazole Shampoo', brand: 'Scalpe', category: 'Skin Care', price: 130 },
  { name: 'Acne Gel', brand: 'Clindac-A', category: 'Skin Care', price: 95 },
  { name: 'Hydrocortisone Cream', brand: 'Locoid', category: 'Skin Care', price: 110 },
]

export const MEDICINE_CATEGORIES = Array.from(new Set(MEDICINE_LIST.map(m => m.category)))
