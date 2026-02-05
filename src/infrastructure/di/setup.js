/**
 * DI Container Setup
 *
 * Binds concrete implementations to repository interfaces.
 * This is the ONLY file that knows about both domain interfaces AND concrete implementations.
 *
 * TO SWITCH FROM SUPABASE TO ANOTHER DB:
 * 1. Create new implementations in src/data/postgres/ (or wherever)
 * 2. Change the imports and bindings below
 * 3. Everything else stays the same
 */
import { container } from './container';

// Supabase client
import { getSupabaseClient } from '../../data/supabase/client';

// Supabase repository implementations
import { SupabaseContactRepository } from '../../data/supabase/SupabaseContactRepository';
import { SupabaseInstitutionRepository } from '../../data/supabase/SupabaseInstitutionRepository';
import { SupabaseInteractionRepository } from '../../data/supabase/SupabaseInteractionRepository';
import { SupabaseEmailDraftRepository } from '../../data/supabase/SupabaseEmailDraftRepository';
import { SupabaseUserProfileRepository } from '../../data/supabase/SupabaseUserProfileRepository';
import { SupabaseAuthRepository } from '../../data/supabase/SupabaseAuthRepository';
import { SupabaseNotificationRepository } from '../../data/supabase/SupabaseNotificationRepository';
import { SupabaseBulkEmailRepository } from '../../data/supabase/SupabaseBulkEmailRepository';

// External service clients
import { AnthropicClient } from '../../data/external/AnthropicClient';
import { GmailClient } from '../../data/external/GmailClient';
import { ResendClient } from '../../data/external/ResendClient';

// Domain services
import { ContactService } from '../../domain/services/ContactService';
import { EmailService } from '../../domain/services/EmailService';
import { InteractionService } from '../../domain/services/InteractionService';

export function setupDI() {
  // Database client (singleton)
  container.register('supabaseClient', () => getSupabaseClient(), { singleton: true });

  // Repositories (singletons - one instance per repo)
  container.register('contactRepository', () =>
    new SupabaseContactRepository(container.get('supabaseClient')),
    { singleton: true }
  );

  container.register('institutionRepository', () =>
    new SupabaseInstitutionRepository(container.get('supabaseClient')),
    { singleton: true }
  );

  container.register('interactionRepository', () =>
    new SupabaseInteractionRepository(container.get('supabaseClient')),
    { singleton: true }
  );

  container.register('emailDraftRepository', () =>
    new SupabaseEmailDraftRepository(container.get('supabaseClient')),
    { singleton: true }
  );

  container.register('userProfileRepository', () =>
    new SupabaseUserProfileRepository(container.get('supabaseClient')),
    { singleton: true }
  );

  container.register('authRepository', () =>
    new SupabaseAuthRepository(container.get('supabaseClient')),
    { singleton: true }
  );

  container.register('notificationRepository', () =>
    new SupabaseNotificationRepository(container.get('supabaseClient')),
    { singleton: true }
  );

  container.register('bulkEmailRepository', () =>
    new SupabaseBulkEmailRepository(container.get('supabaseClient')),
    { singleton: true }
  );

  // External clients (singletons)
  container.register('anthropicClient', () =>
    new AnthropicClient(container.get('supabaseClient')),
    { singleton: true }
  );

  container.register('gmailClient', () =>
    new GmailClient(),
    { singleton: true }
  );

  container.register('resendClient', () =>
    new ResendClient(),
    { singleton: true }
  );

  // Domain services (singletons - pure logic, no state)
  container.register('contactService', () => new ContactService(), { singleton: true });
  container.register('emailService', () => new EmailService(), { singleton: true });
  container.register('interactionService', () => new InteractionService(), { singleton: true });
}
