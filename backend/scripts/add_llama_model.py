import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')

from backend.database.connection import SessionLocal
from backend.database.models import ModelConfig

db = SessionLocal()

print("=== Adding Llama 3.3 70B as default model ===\n")

# Unset all defaults first
db.query(ModelConfig).update({ModelConfig.is_default: False})

# Check if model exists
existing = db.query(ModelConfig).filter(ModelConfig.model_name == "meta-llama/Llama-3.3-70B-Instruct").first()

if existing:
    existing.is_default = True
    existing.is_active = True
    print(f"Model already exists, set as default: {existing.name}")
else:
    # Create new model
    model = ModelConfig(
        name="Llama 3.3 70B Instruct",
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
    print(f"Created new model: {model.name}")

db.commit()

# Verify
print("\n=== Current Models ===")
models = db.query(ModelConfig).all()
for m in models:
    default_mark = " <-- DEFAULT" if m.is_default else ""
    print(f"  {m.name} ({m.model_name}){default_mark}")

db.close()
