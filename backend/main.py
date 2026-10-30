from datetime import datetime
from collections import deque
from typing import Optional
import platform
import time

import psutil
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Process Monitoring System API",
    description="Live operating-system and process metrics for the dashboard.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

started_at = time.time()
history = deque(maxlen=60)


class TerminateResponse(BaseModel):
    success: bool
    message: str


def get_process_data(proc: psutil.Process) -> Optional[dict]:
    try:
        with proc.oneshot():
            memory = proc.memory_info()
            cpu = proc.cpu_percent(interval=None)
            created = proc.create_time()
            try:
                username = proc.username()
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                username = "Unavailable"
            try:
                status = proc.status()
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                status = "unknown"
            return {
                "pid": proc.pid,
                "name": proc.name() or "Unknown",
                "cpu_percent": round(max(0.0, cpu), 1),
                "memory_mb": round(memory.rss / (1024 * 1024), 1),
                "memory_percent": round(proc.memory_percent(), 2),
                "status": status,
                "username": username,
                "created_at": datetime.fromtimestamp(created).isoformat(timespec="seconds"),
            }
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, OSError):
        return None


def get_processes():
    result = []
    for proc in psutil.process_iter():
        item = get_process_data(proc)
        if item is not None:
            result.append(item)
    result.sort(key=lambda item: item["cpu_percent"], reverse=True)
    return result


def system_snapshot():
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    cpu = psutil.cpu_percent(interval=0.15)
    logical = psutil.cpu_count(logical=True) or 1
    physical = psutil.cpu_count(logical=False)
    boot = datetime.fromtimestamp(psutil.boot_time()).isoformat(timespec="seconds")
    processes = get_processes()
    return {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "cpu_percent": round(cpu, 1),
        "memory_percent": round(vm.percent, 1),
        "memory_total_gb": round(vm.total / (1024 ** 3), 2),
        "memory_used_gb": round(vm.used / (1024 ** 3), 2),
        "memory_available_gb": round(vm.available / (1024 ** 3), 2),
        "disk_percent": round(disk.percent, 1),
        "disk_total_gb": round(disk.total / (1024 ** 3), 2),
        "disk_used_gb": round(disk.used / (1024 ** 3), 2),
        "process_count": len(processes),
        "logical_cpus": logical,
        "physical_cpus": physical or logical,
        "platform": platform.platform(),
        "system": platform.system(),
        "release": platform.release(),
        "python_version": platform.python_version(),
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "boot_time": boot,
        "top_processes": processes[:5],
    }


@app.get("/")
def root():
    return {
        "message": "Process Monitoring System API is running",
        "docs": "/docs",
        "endpoints": ["/api/overview", "/api/processes", "/api/history", "/api/system"],
    }


@app.get("/api/overview")
def overview():
    snapshot = system_snapshot()
    history.append({
        "time": datetime.now().strftime("%H:%M:%S"),
        "cpu_percent": snapshot["cpu_percent"],
        "memory_percent": snapshot["memory_percent"],
    })
    return snapshot


@app.get("/api/processes")
def processes(
    search: str = Query(default="", max_length=100),
    sort_by: str = Query(default="cpu_percent"),
    order: str = Query(default="desc"),
):
    allowed_sorts = {"pid", "name", "cpu_percent", "memory_mb", "memory_percent", "status"}
    if sort_by not in allowed_sorts:
        raise HTTPException(status_code=400, detail="Unsupported sort field.")
    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Order must be asc or desc.")

    items = get_processes()
    needle = search.strip().lower()
    if needle:
        items = [
            item for item in items
            if needle in item["name"].lower()
            or needle in str(item["pid"])
            or needle in item["username"].lower()
        ]

    items.sort(key=lambda item: str(item[sort_by]).lower() if isinstance(item[sort_by], str) else item[sort_by],
               reverse=(order == "desc"))
    return {"count": len(items), "processes": items}


@app.get("/api/history")
def get_history():
    return list(history)


@app.get("/api/system")
def system_info():
    return {
        "platform": platform.platform(),
        "system": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "processor": platform.processor() or "Not reported by OS",
        "logical_cpus": psutil.cpu_count(logical=True) or 1,
        "physical_cpus": psutil.cpu_count(logical=False) or "Not reported",
        "total_ram_gb": round(psutil.virtual_memory().total / (1024 ** 3), 2),
        "boot_time": datetime.fromtimestamp(psutil.boot_time()).isoformat(timespec="seconds"),
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "python_version": platform.python_version(),
    }


@app.post("/api/processes/{pid}/terminate", response_model=TerminateResponse)
def terminate_process(pid: int):
    if pid <= 0:
        raise HTTPException(status_code=400, detail="PID must be positive.")
    if pid == psutil.Process().pid:
        raise HTTPException(status_code=400, detail="The monitoring backend cannot terminate itself.")

    try:
        proc = psutil.Process(pid)
        name = proc.name()
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except psutil.TimeoutExpired:
            raise HTTPException(
                status_code=409,
                detail="Process did not exit in time. It may require elevated permissions.",
            )
        return TerminateResponse(success=True, message=f"Process '{name}' (PID {pid}) terminated.")
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process no longer exists.")
    except psutil.AccessDenied:
        raise HTTPException(status_code=403, detail="Access denied. This process may require administrator permissions.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not terminate process: {exc}")
