export function downloadUrl(url: string, name: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadText(name: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, name);
  // Give the click a tick to start before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
