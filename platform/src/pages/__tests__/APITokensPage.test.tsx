import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import APITokensPage from '../APITokensPage';
import api from '../../services/api';

// Mock API
vi.mock('../../services/api');
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('APITokensPage - Token List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display all token data fields correctly', async () => {
    const mockToken = {
      id: 1,
      name: 'Test Token',
      description: 'Test Description',
      key_prefix: 'live_',
      key_preview: 'mk_live_1234567890abcdef',
      allowed_mode: 'rag',
      department_ids: [1, 2],
      system_prompt: 'Test prompt',
      llm_model_id: 1,
      llm_model_name: 'GPT-4',
      max_tokens: 1000,
      temperature: 0.7,
      top_k: 5,
      similarity_threshold: 0.5,
      include_sources: true,
      include_images: true,
      default_language: 'tr',
      allowed_languages: ['tr', 'en'],
      permissions: ['chat:read'],
      ip_whitelist: [],
      allowed_origins: [],
      rate_limit_per_minute: 60,
      rate_limit_per_day: 1000,
      is_active: true,
      last_used_at: '2024-01-01T00:00:00Z',
      expires_at: null,
      created_at: '2024-01-01T00:00:00Z',
      total_requests: 100,
      total_tokens_used: 5000,
      response_format: {},
      custom_templates: {},
      metadata: {},
    };

    vi.mocked(api.get).mockResolvedValue({
      data: [mockToken],
    });

    render(<APITokensPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Token')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
      // total_requests appears in multiple places, use getAllByText
      expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('60/dk')).toBeInTheDocument(); // rate_limit
    });
  });

  it('should show empty state when no tokens exist', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [],
    });

    render(<APITokensPage />);

    await waitFor(() => {
      expect(screen.getByText('Henüz Token Yok')).toBeInTheDocument();
      expect(screen.getByText(/İlk API token'ınızı oluşturarak başlayın/)).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<APITokensPage />);

    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });

  it('should display correct mode badges', async () => {
    const tokens = [
      { id: 1, name: 'RAG Token', allowed_mode: 'rag', is_active: true, total_requests: 0, total_tokens_used: 0 },
      { id: 2, name: 'Chat Token', allowed_mode: 'chat', is_active: true, total_requests: 0, total_tokens_used: 0 },
      { id: 3, name: 'Hybrid Token', allowed_mode: 'hybrid', is_active: true, total_requests: 0, total_tokens_used: 0 },
    ];

    vi.mocked(api.get).mockResolvedValue({
      data: tokens,
    });

    render(<APITokensPage />);

    await waitFor(() => {
      expect(screen.getByText('RAG')).toBeInTheDocument();
      expect(screen.getByText('CHAT')).toBeInTheDocument();
      expect(screen.getByText('HYBRID')).toBeInTheDocument();
    });
  });

  it('should display inactive token with correct styling', async () => {
    const inactiveToken = {
      id: 1,
      name: 'Inactive Token',
      allowed_mode: 'rag',
      is_active: false,
      total_requests: 0,
      total_tokens_used: 0,
    };

    vi.mocked(api.get).mockResolvedValue({
      data: [inactiveToken],
    });

    render(<APITokensPage />);

    await waitFor(() => {
      expect(screen.getByText('Devre Dışı')).toBeInTheDocument();
    });
  });

  it('should display expired token badge', async () => {
    const expiredToken = {
      id: 1,
      name: 'Expired Token',
      allowed_mode: 'rag',
      is_active: true,
      expires_at: '2020-01-01T00:00:00Z', // Past date
      total_requests: 0,
      total_tokens_used: 0,
    };

    vi.mocked(api.get).mockResolvedValue({
      data: [expiredToken],
    });

    render(<APITokensPage />);

    await waitFor(() => {
      expect(screen.getByText('Süresi Doldu')).toBeInTheDocument();
    });
  });

  it('should display correct stats in summary cards', async () => {
    const tokens = [
      { id: 1, name: 'Token 1', is_active: true, total_requests: 100, allowed_mode: 'rag', total_tokens_used: 0 },
      { id: 2, name: 'Token 2', is_active: true, total_requests: 200, allowed_mode: 'rag', total_tokens_used: 0 },
      { id: 3, name: 'Token 3', is_active: false, total_requests: 50, allowed_mode: 'rag', total_tokens_used: 0 },
    ];

    vi.mocked(api.get).mockResolvedValue({
      data: tokens,
    });

    render(<APITokensPage />);

    await waitFor(() => {
      // Total tokens: 3
      expect(screen.getByText('3')).toBeInTheDocument();
      // Active tokens: 2
      expect(screen.getByText('2')).toBeInTheDocument();
      // Total requests: 350
      expect(screen.getByText('350')).toBeInTheDocument();
    });
  });
});
