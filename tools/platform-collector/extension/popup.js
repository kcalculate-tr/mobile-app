// Opens the runner page (a normal tab survives while the popup closes).
for (const mode of ['weekly', 'full']) {
  document.getElementById(mode).addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL(`runner.html?mode=${mode}`) });
    window.close();
  });
}
