const API_BASE = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the backend. Make sure FastAPI is running on port 8000.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "The request failed.");
  }
  return data;
}

export const getOverview = () => request("/api/overview");
export const getProcesses = (search = "", sortBy = "cpu_percent", order = "desc") =>
  request(`/api/processes?search=${encodeURIComponent(search)}&sort_by=${encodeURIComponent(sortBy)}&order=${order}`);
export const getHistory = () => request("/api/history");
export const getSystemInfo = () => request("/api/system");
export const terminateProcess = (pid) =>
  request(`/api/processes/${pid}/terminate`, { method: "POST" });
