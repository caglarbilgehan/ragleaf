-- Migration: Add operations table for tracking background operations
-- Date: 2026-01-13
-- Description: Creates operations table for reset/reprocess progress tracking

-- Create operations table
CREATE TABLE IF NOT EXISTS operations (
    id SERIAL PRIMARY KEY,
    operation_id VARCHAR(50) UNIQUE NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    progress INTEGER DEFAULT 0,
    stage VARCHAR(50),
    details TEXT,
    options JSONB,
    result JSONB,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_operations_operation_id ON operations(operation_id);
CREATE INDEX IF NOT EXISTS idx_operations_document_id ON operations(document_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_type ON operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at);

-- Add comment
COMMENT ON TABLE operations IS 'Background operations tracking for reset, process, index operations';
COMMENT ON COLUMN operations.operation_id IS 'Unique operation identifier (e.g., op_abc123)';
COMMENT ON COLUMN operations.operation_type IS 'Type: reset, process, index, reset_and_reprocess, bulk_reset';
COMMENT ON COLUMN operations.status IS 'Status: pending, running, completed, error, cancelled';
COMMENT ON COLUMN operations.stage IS 'Current stage: resetting, processing, indexing, completed, error';
COMMENT ON COLUMN operations.options IS 'Operation configuration (reset_level, reset_options, reprocess_options)';
COMMENT ON COLUMN operations.result IS 'Operation result summary (chunks_created, images_processed, etc.)';
