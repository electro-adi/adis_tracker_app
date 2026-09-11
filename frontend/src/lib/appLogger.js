const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL;
const API_KEY = import.meta.env.VITE_BACKEND_API_KEY;

export async function logToServer(level, message) {
  try {
    await fetch(`${API_BASE_URL}/api/logs/app`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({ level, log: message }),
    });
  } catch {
    // don't let logging failures cascade into more errors
  }
}