// src/components/interactions/InteractionTimeline.jsx
import { useState } from 'react';
import { MessageSquare, Plus, Clock, Filter } from 'lucide-react';
import { InteractionItem } from './InteractionItem';
import { AddInteractionModal } from './AddInteractionModal';

export const InteractionTimeline = ({
  interactions = [],
  contactId,
  onInteractionAdded,
  onInteractionDeleted,
  showHeader = true,
  maxItems = null,
  allowAdd = true,
  allowFilter = true
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType] = useState('all');

  const filteredInteractions = filterType === 'all'
    ? interactions
    : interactions.filter(i => i.type === filterType);

  const displayInteractions = maxItems
    ? filteredInteractions.slice(0, maxItems)
    : filteredInteractions;

  const interactionTypes = [
    { value: 'all', label: 'Todas' },
    { value: 'email_sent', label: 'Emails' },
    { value: 'meeting', label: 'Reuniones' },
    { value: 'call', label: 'Llamadas' },
    { value: 'note', label: 'Notas' }
  ];

  const handleDelete = async (interaction) => {
    if (!window.confirm('¿Eliminar esta interacción?')) return;
    onInteractionDeleted?.(interaction);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {showHeader && (
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={20} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900">Historial</h2>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                {interactions.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {allowFilter && interactions.length > 0 && (
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                >
                  {interactionTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              )}

              {allowAdd && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  <Plus size={16} />
                  Agregar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-5">
        {displayInteractions.length > 0 ? (
          <div>
            {displayInteractions.map(interaction => (
              <InteractionItem
                key={interaction.id}
                interaction={interaction}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Sin interacciones</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddInteractionModal
          contactId={contactId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            onInteractionAdded?.();
          }}
        />
      )}
    </div>
  );
};

export const InteractionTimelineCompact = ({ interactions = [], maxItems = 3 }) => {
  const recent = interactions.slice(0, maxItems);

  if (recent.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">Sin interacciones</p>;
  }

  return (
    <div className="space-y-1">
      {recent.map(interaction => (
        <InteractionItem key={interaction.id} interaction={interaction} compact showActions={false} />
      ))}
    </div>
  );
};

export default InteractionTimeline;
