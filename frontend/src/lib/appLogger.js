export async function logToServer(level, message) {
  const API = import.meta.env.BACKEND_API_URL;
  try {
    await fetch(`${API}logs/app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, log: message }),
    });
  } 
  catch {
  }
}