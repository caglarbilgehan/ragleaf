"""
Script to initialize default AI Provider and Model for ChatUI
"""
import sys
sys.path.insert(0, '.')

from backend.database.connection import SessionLocal
from backend.database.models import ModelConfig, AIProvider, AIToken

def setup_default_model():
    db = SessionLocal()
    try:
        # Check if HuggingFace provider exists
        provider = db.query(AIProvider).filter(AIProvider.name == "huggingface").first()
        
        if not provider:
            print("Creating HuggingFace provider...")
            provider = AIProvider(
                name="huggingface",
                display_name="HuggingFace Router",
                service_type="inference",
                api_url="https://router.huggingface.co/v1",
                priority=1,
                is_enabled=True,
                is_active=True,
                default_model="meta-llama/Llama-3.3-70B-Instruct",
                default_model_display_name="Llama 3.3 70B Instruct"
            )
            db.add(provider)
            db.commit()
            db.refresh(provider)
            print(f"✅ Created provider: {provider.name} (ID: {provider.id})")
        else:
            # Ensure it's active
            provider.is_active = True
            provider.is_enabled = True
            db.commit()
            print(f"✅ Provider already exists: {provider.name} (ID: {provider.id})")
        
        # Check if token exists
        token = db.query(AIToken).filter(AIToken.provider_id == provider.id).first()
        
        if not token:
            print("Creating default token...")
            # Use the token from .env.local
            token = AIToken(
                provider_id=provider.id,
                display_name="HuggingFace Token 1",
                api_key="YOUR_HF_TOKEN_HERE",
                priority=1,
                is_active=True,
                is_available=True
            )
            db.add(token)
            db.commit()
            print(f"✅ Created token: {token.display_name}")
        else:
            print(f"✅ Token already exists: {token.display_name}")
        
        # Check if model exists
        model = db.query(ModelConfig).filter(ModelConfig.is_default == True).first()
        
        if not model:
            print("Creating default model...")
            model = ModelConfig(
                name="Llama 3.3 70B",
                provider="huggingface",
                model_name="meta-llama/Llama-3.3-70B-Instruct",
                description="Meta Llama 3.3 70B Instruct - High quality multilingual model",
                num_ctx=32768,
                num_predict=4096,
                temperature=0.3,
                top_p=0.9,
                top_k=40,
                repeat_penalty=1.1,
                is_active=True,
                is_default=True
            )
            db.add(model)
            db.commit()
            print(f"✅ Created model: {model.name} ({model.model_name})")
        else:
            print(f"✅ Default model already exists: {model.name}")
        
        print("\n🎉 Setup complete! ChatUI should now work.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    setup_default_model()
