-- PostgreSQL Schema for Ragleaf
-- Run with: docker exec -i ragleaf_postgres psql -U ragleaf -d ragleaf_db < docker/postgres/schema.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50),
    surname VARCHAR(50),
    full_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    last_login TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Embedding Models table
CREATE TABLE IF NOT EXISTS embedding_models (
    id SERIAL PRIMARY KEY,
    model_id VARCHAR(200) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    dimension INTEGER NOT NULL,
    max_sequence_length INTEGER DEFAULT 512,
    size_mb FLOAT,
    deployment_type VARCHAR(20) DEFAULT 'local',
    api_endpoint VARCHAR(500),
    requires_api_key BOOLEAN DEFAULT FALSE,
    api_key_env_var VARCHAR(100),
    multilingual BOOLEAN DEFAULT FALSE,
    performance_tier VARCHAR(20) DEFAULT 'balanced',
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    is_downloaded BOOLEAN DEFAULT FALSE,
    provider VARCHAR(50) DEFAULT 'huggingface',
    model_family VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    last_used TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_embedding_models_model_id ON embedding_models(model_id);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    folder_name VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'uploaded',
    processing_stage VARCHAR(50),
    processing_progress INTEGER DEFAULT 0,
    processing_details TEXT,
    processing_logs JSONB,
    total_pages INTEGER,
    total_chunks INTEGER,
    ocr_completed BOOLEAN DEFAULT FALSE,
    vector_indexed BOOLEAN DEFAULT FALSE,
    embedding_model_id INTEGER REFERENCES embedding_models(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- Document Chunks with pgvector
CREATE TABLE IF NOT EXISTS document_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768),  -- pgvector type
    word_count INTEGER,
    char_count INTEGER,
    paragraph_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- AI Configuration Tables
-- ============================================================================

-- LLM Models
CREATE TABLE IF NOT EXISTS llm_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    description TEXT,
    num_ctx INTEGER DEFAULT 32768,
    num_predict INTEGER DEFAULT 4096,
    temperature FLOAT DEFAULT 0.3,
    top_p FLOAT DEFAULT 0.9,
    top_k INTEGER DEFAULT 40,
    repeat_penalty FLOAT DEFAULT 1.1,
    max_context_chars INTEGER DEFAULT 8000,
    rag_top_k INTEGER DEFAULT 5,
    chunk_size INTEGER DEFAULT 1000,
    chunk_overlap INTEGER DEFAULT 200,
    timeout_seconds INTEGER DEFAULT 120,
    stream_enabled BOOLEAN DEFAULT TRUE,
    config JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- AI Providers
CREATE TABLE IF NOT EXISTS ai_providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    service_type VARCHAR(50) DEFAULT 'inference',
    api_url VARCHAR(500),
    config JSONB,
    priority INTEGER DEFAULT 1,
    is_enabled BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT FALSE,
    default_model VARCHAR(200),
    default_model_display_name VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ai_providers_name ON ai_providers(name);

-- AI Tokens
CREATE TABLE IF NOT EXISTS ai_tokens (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    display_name VARCHAR(200) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    api_url VARCHAR(500),
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    total_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    last_error TEXT,
    last_error_at TIMESTAMPTZ,
    requests_per_minute INTEGER DEFAULT 60,
    requests_per_day INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- ============================================================================
-- Chat Tables (replaces MongoDB)
-- ============================================================================

-- Chat Conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    model VARCHAR(100),
    system_prompt TEXT,
    temperature FLOAT DEFAULT 0.7,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON chat_conversations(user_id);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tokens_used INTEGER,
    model VARCHAR(100),
    rag_sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id);

-- ============================================================================
-- System Tables
-- ============================================================================

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Statistics
CREATE TABLE IF NOT EXISTS statistics (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    data JSONB,
    is_resolved BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_statistics_category_timestamp ON statistics(category, timestamp);
CREATE INDEX IF NOT EXISTS idx_statistics_category_key ON statistics(category, key);

-- ============================================================================
-- Verify Tables
-- ============================================================================
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
