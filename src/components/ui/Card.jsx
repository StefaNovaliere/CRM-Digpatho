// src/components/ui/Card.jsx
import { forwardRef } from 'react';

export const Card = forwardRef(({
  children,
  className = '',
  padding = true,
  hover = false,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={`
        bg-white border border-gray-200 rounded-xl shadow-sm
        ${hover ? 'hover:shadow-md hover:border-gray-300 transition-all cursor-pointer' : ''}
        ${padding ? 'p-5' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export const CardHeader = ({ children, className = '' }) => (
  <div className={`pb-4 border-b border-gray-100 ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`font-semibold text-gray-900 ${className}`}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-gray-500 mt-1 ${className}`}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={`pt-4 ${className}`}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '' }) => (
  <div className={`pt-4 border-t border-gray-100 ${className}`}>
    {children}
  </div>
);

export default Card;

