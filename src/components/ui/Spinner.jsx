// src/components/ui/Spinner.jsx

const sizes = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
  xl: 'w-12 h-12 border-3'
};

export const Spinner = ({
  size = 'md',
  color = 'blue',
  className = ''
}) => {
  const colorClasses = {
    blue: 'border-blue-600',
    white: 'border-white',
    gray: 'border-gray-600',
    violet: 'border-violet-600'
  };

  return (
    <div
      className={`
        rounded-full border-t-transparent animate-spin
        ${sizes[size]}
        ${colorClasses[color]}
        ${className}
      `}
    />
  );
};

export const LoadingOverlay = ({ message = 'Cargando...' }) => (
  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
    <div className="flex flex-col items-center gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-gray-500 font-medium">{message}</p>
    </div>
  </div>
);

export const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <Spinner size="lg" />
  </div>
);

export const InlineLoader = ({ text = 'Cargando' }) => (
  <span className="inline-flex items-center gap-2 text-sm text-gray-500">
    <Spinner size="sm" />
    {text}...
  </span>
);

export default Spinner;

