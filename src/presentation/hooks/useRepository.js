/**
 * useRepository hook - provides access to the DI container from React components.
 * This is the bridge between Clean Architecture and React.
 */
import { useMemo } from 'react';
import { container } from '../../infrastructure/di/container';

/**
 * Get a dependency from the DI container.
 * Memoized so the same instance is returned across re-renders.
 *
 * @param {string} name - The dependency name (e.g., 'contactRepository')
 * @returns {*} The resolved dependency
 *
 * @example
 *   const contactRepo = useRepository('contactRepository');
 *   const contacts = await contactRepo.getAll();
 */
export function useRepository(name) {
  return useMemo(() => container.get(name), [name]);
}

export default useRepository;
