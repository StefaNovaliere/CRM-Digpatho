/**
 * useGmail hook - refactored to use repository pattern.
 */
import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useRepository } from './useRepository';

export const useGmail = () => {
  const { user, profile, refreshProfile } = useAuth();
  const gmailClient = useRepository('gmailClient');
  const interactionRepo = useRepository('interactionRepository');
  const notificationRepo = useRepository('notificationRepository');
  const contactRepo = useRepository('contactRepository');
  const emailDraftRepo = useRepository('emailDraftRepository');
  const profileRepo = useRepository('userProfileRepository');

  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const getValidAccessToken = async () => {
    if (!profile) throw new Error('No hay perfil de usuario.');

    if (profile.google_access_token && profile.google_token_expires_at) {
      const expiresAt = new Date(profile.google_token_expires_at);
      if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
        return profile.google_access_token;
      }
    }

    if (!profile.google_refresh_token) throw new Error('Sesión de Google caducada.');

    const tokenData = await gmailClient.refreshAccessToken(profile.google_refresh_token);
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (tokenData.expires_in || 3600));

    await profileRepo.update(user.id, {
      google_access_token: tokenData.access_token,
      google_token_expires_at: newExpiresAt.toISOString()
    });

    if (refreshProfile) await refreshProfile();
    return tokenData.access_token;
  };

  const sendEmail = async ({ to, cc, subject, body, attachments, draftId = null }) => {
    setSending(true);
    setError(null);

    try {
      const accessToken = await getValidAccessToken();

      const mimeEmail = gmailClient.buildMimeEmail({
        from: user?.email || profile?.email,
        fromName: profile?.full_name || 'Digpatho IA',
        to, cc, subject, body,
        signature: profile?.email_signature || '',
        attachments
      });

      const encodedEmail = gmailClient.encodeForGmail(mimeEmail);
      const result = await gmailClient.sendEmail(accessToken, encodedEmail);

      // Update draft and create interaction
      if (draftId) {
        await emailDraftRepo.update(draftId, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_by: user.id
        });

        let interactionContent = body;
        if (cc && cc.length > 0) {
          const ccStr = Array.isArray(cc) ? cc.join(', ') : cc;
          interactionContent = `[CC: ${ccStr}]\n\n${interactionContent}`;
        }
        if (attachments && attachments.length > 0) {
          const attachmentNames = attachments.map(a => a.name).join(', ');
          interactionContent += `\n\n[Adjuntos: ${attachmentNames}]`;
        }

        // Get contact_id from draft
        const drafts = await emailDraftRepo.getByContactId(null); // We need the draft's contact_id
        // Simpler: query by draftId
        try {
          await interactionRepo.create({
            contact_id: draftId ? (await getDraftContactId(draftId)) : null,
            type: 'email_sent',
            subject,
            content: interactionContent,
            direction: 'outbound',
            occurred_at: new Date().toISOString(),
            email_draft_id: draftId,
            created_by: user.id,
            thread_id: result.threadId,
            gmail_id: result.id
          });
        } catch (interactionErr) {
          console.warn('Error creating interaction:', interactionErr);
        }
      }

      return { success: true, messageId: result.id, threadId: result.threadId };
    } catch (err) {
      console.error('Error sending email:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setSending(false);
    }
  };

  // Helper to get contact_id from a draft
  const getDraftContactId = async (draftId) => {
    try {
      // Use supabase client directly for this one-off query
      const supabase = useRepository('supabaseClient');
      const { data } = await supabase
        .from('email_drafts')
        .select('contact_id')
        .eq('id', draftId)
        .single();
      return data?.contact_id;
    } catch {
      return null;
    }
  };

  const checkContactReplies = useCallback(async (contactId) => {
    if (!contactId || !user) return;
    setSyncing(true);

    try {
      const contact = await contactRepo.getById(contactId);
      const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Un contacto';

      const threadIds = await interactionRepo.getThreadIds(contactId);
      if (!threadIds || threadIds.length === 0) {
        setSyncing(false);
        return;
      }

      const accessToken = await getValidAccessToken();
      let newRepliesCount = 0;

      for (const threadId of threadIds) {
        const threadData = await gmailClient.getThread(accessToken, threadId);
        if (!threadData?.messages) continue;

        for (const msg of threadData.messages) {
          const exists = await interactionRepo.existsByGmailId(msg.id);
          if (exists) continue;

          const isSentByMe = msg.labelIds?.includes('SENT');
          const headers = msg.payload?.headers || [];
          const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');
          const msgDate = dateHeader ? new Date(dateHeader.value) : new Date();
          const fullBody = gmailClient.extractMessageBody(msg.payload);
          const content = fullBody || msg.snippet || '';
          const msgSubject = gmailClient.extractSubject(headers);

          await interactionRepo.create({
            contact_id: contactId,
            type: isSentByMe ? 'email_sent' : 'email_reply',
            subject: msgSubject,
            content,
            direction: isSentByMe ? 'outbound' : 'inbound',
            occurred_at: msgDate.toISOString(),
            created_by: user.id,
            thread_id: threadId,
            gmail_id: msg.id
          });

          if (!isSentByMe) {
            newRepliesCount++;
            await notificationRepo.create({
              user_id: user.id,
              type: 'email_reply',
              title: `Respuesta de ${contactName}`,
              message: msg.snippet ? msg.snippet.substring(0, 80) + '...' : 'Tienes un nuevo correo.',
              link: `/contacts/${contactId}`,
              is_read: false
            });
          }
        }
      }

      return { success: true, newReplies: newRepliesCount };
    } catch (err) {
      console.error('Error sync replies:', err);
      return { success: false, error: err.message };
    } finally {
      setSyncing(false);
    }
  }, [user, contactRepo, interactionRepo, notificationRepo, gmailClient]);

  const openInGmail = ({ to, cc, subject, body }) => {
    const signature = profile?.email_signature ? `\n\n--\n${profile.email_signature}` : '';
    const fullBody = body + signature;
    const gmailUrl = new URL('https://mail.google.com/mail/');
    gmailUrl.searchParams.set('view', 'cm');
    gmailUrl.searchParams.set('to', to);
    if (cc) gmailUrl.searchParams.set('cc', Array.isArray(cc) ? cc.join(',') : cc);
    gmailUrl.searchParams.set('su', subject);
    gmailUrl.searchParams.set('body', fullBody);
    window.open(gmailUrl.toString(), '_blank');
  };

  const copyToClipboard = async ({ subject, body }) => {
    const signature = profile?.email_signature ? `\n\n--\n${profile.email_signature}` : '';
    const fullText = `Asunto: ${subject}\n\n${body}${signature}`;
    try {
      await navigator.clipboard.writeText(fullText);
      return true;
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      return false;
    }
  };

  return {
    sendEmail,
    checkContactReplies,
    openInGmail,
    copyToClipboard,
    sending,
    syncing,
    error,
    hasGmailAccess: !!profile?.google_access_token,
    userEmail: user?.email || profile?.email
  };
};

export default useGmail;
