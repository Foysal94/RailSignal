import { FormatRegistry } from '@sinclair/typebox';

// Register standard JSON Schema email format for TypeBox value checking
export function registerEmailFormat(): void {
  if (!FormatRegistry.Has('email')) {
    FormatRegistry.Set('email', (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  }
}

registerEmailFormat();
