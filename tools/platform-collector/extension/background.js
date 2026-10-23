// Weekly automatic run: every Friday 18:00 (Europe/Istanbul, i.e. the Mac's local time).
// If Chrome is closed at that moment, Chrome fires the missed alarm on next start.
const ALARM = 'kcal-weekly';

function nextFriday18() {
  const now = new Date();
  const d = new Date(now);
  d.setHours(18, 0, 0, 0);
  const add = (5 - d.getDay() + 7) % 7; // 5 = Friday
  d.setDate(d.getDate() + add);
  if (d <= now) d.setDate(d.getDate() + 7);
  return d.getTime();
}

async function ensureAlarm() {
  const a = await chrome.alarms.get(ALARM);
  if (!a) chrome.alarms.create(ALARM, { when: nextFriday18(), periodInMinutes: 7 * 24 * 60 });
}

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  // skip if a weekly run already happened in the last 12 hours (e.g. missed alarm + manual run)
  const { lastWeeklyRun } = await chrome.storage.local.get('lastWeeklyRun');
  if (lastWeeklyRun && Date.now() - lastWeeklyRun < 12 * 3600e3) return;
  chrome.tabs.create({ url: chrome.runtime.getURL('runner.html?mode=weekly&auto=1'), active: false });
});
