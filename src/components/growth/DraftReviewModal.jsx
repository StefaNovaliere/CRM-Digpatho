// src/components/growth/DraftReviewModal.jsx
// Modal para revisar, aprobar o rechazar borradores de email
// generados por el Growth System (ai_growth_system.py).

import { useState } from 'react';
import {
  X,
  Check,
  XCircle,
  ExternalLink,
  Copy,
  Mail,
  Building2,
  Briefcase,
  Globe,
  MessageSquare,
  AtSign
} from 'lucide-react';
import { GROWTH_VERTICALS } from '../../config/constants';

const verticalColors = {
  DIRECT_B2B: 'from-blue-500 to-cyan-500',
  PHARMA: 'from-violet-500 to-purple-500',
  INFLUENCER: 'from-amber-500 to-orange-500',
  EVENTS: 'from-emerald-500 to-teal-500',
};

export const DraftReviewModal = ({ draft, onClose, onApprove, onReject }) => {
  const [notes, setNotes] = useState(draft?.reviewer_notes || '');
  const [copied, setCopied] = useState(false);

  if (!draft) return null;

  const lead = draft.lead || {};
  const verticalConfig = GROWTH_VERTICALS[draft.vertical] || {};
  const gradientClass = verticalColors[draft.vertical] || 'from-gray-500 to-gray-600';

  const handleApprove = () => {
    onApprove(draft.id, notes);
  };

  const handleReject = () => {
    onReject(draft.id, notes);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Asunto: ${draft.subject}\n\n${draft.body}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">

          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${gradientClass}`}>
            <div className="flex items-center gap-3 text-white">
              <Mail className="w-5 h-5" />
              <div>
                <h2 className="font-semibold">Revisar Borrador — {verticalConfig.label}</h2>
                <p className="text-sm text-white/80">
                  Para: {lead.full_name || '[Sin nombre]'}
                  {lead.company ? ` — ${lead.company}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 rounded-lg hover:bg-white/20 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5">

            {/* Lead Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Empresa:</span>
                <span className="font-medium text-gray-900">{lead.company || '[EMPRESA]'}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                <Briefcase className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Cargo:</span>
                <span className="font-medium text-gray-900">{lead.job_title || '[CARGO]'}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                <Globe className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Geo:</span>
                <span className="font-medium text-gray-900">{lead.geo || 'Global'}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Idioma:</span>
                <span className="font-medium text-gray-900">
                  {{ en: 'English', es: 'Español', pt: 'Português' }[draft.language] || draft.language}
                </span>
              </div>
            </div>

            {/* Email */}
            {lead.email && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl text-sm">
                <AtSign className="w-4 h-4 text-blue-500" />
                <span className="text-gray-500">Email:</span>
                <a
                  href={`mailto:${lead.email}`}
                  className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {lead.email}
                </a>
              </div>
            )}

            {/* LinkedIn */}
            {lead.linkedin_url && (
              <a
                href={lead.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Ver perfil en LinkedIn
              </a>
            )}

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
              <div className="p-3 bg-gray-50 rounded-xl text-gray-900 font-medium">
                {draft.subject}
              </div>
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo del email</label>
              <div className="p-4 bg-gray-50 rounded-xl text-gray-900 whitespace-pre-wrap max-h-72 overflow-y-auto text-sm leading-relaxed">
                {draft.body}
              </div>
            </div>

            {/* Generation context */}
            {draft.generation_context?.tone && (
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>Tono: {draft.generation_context.tone.slice(0, 50)}</span>
                {draft.generation_context.cta && (
                  <>
                    <span>|</span>
                    <span>CTA: {draft.generation_context.cta}</span>
                  </>
                )}
              </div>
            )}

            {/* Reviewer Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas del revisor (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ej: Ajustar el subject, verificar nombre del contacto..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReject}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Rechazar
              </button>
              <button
                onClick={handleApprove}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg transition-colors shadow-sm"
              >
                <Check className="w-4 h-4" />
                Aprobar borrador
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraftReviewModal;
