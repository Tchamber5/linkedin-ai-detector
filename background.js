// LinkedIn AI Detector - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ detectedCount: 0, badgesVisible: true });
  console.log('LinkedIn AI Detector installed.');
});
