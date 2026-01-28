// firebase-init.js v1.9.7 - 已增強：啟用 persistence 與錯誤處理
// 請注意：本檔仍保留全域變數 firebase, auth, db, storage 與 appId 的行為以維持相容性

// Firebase 配置 (請替換為您自己的 Firebase 專案配置)
const firebaseConfig = {
  apiKey: "AIzaSyC-uaCnvgtYacPf_7BtwbwdDUw-WMx4d8s",
  authDomain: "kmldata-d22fb.firebaseapp.com",
  projectId: "kmldata-d22fb",
  storageBucket: "kmldata-d22fb.firebasestorage.app",
  messagingSenderId: "6673236901",
  appId: "1:6673236901:web:5aac773cbb512a14b8de4c",
  measurementId: "G-TJFH5SXNJX"
};

// 初始化 Firebase（使用 CDN v8 style 在此專案內）
if (typeof firebase === 'undefined') {
  console.error('firebase SDK 未載入，請在 index.html 引入 Firebase CDN。');
} else {
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (e) {
    // 如果已經初始化過，忽略錯誤
    console.warn('firebase.initializeApp 可能已經呼叫過：', e && e.message);
  }
}

// 獲取 Firebase 服務實例
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// 根據 Canvas 環境提供的 __app_id 或是 Firebase 配置中的 projectId 來確定 appId
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;
console.info("Using App ID for Firestore path:", appId);

// 嘗試啟用 IndexedDB persistence（可顯著減少重複 network 讀取）
try {
  if (db && typeof db.enablePersistence === 'function') {
    db.enablePersistence({ synchronizeTabs: true })
      .then(() => {
        console.info('Firestore persistence 已啟用（IndexedDB, synchronizeTabs: true）');
      })
      .catch((err) => {
        // 常見錯誤：failed-precondition (多 tab), unimplemented (瀏覽器不支援)
        if (err && err.code === 'failed-precondition') {
          console.warn('Firestore persistence 未啟用：多個 tab 競爭 IndexedDB（failed-precondition）。', err);
        } else if (err && err.code === 'unimplemented') {
          console.warn('Firestore persistence 不支援此瀏覽器（unimplemented）。', err);
        } else {
          console.warn('啟用 Firestore persistence 時發生錯誤：', err);
        }
      });
  } else {
    console.warn('Firestore db.enablePersistence 不可用，請確認使用的是 v8 SDK 並且 firebase.firestore() 正常初始化。');
  }
} catch (e) {
  console.warn('啟用 Firestore persistence 時捕獲例外：', e);
}

// 定義 showMessage 函數以便全域使用（若專案已有同名請注意覆寫）
window.showMessage = window.showMessage || function(title, message, callback) {
    const messageBoxOverlay = document.getElementById('messageBoxOverlay');
    const messageBoxTitle = document.getElementById('messageBoxTitle');
    const messageBoxMessage = document.getElementById('messageBoxMessage');
    const messageBoxCloseBtn = document.getElementById('messageBoxCloseBtn');

    if (!messageBoxOverlay || !messageBoxTitle || !messageBoxMessage || !messageBoxCloseBtn) {
      // fallback: alert
      alert(`${title}\n\n${message}`);
      if (callback) callback();
      return;
    }

    messageBoxTitle.textContent = title;
    messageBoxMessage.textContent = message;
    messageBoxOverlay.classList.add('visible'); // 顯示彈窗

    const closeHandler = () => {
        messageBoxOverlay.classList.remove('visible'); // 隱藏彈窗
        messageBoxCloseBtn.removeEventListener('click', closeHandler);
        if (callback) {
            callback();
        }
    };
    messageBoxCloseBtn.addEventListener('click', closeHandler);
};