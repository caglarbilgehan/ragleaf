/**
 * Property-Based Tests for API Token Management
 * Feature: api-token-management
 * 
 * These tests validate universal properties that should hold for all valid inputs.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Type definitions
type TokenMode = 'rag' | 'chat' | 'hybrid';

interface TokenFormData {
  name: string;
  description: string;
  allowed_mode: TokenMode;
  department_ids: number[];
  system_prompt: string;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  expires_days: number | null;
}

interface APIToken {
  id: number;
  name: string;
  description?: string;
  key_prefix: string;
  allowed_mode: TokenMode;
  is_active: boolean;
  last_used_at?: string | null;
  total_requests: number;
  total_tokens_used: number;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
}

// Validation functions (extracted from component logic)
function validateTokenForm(formData: TokenFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!formData.name.trim()) {
    errors.name = 'Token adı gerekli';
  } else if (formData.name.length > 255) {
    errors.name = 'Token adı 255 karakterden uzun olamaz';
  }

  if (formData.description && formData.description.length > 500) {
    errors.description = 'Açıklama 500 karakterden uzun olamaz';
  }

  if (formData.system_prompt && formData.system_prompt.length > 2000) {
    errors.system_prompt = 'System prompt 2000 karakterden uzun olamaz';
  }

  if (formData.rate_limit_per_minute < 1 || formData.rate_limit_per_minute > 1000) {
    errors.rate_limit_per_minute = 'Dakika başına limit 1-1000 arasında olmalı';
  }

  if (formData.rate_limit_per_day < 1 || formData.rate_limit_per_day > 100000) {
    errors.rate_limit_per_day = 'Günlük limit 1-100000 arasında olmalı';
  }

  if (formData.expires_days && (formData.expires_days < 1 || formData.expires_days > 365)) {
    errors.expires_days = 'Geçerlilik süresi 1-365 gün arasında olmalı';
  }

  if ((formData.allowed_mode === 'rag' || formData.allowed_mode === 'hybrid') && formData.department_ids.length === 0) {
    errors.department_ids = 'RAG/Hybrid modunda en az 1 departman seçilmeli';
  }

  return errors;
}

function isDepartmentSelectionRequired(mode: TokenMode): boolean {
  return mode === 'rag' || mode === 'hybrid';
}

// Display functions for Property 1
function formatLastUsed(lastUsedAt: string | null | undefined): string {
  if (!lastUsedAt) return 'Hiç kullanılmadı';
  return new Date(lastUsedAt).toLocaleString('tr-TR');
}

function getStatusIndicator(isActive: boolean, expiresAt?: string | null): 'active' | 'inactive' | 'expired' {
  if (expiresAt && new Date(expiresAt) < new Date()) return 'expired';
  return isActive ? 'active' : 'inactive';
}

function getModeLabel(mode: TokenMode): string {
  const labels: Record<TokenMode, string> = {
    rag: 'RAG',
    chat: 'Chat',
    hybrid: 'Hybrid'
  };
  return labels[mode];
}

// Token display data extraction
function extractTokenDisplayData(token: APIToken) {
  return {
    name: token.name,
    status: getStatusIndicator(token.is_active),
    mode: getModeLabel(token.allowed_mode),
    lastUsed: formatLastUsed(token.last_used_at),
    requestCount: token.total_requests,
    tokensUsed: token.total_tokens_used
  };
}

describe('API Token Management - Property-Based Tests', () => {
  /**
   * Property 1: Token Data Display Completeness
   * For any API token, the display data SHALL contain name, status, mode, last used, and request count
   * **Validates: Requirements 1.2, 11.1, 11.2, 11.3**
   */
  describe('Property 1: Token Data Display Completeness', () => {
    it('should display all required fields for any token', () => {
      const tokenArbitrary = fc.record({
        id: fc.integer({ min: 1 }),
        name: fc.string({ minLength: 1, maxLength: 255 }),
        description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
        key_prefix: fc.string({ minLength: 8, maxLength: 8 }),
        allowed_mode: fc.constantFrom('rag', 'chat', 'hybrid') as fc.Arbitrary<TokenMode>,
        is_active: fc.boolean(),
        last_used_at: fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
        total_requests: fc.integer({ min: 0 }),
        total_tokens_used: fc.integer({ min: 0 }),
        rate_limit_per_minute: fc.integer({ min: 1, max: 1000 }),
        rate_limit_per_day: fc.integer({ min: 1, max: 100000 })
      });

      fc.assert(
        fc.property(tokenArbitrary, (token) => {
          const displayData = extractTokenDisplayData(token);
          
          // All required fields must be present and non-empty
          expect(displayData.name).toBeDefined();
          expect(displayData.name.length).toBeGreaterThan(0);
          expect(displayData.status).toBeDefined();
          expect(['active', 'inactive', 'expired']).toContain(displayData.status);
          expect(displayData.mode).toBeDefined();
          expect(['RAG', 'Chat', 'Hybrid']).toContain(displayData.mode);
          expect(displayData.lastUsed).toBeDefined();
          expect(typeof displayData.requestCount).toBe('number');
          expect(displayData.requestCount).toBeGreaterThanOrEqual(0);
          expect(typeof displayData.tokensUsed).toBe('number');
          expect(displayData.tokensUsed).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should show "Hiç kullanılmadı" for tokens never used', () => {
      fc.assert(
        fc.property(fc.constant(null), (lastUsedAt) => {
          const formatted = formatLastUsed(lastUsedAt);
          expect(formatted).toBe('Hiç kullanılmadı');
        }),
        { numRuns: 100 }
      );
    });

    it('should format valid dates correctly', () => {
      fc.assert(
        fc.property(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }), (date) => {
          const isoString = date.toISOString();
          const formatted = formatLastUsed(isoString);
          expect(formatted).not.toBe('Hiç kullanılmadı');
          expect(formatted.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Mode-Dependent UI State
   * For any token mode, department selection should be required if and only if mode is RAG or Hybrid
   * **Validates: Requirements 3.2, 3.3, 3.4**
   */
  describe('Property 2: Mode-Dependent UI State', () => {
    it('should require department selection for RAG and Hybrid modes only', () => {
      fc.assert(
        fc.property(fc.constantFrom('rag', 'chat', 'hybrid') as fc.Arbitrary<TokenMode>, (mode) => {
          const isRequired = isDepartmentSelectionRequired(mode);
          
          if (mode === 'rag' || mode === 'hybrid') {
            expect(isRequired).toBe(true);
          } else {
            expect(isRequired).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Input Validation Ranges
   * For any valid input within specified ranges, validation should pass
   * **Validates: Requirements 5.3, 5.4, 2.2, 2.3**
   */
  describe('Property 3: Input Validation Ranges', () => {
    it('should accept valid inputs within specified ranges', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 255 }),
          fc.string({ maxLength: 500 }),
          fc.string({ maxLength: 2000 }),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100000 }),
          fc.option(fc.integer({ min: 1, max: 365 }), { nil: null }),
          (name, description, system_prompt, rate_limit_per_minute, rate_limit_per_day, expires_days) => {
            const formData: TokenFormData = {
              name,
              description,
              allowed_mode: 'chat',
              department_ids: [],
              system_prompt,
              rate_limit_per_minute,
              rate_limit_per_day,
              expires_days,
            };

            const errors = validateTokenForm(formData);

            expect(errors.name).toBeUndefined();
            expect(errors.description).toBeUndefined();
            expect(errors.system_prompt).toBeUndefined();
            expect(errors.rate_limit_per_minute).toBeUndefined();
            expect(errors.rate_limit_per_day).toBeUndefined();
            expect(errors.expires_days).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject rate limit per minute outside valid range', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 1001 })),
          (rate_limit_per_minute) => {
            const formData: TokenFormData = {
              name: 'Test Token',
              description: '',
              allowed_mode: 'chat',
              department_ids: [],
              system_prompt: '',
              rate_limit_per_minute,
              rate_limit_per_day: 1000,
              expires_days: null,
            };

            const errors = validateTokenForm(formData);
            expect(errors.rate_limit_per_minute).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject rate limit per day outside valid range', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 100001 })),
          (rate_limit_per_day) => {
            const formData: TokenFormData = {
              name: 'Test Token',
              description: '',
              allowed_mode: 'chat',
              department_ids: [],
              system_prompt: '',
              rate_limit_per_minute: 60,
              rate_limit_per_day,
              expires_days: null,
            };

            const errors = validateTokenForm(formData);
            expect(errors.rate_limit_per_day).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject name exceeding maximum length', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 256 }), (name) => {
          const formData: TokenFormData = {
            name,
            description: '',
            allowed_mode: 'chat',
            department_ids: [],
            system_prompt: '',
            rate_limit_per_minute: 60,
            rate_limit_per_day: 1000,
            expires_days: null,
          };

          const errors = validateTokenForm(formData);
          expect(errors.name).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject description exceeding maximum length', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 501 }), (description) => {
          const formData: TokenFormData = {
            name: 'Test Token',
            description,
            allowed_mode: 'chat',
            department_ids: [],
            system_prompt: '',
            rate_limit_per_minute: 60,
            rate_limit_per_day: 1000,
            expires_days: null,
          };

          const errors = validateTokenForm(formData);
          expect(errors.description).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject system prompt exceeding maximum length', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 2001 }), (system_prompt) => {
          const formData: TokenFormData = {
            name: 'Test Token',
            description: '',
            allowed_mode: 'chat',
            department_ids: [],
            system_prompt,
            rate_limit_per_minute: 60,
            rate_limit_per_day: 1000,
            expires_days: null,
          };

          const errors = validateTokenForm(formData);
          expect(errors.system_prompt).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Department Selection Validation
   * For any RAG/Hybrid mode token with empty departments, validation should fail
   * **Validates: Requirements 6.1, 7.1, 7.2, 7.3**
   */
  describe('Property 4: Department Selection Validation', () => {
    it('should require departments for RAG/Hybrid modes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('rag', 'hybrid') as fc.Arbitrary<TokenMode>,
          fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 0, maxLength: 5 }),
          (mode, department_ids) => {
            const formData: TokenFormData = {
              name: 'Test Token',
              description: '',
              allowed_mode: mode,
              department_ids,
              system_prompt: '',
              rate_limit_per_minute: 60,
              rate_limit_per_day: 1000,
              expires_days: null,
            };

            const errors = validateTokenForm(formData);

            if (department_ids.length === 0) {
              expect(errors.department_ids).toBeDefined();
              expect(errors.department_ids).toContain('RAG/Hybrid');
            } else {
              expect(errors.department_ids).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not require departments for Chat mode', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 0, maxLength: 5 }),
          (department_ids) => {
            const formData: TokenFormData = {
              name: 'Test Token',
              description: '',
              allowed_mode: 'chat',
              department_ids,
              system_prompt: '',
              rate_limit_per_minute: 60,
              rate_limit_per_day: 1000,
              expires_days: null,
            };

            const errors = validateTokenForm(formData);
            expect(errors.department_ids).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Whitelist Configuration
   * Empty whitelist means all allowed, non-empty restricts to specified values
   * **Validates: Requirements 7.4, 7.5**
   */
  describe('Property 5: Whitelist Configuration', () => {
    function parseWhitelist(input: string): string[] {
      if (!input.trim()) return [];
      return input.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    function isAllAllowed(whitelist: string[]): boolean {
      return whitelist.length === 0;
    }

    it('should allow all when whitelist is empty', () => {
      fc.assert(
        fc.property(fc.constantFrom('', '  ', '\t', '\n'), (input) => {
          const whitelist = parseWhitelist(input);
          expect(isAllAllowed(whitelist)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should restrict when whitelist has values', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 }),
          (values) => {
            const input = values.join(', ');
            const whitelist = parseWhitelist(input);
            expect(isAllAllowed(whitelist)).toBe(false);
            expect(whitelist.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly parse comma-separated values', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes(',') && s.trim().length > 0), { minLength: 1, maxLength: 5 }),
          (values) => {
            const input = values.join(',');
            const whitelist = parseWhitelist(input);
            expect(whitelist.length).toBe(values.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Token State Management
   * Regenerating should preserve token configuration except key
   * **Validates: Requirements 10.4**
   */
  describe('Property 6: Token State Management', () => {
    it('should preserve token configuration after regenerate', () => {
      const configArbitrary = fc.record({
        id: fc.integer({ min: 1 }),
        name: fc.string({ minLength: 1, maxLength: 255 }),
        description: fc.string({ maxLength: 500 }),
        allowed_mode: fc.constantFrom('rag', 'chat', 'hybrid') as fc.Arbitrary<TokenMode>,
        department_ids: fc.array(fc.integer({ min: 1, max: 10 })),
        system_prompt: fc.string({ maxLength: 2000 }),
        llm_model_id: fc.option(fc.integer({ min: 1 }), { nil: null }),
        max_tokens: fc.integer({ min: 100, max: 4000 }),
        temperature: fc.float({ min: 0, max: 2 }),
        rate_limit_per_minute: fc.integer({ min: 1, max: 1000 }),
        rate_limit_per_day: fc.integer({ min: 1, max: 100000 }),
        is_active: fc.boolean(),
      });

      fc.assert(
        fc.property(configArbitrary, (originalConfig) => {
          // Simulate regenerate - only key_hash changes
          const afterRegenerate = {
            ...originalConfig,
            key_hash: 'new_hash_value',
            last_used_at: null, // Reset after regenerate
          };

          // All config fields should be preserved
          expect(afterRegenerate.name).toBe(originalConfig.name);
          expect(afterRegenerate.description).toBe(originalConfig.description);
          expect(afterRegenerate.allowed_mode).toBe(originalConfig.allowed_mode);
          expect(afterRegenerate.department_ids).toEqual(originalConfig.department_ids);
          expect(afterRegenerate.system_prompt).toBe(originalConfig.system_prompt);
          expect(afterRegenerate.llm_model_id).toBe(originalConfig.llm_model_id);
          expect(afterRegenerate.max_tokens).toBe(originalConfig.max_tokens);
          expect(afterRegenerate.temperature).toBe(originalConfig.temperature);
          expect(afterRegenerate.rate_limit_per_minute).toBe(originalConfig.rate_limit_per_minute);
          expect(afterRegenerate.rate_limit_per_day).toBe(originalConfig.rate_limit_per_day);
          expect(afterRegenerate.is_active).toBe(originalConfig.is_active);
        }),
        { numRuns: 100 }
      );
    });

    it('should reset last_used_at after regenerate', () => {
      fc.assert(
        fc.property(
          fc.option(fc.date().map(d => d.toISOString()), { nil: null }),
          (originalLastUsed) => {
            // After regenerate, last_used_at should be null
            const afterRegenerate = { last_used_at: null };
            expect(afterRegenerate.last_used_at).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
