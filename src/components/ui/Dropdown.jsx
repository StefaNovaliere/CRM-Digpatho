// src/components/ui/Dropdown.jsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export const Dropdown = ({
  trigger,
  children,
  align = 'left',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const alignClasses = {
    left: 'left-0',
    right: 'right-0',
    center: 'left-1/2 -translate-x-1/2'
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`
            absolute z-50 mt-2 min-w-[200px] py-1 bg-white rounded-xl shadow-lg
            border border-gray-200 animate-in fade-in slide-in-from-top-2 duration-150
            ${alignClasses[align]}
          `}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const DropdownItem = ({
  children,
  icon: Icon,
  selected = false,
  danger = false,
  disabled = false,
  onClick
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${danger
          ? 'text-red-600 hover:bg-red-50'
          : selected
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-50'
        }
      `}
    >
      {Icon && <Icon size={16} className="opacity-70" />}
      <span className="flex-1">{children}</span>
      {selected && <Check size={16} className="text-blue-600" />}
    </button>
  );
};

export const DropdownDivider = () => (
  <div className="my-1 border-t border-gray-100" />
);

export const DropdownLabel = ({ children }) => (
  <div className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
    {children}
  </div>
);

// Select Dropdown (para formularios)
export const SelectDropdown = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-left hover:border-gray-400 transition-colors"
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full py-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto">
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center justify-between px-4 py-2 text-sm text-left
                ${option.value === value ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}
              `}
            >
              {option.label}
              {option.value === value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;

