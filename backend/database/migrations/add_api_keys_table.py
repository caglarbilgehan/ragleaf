"""
API Keys table migration
"""

def upgrade():
    """Create api_keys table"""
    
    # SQL for creating api_keys table
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        key_prefix VARCHAR(10) NOT NULL,
        key_hash VARCHAR(255) NOT NULL UNIQUE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        
        -- Mode Settings
        allowed_mode VARCHAR(20) DEFAULT 'rag',
        department_ids INTEGER[] DEFAULT '{}',
        
        -- AI Settings - LLM Model Selection
        system_prompt TEXT,
        llm_model_id INTEGER REFERENCES llm_models(id) ON DELETE SET NULL,
        max_tokens INTEGER DEFAULT 1000,
        temperature FLOAT DEFAULT 0.7,
        
        -- RAG Settings
        top_k INTEGER DEFAULT 5,
        similarity_threshold FLOAT DEFAULT 0.5,
        include_sources BOOLEAN DEFAULT true,
        include_images BOOLEAN DEFAULT true,
        
        -- Language Settings
        default_language VARCHAR(10) DEFAULT 'tr',
        allowed_languages TEXT[] DEFAULT '{"tr", "en"}',
        
        -- Security Settings
        permissions TEXT[] DEFAULT '{"chat:read"}',
        ip_whitelist TEXT[] DEFAULT '{}',
        allowed_origins TEXT[] DEFAULT '{}',
        rate_limit_per_minute INTEGER DEFAULT 60,
        rate_limit_per_day INTEGER DEFAULT 1000,
        
        -- Status
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Stats
        total_requests INTEGER DEFAULT 0,
        total_tokens_used INTEGER DEFAULT 0,
        
        -- JSON Fields
        response_format JSONB DEFAULT '{"include_confidence": true, "include_processing_time": true, "include_suggested_questions": true, "max_sources": 5, "source_format": "detailed"}',
        custom_templates JSONB DEFAULT '{"no_results": "Üzgünüm, bu konuda yeterli bilgi bulunamadı.", "error": "Teknik bir sorun oluştu.", "rate_limit": "Çok fazla istek gönderdiniz."}',
        metadata JSONB DEFAULT '{}'
    );
    
    CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
    CREATE INDEX IF NOT EXISTS idx_api_keys_allowed_mode ON api_keys(allowed_mode);
    """
    
    return create_table_sql

def downgrade():
    """Drop api_keys table"""
    return "DROP TABLE IF EXISTS api_keys;"

if __name__ == "__main__":
    print("API Keys Migration")
    print("Upgrade SQL:")
    print(upgrade())