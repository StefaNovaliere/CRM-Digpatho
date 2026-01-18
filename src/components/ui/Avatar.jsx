// src/components/ui/Avatar.jsx

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-20 h-20 text-xl'
};

const colors = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-violet-600',
  'from-green-500 to-green-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
  'from-indigo-500 to-indigo-600'
];

export const Avatar = ({
  src,
  alt,
  name,
  size = 'md',
  className = ''
}) => {
  // Generar color consistente basado en el nombre
  const getColorClass = (name) => {
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Obtener iniciales
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name}
        className={`
          rounded-full object-cover
          ${sizes[size]}
          ${className}
        `}
      />
    );
  }

  return (
    <div
      className={`
        bg-gradient-to-br rounded-full flex items-center justify-center
        text-white font-semibold shadow-sm
        ${getColorClass(name)}
        ${sizes[size]}
        ${className}
      `}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
};

export const AvatarGroup = ({
  avatars,
  max = 4,
  size = 'md'
}) => {
  const shown = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className="flex -space-x-2">
      {shown.map((avatar, i) => (
        <Avatar
          key={i}
          {...avatar}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <div
          className={`
            flex items-center justify-center rounded-full
            bg-gray-200 text-gray-600 font-medium ring-2 ring-white
            ${sizes[size]}
          `}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
};

export default Avatar;

