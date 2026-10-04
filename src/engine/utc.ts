export function utcDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function utcMidnightMs(date: string): number {
	const year = Number(date.slice(0, 4));
	const month = Number(date.slice(5, 7));
	const day = Number(date.slice(8, 10));
	return Date.UTC(year, month - 1, day);
}

export function utcDayIndex(date: string, epoch: string): number {
	return Math.trunc((utcMidnightMs(date) - utcMidnightMs(epoch)) / 86_400_000);
}

export function addUtcDays(date: string, days: number): string {
	return utcDateString(new Date(utcMidnightMs(date) + days * 86_400_000));
}

// The first UTC midnight strictly after the instant `ms` (epoch milliseconds).
export function nextUtcMidnightMs(ms: number): number {
	return (Math.floor(ms / 86_400_000) + 1) * 86_400_000;
}

export function yesterdayUtc(date: string): string {
	return addUtcDays(date, -1);
}

export function isValidTimestamp(value: string): boolean {
	return !Number.isNaN(Date.parse(value));
}

export function isValidUtcDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const parsed = new Date(`${value}T00:00:00Z`);
	return (
		!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
	);
}

// A Daily is late when the server's today is after the Daily's day.
export function isLate(date: string, serverToday: string): boolean {
	return serverToday > date;
}
