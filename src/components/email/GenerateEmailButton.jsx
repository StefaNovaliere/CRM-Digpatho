// src/components/email/GenerateEmailButton.jsx
import { useState } from 'react';
import { Sparkles, ChevronDown, Mail, UserPlus, RefreshCw } from 'lucide-react';
import { useEmailGeneration } from '../../hooks/useEmailGeneration';
import { EmailDraftModal } from './EmailDraftModal';

export const GenerateEmailButton = ({
  contact,
  variant = 'default',
  size = 'md',
  className = ''
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { generateEmail, isGenerating, generatedDraft, clearDraft, error } = useEmailGeneration();

  const handleGenerate = async (type = 'follow-up') => {
    setShowDropdown(false);
    await generateEmail(contact.id, type);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    clearDraft();
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-5 py-2.5 text-lg'
  };

  const variants = {
    default: 'bg-violet-600 text-white hover:bg-violet-700',
    outline: 'border-2 border-violet-600 text-violet-600 hover:bg-violet-50',
    ghost: 'text-violet-600 hover:bg-violet-50'
  };

  // Botón simple sin dropdown
  if (!showDropdown) {
    return (
      <>
        <button
          onClick={() => handleGenerate('follow-up')}
          disabled={isGenerating}
          className={`
            inline-flex items-center justify-center gap-2 font-medium rounded-lg
            transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-[0.98]
            ${variants[variant]}
            ${sizes[size]}
            ${className}
          `}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Sparkles size={size === 'sm' ? 14 : 18} />
              Generar Email
            </>
          )}
        </button>

        <EmailDraftModal
          isOpen={showModal}
          onClose={handleCloseModal}
          contact={contact}
          draft={generatedDraft}
          isLoading={isGenerating}
          error={error}
          onRegenerate={() => handleGenerate('follow-up')}
        />
      </>
    );
  }

  // Botón con dropdown para elegir tipo de email
  return (
    <>
      <div className="relative">
        <div className="flex">
          <button
            onClick={() => handleGenerate('follow-up')}
            disabled={isGenerating}
            className={`
              inline-flex items-center gap-2 font-medium rounded-l-lg
              transition-all disabled:opacity-50
              ${variants[variant]}
              ${sizes[size]}
            `}
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Generar Email
          </button>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={isGenerating}
            className={`
              px-2 border-l border-white/20 rounded-r-lg
              ${variants[variant]}
            `}
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
            <button
              onClick={() => handleGenerate('follow-up')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={16} className="text-gray-400" />
              Follow-up
            </button>
            <button
              onClick={() => handleGenerate('first-contact')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <UserPlus size={16} className="text-gray-400" />
              Primer Contacto
            </button>
            <button
              onClick={() => handleGenerate('post-meeting')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Mail size={16} className="text-gray-400" />
              Post-Reunión
            </button>
          </div>
        )}
      </div>

      <EmailDraftModal
        isOpen={showModal}
        onClose={handleCloseModal}
        contact={contact}
        draft={generatedDraft}
        isLoading={isGenerating}
        error={error}
        onRegenerate={() => handleGenerate('follow-up')}
      />
    </>
  );
};

export default GenerateEmailButton;

