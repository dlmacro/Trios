// Preload runs in a sandboxed context.
// Expose nothing extra — the app uses IndexedDB (Dexie) entirely in the renderer.
window.addEventListener('DOMContentLoaded', () => {
  // Prevent the default drag-and-drop behavior so files dropped on the
  // window don't navigate away from the app.
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
});
