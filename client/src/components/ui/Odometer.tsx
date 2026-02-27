import { useEffect, useRef, useState } from 'react';
import './Odometer.css';

interface OdometerProps {
    value: number;
    /** Number of total integer digits (default 6, e.g. 000000) */
    digits?: number;
    /** Show one decimal place (default false) */
    decimal?: boolean;
    /** Animate transitions (default true) */
    animate?: boolean;
}

/**
 * Retro mechanical odometer display.
 * Looks like an old-school car mileage counter with rolling digit segments.
 */
export default function Odometer({ value, digits = 6, decimal = false, animate = true }: OdometerProps) {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValue = useRef(value);

    useEffect(() => {
        if (!animate) {
            setDisplayValue(value);
            return;
        }

        // Animate from previous to new value
        const start = prevValue.current;
        const end = value;
        prevValue.current = value;

        if (start === end) return;

        const diff = end - start;
        const duration = Math.min(1500, Math.max(300, Math.abs(diff) * 2));
        const startTime = performance.now();

        const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayValue(start + diff * eased);
            if (progress < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    }, [value, animate]);

    // Split value into digit array
    const intPart = Math.floor(displayValue);
    const decPart = decimal ? Math.floor((displayValue % 1) * 10) : -1;

    const intStr = String(Math.max(0, intPart)).padStart(digits, '0');
    const digitArray = intStr.split('').map(Number);

    // For smooth rolling: calculate fractional offsets
    // Each digit "carries" from the one to its right
    const getOffset = (digitIndex: number): number => {
        if (!animate) return 0;

        // Only the last integer digit (and decimal) get fractional animation
        const totalDigits = decimal ? digits + 1 : digits;
        const fromRight = totalDigits - 1 - digitIndex;

        if (fromRight === 0) {
            // Rightmost digit: full fractional offset
            if (decimal) {
                return (displayValue * 10) % 10 / 10;
            }
            return displayValue % 1;
        }
        if (fromRight === 1 && decimal) {
            return displayValue % 1;
        }

        return 0;
    };

    return (
        <div className="odometer" role="meter" aria-valuenow={value}>
            <div className="odometer-digits">
                {digitArray.map((digit, i) => (
                    <OdometerDigit
                        key={`int-${i}`}
                        digit={digit}
                        offset={getOffset(i)}
                        isLast={!decimal && i === digitArray.length - 1}
                    />
                ))}
                {decimal && (
                    <>
                        <div className="odometer-separator">
                            <span>,</span>
                        </div>
                        <OdometerDigit
                            digit={decPart}
                            offset={(displayValue * 10) % 1}
                            isLast
                            isDecimal
                        />
                    </>
                )}
                <div className="odometer-unit">
                    <span>km</span>
                </div>
            </div>
        </div>
    );
}

function OdometerDigit({ digit, offset, isLast, isDecimal }: {
    digit: number;
    offset: number;
    isLast?: boolean;
    isDecimal?: boolean;
}) {
    const nextDigit = (digit + 1) % 10;

    return (
        <div className={`odometer-digit ${isLast ? 'last' : ''} ${isDecimal ? 'decimal' : ''}`}>
            <div
                className="odometer-digit-inner"
                style={{
                    transform: `translateY(${-offset * 100}%)`,
                }}
            >
                <span className="odometer-digit-current">{digit}</span>
                <span className="odometer-digit-next">{nextDigit}</span>
            </div>
        </div>
    );
}
