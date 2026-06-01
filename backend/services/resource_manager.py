import psutil
import asyncio
import gc
import threading
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ResourceLimits:
    max_memory_percent: float = 95.0  # Max RAM usage percentage (increased)
    max_cpu_percent: float = 90.0     # Max CPU usage percentage (increased)
    max_concurrent_tasks: int = 1     # Max concurrent processing tasks (sequential processing)
    chunk_size_limit: int = 500       # Max chunk size for processing (reduced)
    batch_size: int = 5               # Batch size for processing (reduced)

class ResourceManager:
    def __init__(self):
        self.limits = ResourceLimits()
        self.active_tasks = 0
        self.task_lock = threading.Lock()
        self.executor = ThreadPoolExecutor(max_workers=self.limits.max_concurrent_tasks)
        self._monitoring = False
        
    def get_system_stats(self) -> Dict[str, Any]:
        """Get current system resource usage"""
        try:
            memory = psutil.virtual_memory()
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # GPU stats (if available)
            gpu_stats = self._get_gpu_stats()
            
            return {
                "memory": {
                    "total": memory.total,
                    "available": memory.available,
                    "used": memory.used,
                    "percent": memory.percent
                },
                "cpu": {
                    "percent": cpu_percent,
                    "count": psutil.cpu_count()
                },
                "gpu": gpu_stats,
                "active_tasks": self.active_tasks
            }
        except Exception as e:
            logger.error(f"Error getting system stats: {e}")
            return {}
    
    def _get_gpu_stats(self) -> Dict[str, Any]:
        """Get GPU statistics if available"""
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]  # Use first GPU
                return {
                    "name": gpu.name,
                    "memory_used": gpu.memoryUsed,
                    "memory_total": gpu.memoryTotal,
                    "memory_percent": (gpu.memoryUsed / gpu.memoryTotal) * 100,
                    "load": gpu.load * 100,
                    "temperature": gpu.temperature
                }
        except ImportError:
            logger.info("GPUtil not available, GPU monitoring disabled")
        except Exception as e:
            logger.error(f"Error getting GPU stats: {e}")
        
        return {"available": False}
    
    def can_start_task(self) -> tuple[bool, str]:
        """Check if system can handle a new task"""
        stats = self.get_system_stats()
        
        # Check memory usage
        if stats.get("memory", {}).get("percent", 0) > self.limits.max_memory_percent:
            return False, f"Memory usage too high: {stats['memory']['percent']:.1f}%"
        
        # Check CPU usage
        if stats.get("cpu", {}).get("percent", 0) > self.limits.max_cpu_percent:
            return False, f"CPU usage too high: {stats['cpu']['percent']:.1f}%"
        
        # Check concurrent tasks
        if self.active_tasks >= self.limits.max_concurrent_tasks:
            return False, f"Too many concurrent tasks: {self.active_tasks}"
        
        return True, "OK"
    
    async def wait_for_resources(self, timeout: int = 300) -> bool:
        """Wait for system resources to become available"""
        start_time = asyncio.get_event_loop().time()
        
        while True:
            can_start, reason = self.can_start_task()
            if can_start:
                return True
            
            # Check timeout
            if asyncio.get_event_loop().time() - start_time > timeout:
                logger.warning(f"Timeout waiting for resources: {reason}")
                return False
            
            logger.info(f"Waiting for resources: {reason}")
            await asyncio.sleep(5)  # Wait 5 seconds before checking again
    
    async def acquire_task_slot(self) -> bool:
        """Acquire a task slot for processing"""
        with self.task_lock:
            if self.active_tasks < self.limits.max_concurrent_tasks:
                self.active_tasks += 1
                logger.info(f"Task slot acquired. Active tasks: {self.active_tasks}")
                return True
            return False
    
    def release_task_slot(self):
        """Release a task slot"""
        with self.task_lock:
            if self.active_tasks > 0:
                self.active_tasks -= 1
                logger.info(f"Task slot released. Active tasks: {self.active_tasks}")
    
    def optimize_memory(self):
        """Force garbage collection and memory optimization"""
        try:
            # Force garbage collection
            collected = gc.collect()
            logger.info(f"Garbage collection freed {collected} objects")
            
            # Get memory stats after cleanup
            memory = psutil.virtual_memory()
            logger.info(f"Memory usage after cleanup: {memory.percent:.1f}%")
            
        except Exception as e:
            logger.error(f"Error during memory optimization: {e}")
    
    def chunk_data_safely(self, data: str, max_chunk_size: Optional[int] = None) -> list[str]:
        """Split data into memory-safe chunks"""
        if not data:
            return []
        
        chunk_size = max_chunk_size or self.limits.chunk_size_limit
        
        # Calculate optimal chunk size based on available memory
        memory = psutil.virtual_memory()
        if memory.percent > 70:  # If memory usage is high, use smaller chunks
            chunk_size = min(chunk_size, 500)
        
        chunks = []
        for i in range(0, len(data), chunk_size):
            chunks.append(data[i:i + chunk_size])
        
        logger.info(f"Split data into {len(chunks)} chunks of max size {chunk_size}")
        return chunks
    
    async def process_in_batches(self, items: list, batch_processor, batch_size: Optional[int] = None):
        """Process items in memory-safe batches"""
        batch_size = batch_size or self.limits.batch_size
        results = []
        
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            
            # Check resources before processing batch
            can_process, reason = self.can_start_task()
            if not can_process:
                logger.warning(f"Waiting for resources before batch {i//batch_size + 1}: {reason}")
                await self.wait_for_resources()
            
            # Process batch
            try:
                batch_result = await batch_processor(batch)
                results.extend(batch_result if isinstance(batch_result, list) else [batch_result])
                
                # Optimize memory after each batch
                if i % (batch_size * 3) == 0:  # Every 3 batches
                    self.optimize_memory()
                
            except Exception as e:
                logger.error(f"Error processing batch {i//batch_size + 1}: {e}")
                raise
        
        return results
    
    def set_limits(self, **kwargs):
        """Update resource limits"""
        for key, value in kwargs.items():
            if hasattr(self.limits, key):
                setattr(self.limits, key, value)
                logger.info(f"Updated limit {key} to {value}")
    
    def start_monitoring(self):
        """Start resource monitoring"""
        if not self._monitoring:
            self._monitoring = True
            asyncio.create_task(self._monitor_resources())
    
    async def _monitor_resources(self):
        """Background resource monitoring"""
        while self._monitoring:
            try:
                stats = self.get_system_stats()
                memory_percent = stats.get("memory", {}).get("percent", 0)
                cpu_percent = stats.get("cpu", {}).get("percent", 0)
                
                # Log warnings for high usage
                if memory_percent > 90:
                    logger.warning(f"Critical memory usage: {memory_percent:.1f}%")
                    self.optimize_memory()
                elif memory_percent > 80:
                    logger.warning(f"High memory usage: {memory_percent:.1f}%")
                
                if cpu_percent > 90:
                    logger.warning(f"Critical CPU usage: {cpu_percent:.1f}%")
                
                await asyncio.sleep(10)  # Monitor every 10 seconds
                
            except Exception as e:
                logger.error(f"Error in resource monitoring: {e}")
                await asyncio.sleep(30)
    
    def stop_monitoring(self):
        """Stop resource monitoring"""
        self._monitoring = False
    
    def __del__(self):
        """Cleanup on destruction"""
        self.stop_monitoring()
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)

# Global instance
resource_manager = ResourceManager()
