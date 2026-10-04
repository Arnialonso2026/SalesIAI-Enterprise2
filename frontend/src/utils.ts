export const currency = (amount: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount)
export const dateTime = (value: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
export const dateShort = (value: string) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
