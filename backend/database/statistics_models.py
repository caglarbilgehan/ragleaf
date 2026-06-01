# backend/database/statistics_models.py
"""
Simplified Statistics - Uses unified Statistics table from statistics_model.py
All statistics are stored as key-value pairs with JSON data
"""

# Re-export everything from the unified model
from .statistics_model import Statistics, StatCategory, ErrorType
