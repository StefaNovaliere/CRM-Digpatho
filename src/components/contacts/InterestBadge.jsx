// src/components/contacts/InterestBadge.jsx

const config = {
  cold: {
    label: 'Frío',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    emoji: '❄️'
  },
  warm: {
    label: 'Tibio',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-400',
    emoji: '🌤️'
  },
  hot: {
    label: 'Caliente',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    emoji: '🔥'
  },
  customer: {
    label: 'Cliente',
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
    emoji: '✅'
  },
  churned: {
    label: 'Ex-cliente',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-400',
    emoji: '⚠️'
  }
};

export const InterestBadge = ({
  level,
  showEmoji = false,
  showDot = true,
  size = 'md'
}) => {
  const { label, bg, text, dot, emoji } = config[level] || config.cold;

  const sizes = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-0.5 text-xs',
    lg: 'px-2.5 py-1 text-sm'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${bg} ${text} ${sizes[size]}`}>
      {showDot && !showEmoji && (
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      )}
      {showEmoji && <span>{emoji}</span>}
      {label}
    </span>
  );
};

// Selector de nivel de interés para formularios
export const InterestSelector = ({ value, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(config).map(([key, { label, bg, text, emoji }]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`
            px-3 py-2 rounded-lg border-2 font-medium text-sm transition-all
            ${value === key
              ? `${bg} ${text} border-current`
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }
          `}
        >
          {emoji} {label}
        </button>
      ))}
    </div>
  );
};

export default InterestBadge;
