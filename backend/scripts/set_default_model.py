import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')

from backend.database.connection import SessionLocal
from backend.database.models import ModelConfig

db = SessionLocal()

print("=== All Models ===\n")
models = db.query(ModelConfig).order_by(ModelConfig.id).all()
for m in models:
    print(f"ID={m.id} | {m.name} | {m.model_name} | default={m.is_default} | active={m.is_active}")

print("\n=== Setting Llama 3.3 70B as default ===")
# Find Llama model
llama = db.query(ModelConfig).filter(ModelConfig.model_name.like("%Llama-3.3%")).first()

if llama:
    # Unset all defaults first
    db.query(ModelConfig).update({ModelConfig.is_default: False})
    # Set Llama as default
    llama.is_default = True
    llama.is_active = True
    db.commit()
    print(f"Done! Default model: {llama.name}")
else:
    print("Llama 3.3 model not found!")
    # Show what we have
    for m in models:
        if "llama" in m.name.lower() or "llama" in m.model_name.lower():
            print(f"  Found: {m.name} - {m.model_name}")

db.close()
