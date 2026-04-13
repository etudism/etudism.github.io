export function installGlobalErrorHandlers(doc = document) {
  window.addEventListener('error', (event) => {
    const box = doc.getElementById('errorBox');
    if (!box) return;
    box.style.display = 'block';
    box.textContent = String(event.error && event.error.stack ? event.error.stack : event.message || event.error || 'Unknown error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const box = doc.getElementById('errorBox');
    if (!box) return;
    box.style.display = 'block';
    const reason = event.reason;
    box.textContent = String(reason && reason.stack ? reason.stack : reason || 'Unhandled promise rejection');
  });
}
