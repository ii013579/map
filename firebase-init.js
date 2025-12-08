// firebase-init.js v1.9 

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

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

// 全域 Firestore / Auth / Storage
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// === 2. 取得 appId ===
// 你的 artifacts 結構： /artifacts/{appId}/public/data/kmlList
// 這裡依舊從 localStorage 或 URL 抓
let appId = localStorage.getItem("appId");
if (!appId) {
    const urlParams = new URLSearchParams(window.location.search);
    appId = urlParams.get("appId") || "default";
    localStorage.setItem("appId", appId);
}
console.log("🔥 Firestore appId =", appId);


// -------------------------------------------
// === 3. Firestore 路徑統一管理（核心） ===
// -------------------------------------------
// 你的資料架構：
// /artifacts/{appId}/public/data/kmlList/{kmlId}
// /users/{uid}
// /settings/*
// -------------------------------------------

window.firepaths = {
    appId: appId,

    // 🔥 主資料根位置
    root: db.collection("artifacts").doc(appId).collection("public").doc("data"),

    // 🔥 KML 圖層統一位置（新的唯一來源）
    kmlList:
        db.collection("artifacts")
            .doc(appId)
            .collection("public")
            .doc("data")
            .collection("kmlList"),

    // 🔥 使用者資料 (角色/認證)
    users: db.collection("users"),

    // 🔥 設定資料，例如註冊碼 (/settings/registration)
    settings: db.collection("settings")
};

console.log("🔥 firepaths =", window.firepaths);


// -------------------------------------------
// === 4. 全域初始狀態 flags ===
// -------------------------------------------

// 確保 KML 載入流程順序正確（防止多次觸發）
window.isLoadingKml = false;

// 記錄目前選取的 KML ID
window.currentKmlLayerId = null;

// 所有 KML features (map-logic.js 會使用)
window.allKmlFeatures = [];

console.log("🔥 Firebase 已初始化完成");
