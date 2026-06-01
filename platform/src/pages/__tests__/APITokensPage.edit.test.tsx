import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('APITokensPage - Token Edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load existing token data into edit form', async () => {
    const mockToken = {
      id: 1,
      name: 'Test Token',
      description: 'Test Description',
      key_prefix: 'live_',
      allowed_mode: 'rag',
      department_ids: [1, 2],
      system_prompt: 'Test prompt',
      llm_model_id: 1,
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
      total_requests: 0,
      total_tokens_used: 0,
    };

    vi.mocked(api.get).mockResolvedValue({
      data: [mockToken],
    });

    render(<APITokensPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Token')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByTitle('Düzenle');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Token Düzenle')).toBeInTheDocument();
    });

    // Verify form is populated with existing data
    const nameInput = screen.getByDisplayValue('Test Token');
    expect(nameInput).toBeInTheDocument();
  });

  it('should toggle is_active switch in edit mode', async () => {
    const mockToken = {
      id: 1,
      name: 'Test Token',
      allowed_mode: 'rag',
      is_active: true,
      total_requests: 0,
      total_tokens_used: 0,
      department_ids: [1],
    };

    vi.mocked(api.get).mockResolvedValue({
      data: [mockToken],
    });

    vi.mocked(api.put).mockResolvedValue({
      data: { ...mockToken, is_active: false },
    });

    render(<APITokensPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Token')).toBeInTheDocument();
    });

    // Find and click the active toggle switch
    const switches = screen.getAllByRole('switch');
    const activeSwitch = switches[0];
    
    fireEvent.click(activeSwitch);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/api/keys/1',
        expect.objectContaining({ is_active: false })
      );
    });
  });

  it('should call update API when edit form is submitted', async () => {
    const mockToken = {
      id: 1,
      name: 'Test Token',
      description: 'Old Description',
      allowed_mode: 'rag',
      is_active: true,
      total_requests: 0,
      total_tokens_used: 0,
      department_ids: [1],
      rate_limit_per_minute: 60,
      rate_limit_per_day: 1000,
    };

    vi.mocked(api.get).mockResolvedValue({
      data: [mockToken],
    });

    vi.mocked(api.put).mockResolvedValue({
      data: { ...mockToken, description: 'New Description' },
    });

    render(<APITokensPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Token')).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByTitle('Düzenle');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Token Düzenle')).toBeInTheDocument();
    });

    // Update description
    const descriptionInput = screen.getByDisplayValue('Old Description');
    fireEvent.change(descriptionInput, { target: { value: 'New Description' } });

    // Submit form
    const updateButton = screen.getByText('Güncelle');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/api/keys/1',
        expect.objectContaining({
          description: 'New Description',
        })
      );
    });
  });
});
