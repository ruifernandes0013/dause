export const formatCurrency = (amount) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(amount || 0)

export const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const SOURCES = ['Airbnb', 'Booking', 'Direct']

// Expense categories matching your Excel
export const EXPENSE_CATEGORIES = [
  'Água',
  'Luz',
  'Internet',
  'Ynnov',
  'PriceLabs',
  'Limpeza Checkout',
  'Lavandaria',
  'Apartment / Stock',
  'Apartment / Amenities',
  'Apartment / AL',
  'Apartment / Ensurance',
  'Condomínio',
  'Outros',
]

export const SOURCE_COLORS = {
  Airbnb: '#FF5A5F',
  Booking: '#003B95',
  Direct: '#10b981',
}

export const SOURCE_BADGE = {
  Airbnb: 'bg-red-100 text-red-700',
  Booking: 'bg-blue-100 text-blue-700',
  Direct: 'bg-emerald-100 text-emerald-700',
}

export const nightsBetween = (checkIn, checkOut) => {
  const d1 = new Date(checkIn)
  const d2 = new Date(checkOut)
  return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)))
}

export const YEAR_OPTIONS = [2023, 2024, 2025, 2026, 2027, 2028]
