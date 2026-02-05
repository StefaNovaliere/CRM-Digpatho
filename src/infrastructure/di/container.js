/**
 * Dependency Injection Container
 *
 * Central registry that connects domain interfaces with concrete implementations.
 * If you switch from Supabase to PostgreSQL, you only change the bindings here.
 *
 * Usage in components:
 *   import { container } from '@/infrastructure/di/container';
 *   const contactRepo = container.get('contactRepository');
 */

class DIContainer {
  constructor() {
    this._registry = new Map();
    this._singletons = new Map();
  }

  /**
   * Register a factory function for a dependency.
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function that creates the instance
   * @param {object} options - { singleton: true } to cache the instance
   */
  register(name, factory, { singleton = false } = {}) {
    this._registry.set(name, { factory, singleton });
    // Clear cached singleton if re-registering
    if (this._singletons.has(name)) {
      this._singletons.delete(name);
    }
  }

  /**
   * Resolve a dependency by name.
   * @param {string} name - Dependency name
   * @returns {*} The resolved instance
   */
  get(name) {
    const entry = this._registry.get(name);
    if (!entry) {
      throw new Error(`[DI] Dependency "${name}" is not registered. Check container.js bindings.`);
    }

    if (entry.singleton) {
      if (!this._singletons.has(name)) {
        this._singletons.set(name, entry.factory());
      }
      return this._singletons.get(name);
    }

    return entry.factory();
  }

  /**
   * Check if a dependency is registered.
   */
  has(name) {
    return this._registry.has(name);
  }
}

// Singleton container instance
export const container = new DIContainer();

export default container;
