#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import SessionLocal
from database.models_platform import Plan, Organization

def run():
    print("Updating plan prices and permissions in database...")
    db = SessionLocal()
    try:
        # Update plans
        plans_config = {
            'starter': {'price': 50.00, 'has_ai_writer': False, 'has_ai_social': False},
            'pro': {'price': 200.00, 'has_ai_writer': False, 'has_ai_social': False},
            'ultimate': {'price': 350.00, 'has_ai_writer': True, 'has_ai_social': False},
            'ultra': {'price': 600.00, 'has_ai_writer': True, 'has_ai_social': True},
        }

        for key, config in plans_config.items():
            plan = db.query(Plan).filter(Plan.key == key).first()
            if plan:
                print(f"Updating plan '{key}': price={config['price']}, writer={config['has_ai_writer']}, social={config['has_ai_social']}")
                plan.price = config['price']
                plan.has_ai_writer = config['has_ai_writer']
                plan.has_ai_social = config['has_ai_social']
            else:
                print(f"Warning: Plan '{key}' not found in database.")

        # Update organizations
        orgs = db.query(Organization).all()
        for org in orgs:
            plan_key = org.plan
            if plan_key in plans_config:
                config = plans_config[plan_key]
                print(f"Updating organization '{org.slug}' (plan={plan_key}): writer={config['has_ai_writer']}, social={config['has_ai_social']}")
                org.has_ai_writer = config['has_ai_writer']
                org.has_ai_social = config['has_ai_social']
            elif plan_key == 'enterprise':
                # Map enterprise to ultra config
                config = plans_config['ultra']
                print(f"Updating organization '{org.slug}' (plan=enterprise/ultra): writer={config['has_ai_writer']}, social={config['has_ai_social']}")
                org.has_ai_writer = config['has_ai_writer']
                org.has_ai_social = config['has_ai_social']

        db.commit()
        print("✅ Plan pricing and permissions updated successfully in database!")
    except Exception as e:
        print(f"❌ Error updating plans/orgs: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run()
