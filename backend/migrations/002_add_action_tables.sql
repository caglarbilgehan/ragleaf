-- Migration: Add document_actions and action_queue tables
-- Date: 2026-01-13
-- Description: Tables for tracking document actions and managing action queue

-- Create document_actions table
CREATE TABLE IF NOT EXISTS document_actions (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    result VARCHAR(20) NOT NULL,
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for document_actions
CREATE INDEX IF NOT EXISTS idx_document_actions_document_id ON document_actions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_actions_created_at ON document_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_document_actions_user_id ON document_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_document_actions_action ON document_actions(action);
CREATE INDEX IF NOT EXISTS idx_document_actions_result ON document_actions(result);

-- Create action_queue table
CREATE TABLE IF NOT EXISTS action_queue (
    id VARCHAR(36) PRIMARY KEY,
    document_id VARCHAR(36) NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    position INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    options JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for action_queue
CREATE INDEX IF NOT EXISTS idx_action_queue_user_id ON action_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_action_queue_status ON action_queue(status);
CREATE INDEX IF NOT EXISTS idx_action_queue_position ON action_queue(position);
CREATE INDEX IF NOT EXISTS idx_action_queue_document_id ON action_queue(document_id);

-- Add comments
COMMENT ON TABLE document_actions IS 'Tracks all actions performed on documents for audit logging';
COMMENT ON TABLE action_queue IS 'Manages queued actions for batch processing';

COMMENT ON COLUMN document_actions.action IS 'Action type: process, index, reset, reprocess, reindex, retry';
COMMENT ON COLUMN document_actions.result IS 'Action result: success, failure';
COMMENT ON COLUMN document_actions.duration_ms IS 'Action duration in milliseconds (for successful actions)';
COMMENT ON COLUMN document_actions.error_message IS 'Error message (for failed actions)';

COMMENT ON COLUMN action_queue.status IS 'Queue status: queued, running, completed, cancelled, failed';
COMMENT ON COLUMN action_queue.position IS 'Position in queue (lower = higher priority)';
COMMENT ON COLUMN action_queue.options IS 'JSON options for the action (e.g., chunking strategy, OCR languages)';
