/**
 * Formatiert eine Laufzeit in Sekunden in die größtmögliche sinnvolle Einheit.
 *
 * compact (default): "4 Jahre" / "3 Monate" / "12 Tage" / "5h 30m"
 * detailed:          "4 Jahre 1 Monat 12 Tage" / "3 Monate 5 Tage" / "12 Tage 3 Std"
 */
export function formatRuntime(seconds: number, detailed = false): string {
    if (!seconds || seconds <= 0) return '0h';

    const MINUTE = 60;
    const HOUR = 3600;
    const DAY = 86400;
    const MONTH = 30.44 * DAY;
    const YEAR = 365.25 * DAY;

    if (seconds >= YEAR) {
        const years = Math.floor(seconds / YEAR);
        const remaining = seconds - years * YEAR;
        const months = Math.floor(remaining / MONTH);
        const days = Math.floor((remaining - months * MONTH) / DAY);

        const parts = [`${years} ${years === 1 ? 'Jahr' : 'Jahre'}`];
        if (months > 0) parts.push(`${months} ${months === 1 ? 'Monat' : 'Monate'}`);
        if (detailed && days > 0) parts.push(`${days} ${days === 1 ? 'Tag' : 'Tage'}`);
        return parts.join(' ');
    }

    if (seconds >= MONTH) {
        const months = Math.floor(seconds / MONTH);
        const remaining = seconds - months * MONTH;
        const days = Math.floor(remaining / DAY);
        const hours = Math.floor((remaining - days * DAY) / HOUR);

        const parts = [`${months} ${months === 1 ? 'Monat' : 'Monate'}`];
        if (days > 0) parts.push(`${days} ${days === 1 ? 'Tag' : 'Tage'}`);
        if (detailed && days === 0 && hours > 0) parts.push(`${hours} Std`);
        return parts.join(' ');
    }

    if (seconds >= DAY) {
        const days = Math.floor(seconds / DAY);
        const remaining = seconds - days * DAY;
        const hours = Math.floor(remaining / HOUR);
        const parts = [`${days} ${days === 1 ? 'Tag' : 'Tage'}`];
        if (hours > 0) parts.push(`${hours} Std`);
        return parts.join(' ');
    }

    const hours = Math.floor(seconds / HOUR);
    const minutes = Math.floor((seconds % HOUR) / MINUTE);

    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    return `${minutes}m`;
}
