/**
 * BACKWARD COMPATIBILITY REDIRECT
 * New code should use: container.get('anthropicClient') via useRepository hook.
 */
import { container } from '../infrastructure/di/container';

export const anthropicClient = {
  generateMessage: async (systemPrompt, userMessage, options = {}) => {
    const client = container.get('anthropicClient');
    return client.generateMessage(systemPrompt, userMessage, options);
  }
};

export default anthropicClient;
