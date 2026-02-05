/**
 * BACKWARD COMPATIBILITY REDIRECT
 * New code should use: container.get('resendClient') via useRepository hook.
 */
import { container } from '../infrastructure/di/container';

export const sendEmail = async (params) => {
  const client = container.get('resendClient');
  return client.sendEmail(params);
};

export default { sendEmail };
