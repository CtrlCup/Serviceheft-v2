import { useEffect } from 'react';

/**
 * Hook to enable Enter-key navigation between form inputs.
 * It finds all inputs/selects/buttons in the container ref and moves focus on Enter.
 */
export function useEnterNavigation<T extends HTMLElement>(containerRef: React.RefObject<T | null>) {
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;

            // Allow default behavior for textareas or special buttons if needed
            if (e.target instanceof HTMLTextAreaElement) return;

            const selector = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), button:not([disabled]):not([type="button"])';
            const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];

            const index = elements.indexOf(e.target as HTMLElement);
            if (index > -1 && index < elements.length - 1) {
                e.preventDefault();
                elements[index + 1].focus();
            } else if (index === elements.length - 1) {
                // If it's the last element (likely submit button), let it trigger default (submit)
                // or explicitly click it if needed. For now default form submission usually works on Enter.
                // But for buttons, Enter triggers click anyway.
            }
        };

        container.addEventListener('keydown', handleKeyDown);
        return () => container.removeEventListener('keydown', handleKeyDown);
    }, [containerRef]);
}
