// src/components/ui/Badge.jsx

const variants = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  violet: 'bg-violet-100 text-violet-700',
  outline: 'border border-gray-300 text-gray-600'
};

const sizes = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm'
};

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  dotColor,
  className = ''
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColor || 'bg-current opacity-70'}`}
        />
      )}
      {children}
    </span>
  );
};

// Badges específicos para el CRM
export const InterestBadge = ({ level }) => {
  const config = {
    cold: { label: 'Frío', variant: 'default', dotColor: 'bg-slate-400' },
    warm: { label: 'Tibio', variant: 'warning', dotColor: 'bg-amber-500' },
    hot: { label: 'Caliente', variant: 'danger', dotColor: 'bg-orange-500' },
    customer: { label: 'Cliente', variant: 'success', dotColor: 'bg-green-500' },
    churned: { label: 'Ex-cliente', variant: 'danger', dotColor: 'bg-red-400' }
  };

  const { label, variant, dotColor } = config[level] || config.cold;

  return (
    <Badge variant={variant} dot dotColor={dotColor}>
      {label}
    </Badge>
  );
};

export const RoleBadge = ({ role }) => {
  const labels = {
    pathologist: 'Patólogo',
    researcher: 'Investigador',
    hospital_director: 'Director',
    lab_manager: 'Lab Manager',
    procurement: 'Compras',
    other: 'Otro'
  };

  return (
    <Badge variant="primary">
      {labels[role] || role}
    </Badge>
  );
};

export const StatusBadge = ({ status }) => {
  const config = {
    generated: { label: 'Generado', variant: 'violet' },
    edited: { label: 'Editado', variant: 'warning' },
    approved: { label: 'Aprobado', variant: 'success' },
    sent: { label: 'Enviado', variant: 'success' },
    discarded: { label: 'Descartado', variant: 'default' }
  };

  const { label, variant } = config[status] || { label: status, variant: 'default' };

  return <Badge variant={variant}>{label}</Badge>;
};

export default Badge;

