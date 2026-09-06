export async function logToServer(level, message) {
  try {
    await fetch(`${API_BASE_URL}/api/logs/app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, log: message }),
    });
  } catch {
  }
}