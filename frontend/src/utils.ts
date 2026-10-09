export const currency = (amount: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount)
export const dateTime = (value: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
export const dateShort = (value: string) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))

export function customerDocumentLabel(documentNumber: string): string {
	const normalized = documentNumber.trim().toUpperCase()
	if (normalized.startsWith('RUC') || normalized.replace(/\D/g, '').length === 11) return 'RUC'
	if (normalized.startsWith('DNI') || normalized.replace(/\D/g, '').length === 8) return 'DNI'
	return 'Documento'
}

export function formatCustomerDocument(documentNumber: string): string {
	const label = customerDocumentLabel(documentNumber)
	const normalized = documentNumber.trim().toUpperCase()
	return normalized.startsWith(`${label}-`) || normalized.startsWith(`${label} `)
		? documentNumber
		: `${label} ${documentNumber}`
}
