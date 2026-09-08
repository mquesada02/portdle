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

export function yesterdayUtc(date: string): string {
	return addUtcDays(date, -1);
}
