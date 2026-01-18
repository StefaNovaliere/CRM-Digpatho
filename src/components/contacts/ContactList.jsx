// src/components/contacts/ContactList.jsx
import { Users } from 'lucide-react';
import { ContactCard } from './ContactCard';

export const ContactList = ({
  contacts,
  viewMode = 'grid',
  emptyMessage = 'No se encontraron contactos',
  emptyAction,
  loading = false
}) => {
  if (loading) {
    return (
      <div className={
        viewMode === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
          : 'space-y-3'
      }>
        {[...Array(6)].map((_, i) => (
          <ContactCardSkeleton key={i} variant={viewMode === 'list' ? 'compact' : 'default'} />
        ))}
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users size={32} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          {emptyMessage}
        </h3>
        <p className="text-gray-500 mb-4">
          Prueba con otros filtros o agrega un nuevo contacto
        </p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className={
      viewMode === 'grid'
        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
        : 'space-y-3'
    }>
      {contacts.map(contact => (
        <ContactCard
          key={contact.id}
          contact={contact}
          variant={viewMode === 'list' ? 'compact' : 'default'}
        />
      ))}
    </div>
  );
};

// Skeleton para loading
const ContactCardSkeleton = ({ variant = 'default' }) => {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg animate-pulse">
        <div className="w-10 h-10 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 bg-gray-200 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
      </div>
      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-8 bg-gray-200 rounded w-28" />
      </div>
    </div>
  );
};

export default ContactList;

