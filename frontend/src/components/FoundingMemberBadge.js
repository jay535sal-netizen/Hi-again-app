import { Crown } from 'lucide-react';

/**
 * Founding Member badge. Pass `number` to show "#3 of 60" inline.
 * Sizes: 'xs' (next to a name), 'sm' (default), 'lg' (hero on profile).
 */
export default function FoundingMemberBadge({ number, size = 'sm', showLabel = true }) {
    const sizes = {
        xs: 'h-4 px-1.5 text-[10px] gap-0.5',
        sm: 'h-6 px-2 text-xs gap-1',
        lg: 'h-9 px-3 text-sm gap-1.5',
    };
    const iconSize = { xs: 10, sm: 12, lg: 16 };
    return (
        <span
            data-testid="founding-member-badge"
            className={`inline-flex items-center rounded-full font-semibold bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-amber-950 shadow-sm shadow-amber-500/30 ring-1 ring-amber-300/50 ${sizes[size]}`}
            title={`Founding Member${number ? ` #${number} of 60` : ''}`}
        >
            <Crown size={iconSize[size]} className="fill-amber-700/40" strokeWidth={2.5} />
            {showLabel && (
                <span className="whitespace-nowrap">
                    {number ? `Founder #${number}` : 'Founder'}
                </span>
            )}
        </span>
    );
}
