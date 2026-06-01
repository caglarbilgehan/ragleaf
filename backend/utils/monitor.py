# backend/utils/monitor.py
import os
import psutil
from typing import Dict, Any, Optional

def get_ram_usage() -> float:
    """Bu FastAPI (uvicorn) sürecinin RAM (MB)."""
    try:
        p = psutil.Process(os.getpid())
        return round(p.memory_info().rss / (1024 * 1024), 2)
    except Exception:
        return 0.0

def get_system_memory() -> Dict[str, Any]:
    """Sistem bellek bilgilerini döndür"""
    try:
        mem = psutil.virtual_memory()
        return {
            "total_mb": round(mem.total / (1024 * 1024), 2),
            "available_mb": round(mem.available / (1024 * 1024), 2),
            "used_mb": round(mem.used / (1024 * 1024), 2),
            "percent": round(mem.percent, 1)
        }
    except Exception:
        return {
            "total_mb": 0,
            "available_mb": 0,
            "used_mb": 0,
            "percent": 0
        }

def get_cpu_usage() -> float:
    """CPU kullanım yüzdesini döndür"""
    try:
        return round(psutil.cpu_percent(interval=1), 1)
    except Exception:
        return 0.0

def _sum_proc_ram_mb_by_substrings(names: list[str]) -> float | None:
    """
    Process name veya cmdline içinde 'names' geçen tüm süreçlerin RAM'ini toplayıp MB döndürür.
    Yoksa None döner.
    """
    names = [n.lower() for n in names]
    total = 0.0
    found = False
    for p in psutil.process_iter(["name", "cmdline"]):
        try:
            nm = (p.info.get("name") or "").lower()
            cmd = " ".join(p.info.get("cmdline") or []).lower()
            if any(s in nm or s in cmd for s in names):
                total += p.memory_info().rss / (1024 * 1024)
                found = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        except Exception:
            continue
    return round(total, 2) if found else None

def get_ollama_ram_mb() -> float | None:
    """
    Ollama servis/süreç RAM'i (MB). Windows'ta 'ollama.exe', Linux/macOS'ta 'ollama' olarak yakalanır.
    Birden çok süreç varsa hepsini toplar.
    """
    return _sum_proc_ram_mb_by_substrings(["ollama"])

def get_process_info() -> Dict[str, Any]:
    """Detaylı process bilgilerini döndür"""
    try:
        current_process = psutil.Process(os.getpid())
        return {
            "pid": current_process.pid,
            "name": current_process.name(),
            "memory_mb": round(current_process.memory_info().rss / (1024 * 1024), 2),
            "cpu_percent": round(current_process.cpu_percent(), 1),
            "create_time": current_process.create_time(),
            "num_threads": current_process.num_threads()
        }
    except Exception:
        return {
            "pid": 0,
            "name": "unknown",
            "memory_mb": 0,
            "cpu_percent": 0,
            "create_time": 0,
            "num_threads": 0
        }

def get_system_stats() -> Dict[str, Any]:
    """Tüm sistem istatistiklerini toplu olarak döndür"""
    return {
        "memory": get_system_memory(),
        "cpu_percent": get_cpu_usage(),
        "process": get_process_info(),
        "ollama_ram_mb": get_ollama_ram_mb(),
        "current_process_ram_mb": get_ram_usage()
    }
