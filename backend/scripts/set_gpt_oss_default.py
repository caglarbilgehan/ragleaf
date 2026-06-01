import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')

from backend.database.connection import SessionLocal
from backend.database.models import ModelConfig

db = SessionLocal()

print("=== Setting GPT-OSS-20B as default model ===\n")

# Unset all defaults first
db.query(ModelConfig).update({ModelConfig.is_default: False})

# Find GPT-OSS-20B
gpt_oss = db.query(ModelConfig).filter(ModelConfig.name.like("%GPT-OSS-20B%")).first()

if gpt_oss:
    gpt_oss.is_default = True
    gpt_oss.is_active = True
    db.commit()
    print(f"Default model set to: {gpt_oss.name}")
    print(f"Model name: {gpt_oss.model_name}")
    print(f"Provider: {gpt_oss.provider}")
else:
    print("GPT-OSS-20B not found!")
    print("\nAvailable models:")
    for m in db.query(ModelConfig).all():
        print(f"  - {m.name} ({m.model_name})")

db.close()
