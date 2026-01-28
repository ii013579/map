// auth-kml-management.js v1.9.7 - 完整版（含 onSnapshot unsubscribe 管理、簡易 TTL cache、上傳/刪除 KML 與註冊碼管理）
(function () {
  'use strict';

  // 簡易 DOM 取得 helper（若找不到回傳 null）
  const $ = id => document.getElementById(id);

  // 快取常用 DOM 元素（部分可能為 null，使用時要加以檢查）
  const els = {
    loginForm: $('loginForm'),
    loggedInDashboard: $('loggedInDashboard'),
    googleSignInBtn: $('googleSignInBtn'),
    logoutBtn: $('logoutBtn'),
    loginMessage: $('loginMessage'),
    userEmailDisplay: $('userEmailDisplay'),
    pinButton: $('pinButton'),
    kmlLayerSelect: $('kmlLayerSelect'),

    uploadKmlSectionDashboard: $('uploadKmlSectionDashboard'),
    selectedKmlFileNameDashboard: $('selectedKmlFileNameDashboard'),
    uploadKmlSubmitBtnDashboard: $('uploadKmlSubmitBtnDashboard'),
    hiddenKmlFileInput: $('hiddenKmlFileInput'),
    deleteKmlSectionDashboard: $('deleteKmlSectionDashboard'),
    kmlLayerSelectDashboard: $('kmlLayerSelectDashboard'),
    deleteSelectedKmlBtn: $('deleteSelectedKmlBtn'),

    registrationSettingsSection: $('registrationSettingsSection'),
    generateRegistrationCodeBtn: $('generateRegistrationCodeBtn'),
    registrationCodeDisplay: $('registrationCodeDisplay'),
    registrationCodeCountdown: $('registrationCodeCountdown'),
    registrationExpiryDisplay: $('registrationExpiryDisplay'),

    userManagementSection: $('userManagementSection'),
    refreshUsersBtn: $('refreshUsersBtn'),
    userListDiv: $('userList'),

    // 確認視窗相關元素（若不存在，showConfirmationModal 會 fallback）
    confirmationModalOverlay: $('confirmationModalOverlay'),
    confirmationModalTitle: $('confirmationModalTitle'),
    confirmationModalMessage: $('confirmationModalMessage'),
    confirmYesBtn: $('confirmYesBtn'),
    confirmNoBtn: $('confirmNoBtn')
  };

  // 全域狀態
  window.currentUserRole = null;     // 當前使用者角色
  let currentKmlLayers = [];        // 目前查到的 KML 圖層清單
  let registrationCodeTimer = null; // 註冊碼倒數計時器
  let currentPinnedKmlId = null;    // 當前釘選的 KML ID（來自 localStorage）

  // === 新增：追蹤目前 user onSnapshot 的 unsubscribe 與簡易短期快取 ===
  let _currentUserDocUnsub = null;
  const _simpleCache = {
    settings: { ts: 0, data: null },
    usersList: { ts: 0, data: null }
  };

  // 角色顯示名稱（中文）
  const getRoleDisplayName = role => {
    switch (role) {
      case 'unapproved': return '未審核';
      case 'user': return '一般';
      case 'editor': return '編輯者';
      case 'owner': return '擁有者';
      default: return role || '';
    }
  };

  // 取得 KML collection 的 Firestore 參照（DRY）
  const getKmlCollectionRef = () => {
    if (typeof db === 'undefined' || typeof appId === 'undefined') {
      throw new Error('Firestore 或 appId 未定義，無法存取 kmlLayers。');
    }
    return db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers');
  };

  // ----------------------- Authentication (Google Sign-In) -----------------------
  async function signInWithGooglePopup() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const userCredential = await auth.signInWithPopup(provider);
      const user = userCredential.user;
      if (!user) throw new Error('Google Sign-In 未返回使用者。');
      await onUserSignedIn(user);
    } catch (e) {
      console.error('signInWithGooglePopup 錯誤：', e);
      window.showMessage?.('登入失敗', e.message || String(e));
    }
  }

  // 安全登出：解除監聽再登出
  async function safeSignOut() {
    try {
      if (_currentUserDocUnsub) {
        try { _currentUserDocUnsub(); } catch (e) { /* ignore */ }
        _currentUserDocUnsub = null;
      }
      await auth.signOut();
    } catch (e) {
      console.warn('safeSignOut 發生錯誤：', e);
    }
  }

  // 將 onUserSignedIn 暴露以便其他模組呼叫（例如登入流程成功後）
  async function onUserSignedIn(user) {
    if (!user) return;

    // UI 更新
    if (els.loginForm) els.loginForm.style.display = 'none';
    if (els.loggedInDashboard) els.loggedInDashboard.style.display = 'block';
    if (els.userEmailDisplay) {
      els.userEmailDisplay.textContent = `${user.email} (載入中...)`;
      els.userEmailDisplay.style.display = 'block';
    }

    // 監聽使用者文件以取得即時角色變更，但先解除舊的監聽器以免累積
    const userDocRef = db.collection('users').doc(user.uid);
    if (_currentUserDocUnsub) {
      try { _currentUserDocUnsub(); } catch (e) { /* ignore */ }
      _currentUserDocUnsub = null;
    }
    _currentUserDocUnsub = userDocRef.onSnapshot(async (doc) => {
      try {
        if (!doc.exists) {
          // 若使用者文件不存在，建立基本文件（unapproved）
          await db.collection('users').doc(user.uid).set({
            email: user.email,
            name: user.displayName || '',
            role: 'unapproved',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          return;
        }
        const data = doc.data() || {};
        window.currentUserRole = data.role || 'unapproved';
        if (els.userEmailDisplay) {
          els.userEmailDisplay.textContent = `${user.email} (${window.currentUserRole})`;
        }
      } catch (e) {
        console.warn('onSnapshot 處理使用者檔案時發生錯誤：', e);
      }
    });

    // 其他登入後初始化：載入 KML 清單、設定 UI 等
    try {
      // 載入 KML 列表 metadata（僅 metadata, 非整包 geojson）
      currentKmlLayers = await listKmlMetaForDashboard();
      populateKmlSelects(currentKmlLayers);
    } catch (e) {
      console.warn('登入後載入 KML metadata 失敗：', e);
    }
  }

  // 供外部呼叫者（例如 UI 事件）使用
  window._internalAuthOnUserSignedIn = onUserSignedIn;

  // ----------------------- 簡易快取 helpers -----------------------
  async function getCachedSettingsDoc(ttlMs = 1000 * 60 * 2) {
    const now = Date.now();
    if (_simpleCache.settings.data && (now - _simpleCache.settings.ts) < ttlMs) {
      return _simpleCache.settings.data;
    }
    try {
      const snap = await db.collection('settings').doc('registration').get();
      const data = snap.exists ? snap.data() : null;
      _simpleCache.settings = { ts: now, data };
      return data;
    } catch (e) {
      console.warn('getCachedSettingsDoc 讀取失敗：', e);
      return null;
    }
  }

  // ----------------------- KML 上傳 / 刪除 / 列表管理 -----------------------
  // 取得 dashboard 需要的 KML metadata（僅 meta）
  async function listKmlMetaForDashboard() {
    try {
      const col = getKmlCollectionRef();
      const snap = await col.get();
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() || {}) }));
      return arr;
    } catch (e) {
      console.warn('listKmlMetaForDashboard 失敗：', e);
      return [];
    }
  }

  function populateKmlSelects(kmlList = []) {
    // 填充 UI 下拉選單（若存在）
    if (els.kmlLayerSelect) {
      els.kmlLayerSelect.innerHTML = '<option value="">-- 選擇 KML --</option>';
      kmlList.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k.id;
        opt.textContent = k.name || k.id;
        els.kmlLayerSelect.appendChild(opt);
      });
    }
    if (els.kmlLayerSelectDashboard) {
      els.kmlLayerSelectDashboard.innerHTML = '<option value="">-- 選擇 KML --</option>';
      kmlList.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k.id;
        opt.textContent = k.name || k.id;
        els.kmlLayerSelectDashboard.appendChild(opt);
      });
    }
  }

  // 上傳 KML（前端解析成 geojson，儲存到 Firestore）
  async function uploadKmlFile(file, options = { overwriteId: null }) {
    if (!file) {
      window.showMessage?.('錯誤', '未選擇檔案。');
      return null;
    }
    try {
      // 讀取檔案字串
      const text = await file.text();
      // 如果專案使用 togeojson/togeojson，嘗試解析 KML -> GeoJSON
      let geojson = null;
      try {
        // 假設 togeojson 在全域
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(text, 'text/xml');
        if (window.toGeoJSON || window.toGeoJSON === undefined) {
          // toGeoJSON 可能在 unpkg 名稱為 toGeoJSON 或 togeojson，嘗試常見名稱
          geojson = window.togeojson ? window.togeojson.kml(kmlDoc) : (window.toGeoJSON ? window.toGeoJSON.kml(kmlDoc) : null);
        }
      } catch (e) {
        console.warn('嘗試解析 KML 為 GeoJSON 時失敗，將嘗試作為 GeoJSON 處理：', e);
      }

      // 如果無法解析成 KML，嘗試直接 parse JSON（如果上傳的是 geojson）
      if (!geojson) {
        try {
          geojson = JSON.parse(text);
        } catch (e) {
          throw new Error('檔案不是有效的 KML 或 GeoJSON。');
        }
      }

      // 儲存到 Firestore（geojson 轉成字串以避免超大 field 直接顯示）
      const col = getKmlCollectionRef();
      const docRef = options.overwriteId ? col.doc(options.overwriteId) : col.doc();
      const payload = {
        name: file.name,
        uploadTime: firebase.firestore.FieldValue.serverTimestamp(),
        uploadedBy: auth.currentUser?.email || auth.currentUser?.uid || 'anonymous',
        uploadedByRole: window.currentUserRole || null,
        geojson: JSON.stringify(geojson)
      };

      await docRef.set(payload, { merge: true });
      window.showMessage?.('成功', `KML 檔案 "${file.name}" 已儲存（ID=${docRef.id}）。`);
      return docRef.id;
    } catch (e) {
      console.error('uploadKmlFile 失敗：', e);
      window.showMessage?.('上傳失敗', e.message || String(e));
      return null;
    }
  }

  // 刪除 KML
  async function deleteKmlById(kmlId) {
    if (!kmlId) {
      window.showMessage?.('錯誤', '未選擇要刪除的 KML。');
      return false;
    }
    try {
      await getKmlCollectionRef().doc(kmlId).delete();
      window.showMessage?.('成功', 'KML 已刪除。');
      return true;
    } catch (e) {
      console.error('deleteKmlById 失敗：', e);
      window.showMessage?.('刪除失敗', e.message || String(e));
      return false;
    }
  }

  // ----------------------- 管理員：使用者列表 -----------------------
  const refreshUserList = async () => {
    const container = els.userListDiv;
    if (!container) {
      console.error('找不到使用者列表容器 (#userList)');
      return;
    }
    // 移除現有卡片
    container.querySelectorAll('.user-card').forEach(c => c.remove());

    try {
      const now = Date.now();
      const ttl = 1000 * 60 * 1; // 1 分鐘快取
      if (_simpleCache.usersList.data && (now - _simpleCache.usersList.ts) < ttl) {
        renderUsers(_simpleCache.usersList.data);
        return;
      }

      const usersRef = db.collection('users');
      const snapshot = await usersRef.get();

      if (snapshot.empty) {
        container.innerHTML = '<p>目前沒有註冊用戶。</p>';
        return;
      }

      const usersData = [];
      snapshot.forEach(doc => {
        const user = doc.data() || {};
        const uid = doc.id;
        usersData.push({ uid, ...user });
      });
      _simpleCache.usersList = { ts: Date.now(), data: usersData };
      renderUsers(usersData);
    } catch (e) {
      console.error('refreshUserList 發生錯誤：', e);
      container.innerHTML = '<p>讀取使用者列��失敗。</p>';
    }
  };

  function renderUsers(users) {
    const container = els.userListDiv;
    if (!container) return;
    users.forEach(u => {
      const div = document.createElement('div');
      div.classList.add('user-card');
      div.textContent = `${u.email || u.uid} - ${getRoleDisplayName(u.role)}`;
      container.appendChild(div);
    });
  }

  // ----------------------- 註冊碼生成與管理 -----------------------
  function generateRegistrationAlphanumericCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out = '';
    for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  }

  async function generateAndSaveRegistrationCode(secondsValid = 60) {
    if (window.currentUserRole !== 'owner') {
      window.showMessage?.('權限不足', '只有管理員才能生成註冊碼。');
      return null;
    }
    try {
      const code = generateRegistrationAlphanumericCode();
      const expiry = new Date();
      expiry.setSeconds(expiry.getSeconds() + secondsValid);

      await db.collection('settings').doc('registration').set({
        oneTimeCode: code,
        oneTimeCodeExpiry: firebase.firestore.Timestamp.fromDate(expiry)
      }, { merge: true });

      // 更新 UI 顯示（���存在）
      if (els.registrationCodeDisplay) els.registrationCodeDisplay.textContent = code;
      if (els.registrationCodeExpiry) els.registrationExpiryDisplay.textContent = expiry.toISOString();

      // 倒數的簡單實作（在 UI 中顯示）
      if (registrationCodeTimer) clearInterval(registrationCodeTimer);
      let remaining = secondsValid;
      if (els.registrationCodeCountdown) els.registrationCodeCountdown.textContent = ` (剩餘 ${remaining} 秒)`;
      registrationCodeTimer = setInterval(() => {
        remaining -= 1;
        if (els.registrationCodeCountdown) els.registrationCodeCountdown.textContent = ` (剩餘 ${remaining} 秒)`;
        if (remaining <= 0) {
          clearInterval(registrationCodeTimer);
          registrationCodeTimer = null;
          if (els.registrationCodeCountdown) els.registrationCodeCountdown.textContent = '';
        }
      }, 1000);

      window.showMessage?.('已生成註冊碼', `註冊碼：${code}，有效 ${secondsValid} 秒`);
      return code;
    } catch (e) {
      console.error('generateAndSaveRegistrationCode 失敗：', e);
      window.showMessage?.('錯誤', '生成註冊碼失敗。');
      return null;
    }
  }

  // ----------------------- UI 事件綁定 -----------------------
  document.addEventListener('DOMContentLoaded', () => {
    if (els.googleSignInBtn) {
      els.googleSignInBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await signInWithGooglePopup();
      });
    }
    if (els.logoutBtn) {
      els.logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await safeSignOut();
        // UI 回到未登入狀態
        if (els.loginForm) els.loginForm.style.display = 'block';
        if (els.loggedInDashboard) els.loggedInDashboard.style.display = 'none';
        if (els.userEmailDisplay) els.userEmailDisplay.style.display = 'none';
      });
    }

    // KML 上傳按鈕（dashboard）
    if (els.hiddenKmlFileInput && els.uploadKmlSubmitBtnDashboard) {
      els.hiddenKmlFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (els.selectedKmlFileNameDashboard) els.selectedKmlFileNameDashboard.textContent = file.name;
      });
      els.uploadKmlSubmitBtnDashboard.addEventListener('click', async (e) => {
        e.preventDefault();
        const fileInput = els.hiddenKmlFileInput;
        const file = fileInput && fileInput.files && fileInput.files[0];
        if (!file) {
          window.showMessage?.('錯誤', '請先選擇檔案。');
          return;
        }
        await uploadKmlFile(file);
        // 重新載入 KML list
        currentKmlLayers = await listKmlMetaForDashboard();
        populateKmlSelects(currentKmlLayers);
      });
    }

    // 刪除 KML
    if (els.deleteSelectedKmlBtn && els.kmlLayerSelectDashboard) {
      els.deleteSelectedKmlBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = els.kmlLayerSelectDashboard.value;
        if (!id) { window.showMessage?.('錯誤', '請選擇要刪除的 KML。'); return; }
        const ok = confirm('確定要刪除這個 KML 嗎？');
        if (!ok) return;
        const success = await deleteKmlById(id);
        if (success) {
          currentKmlLayers = await listKmlMetaForDashboard();
          populateKmlSelects(currentKmlLayers);
        }
      });
    }

    // 生成註冊碼按鈕
    if (els.generateRegistrationCodeBtn) {
      els.generateRegistrationCodeBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await generateAndSaveRegistrationCode(60);
      });
    }

    // 刷新使用者列表
    if (els.refreshUsersBtn) {
      els.refreshUsersBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await refreshUserList();
      });
    }
  });

  // ----------------------- 對外暴露的 API -----------------------
  window.safeSignOut = safeSignOut;
  window.uploadKmlFile = uploadKmlFile;
  window.deleteKmlById = deleteKmlById;
  window.refreshUserList = refreshUserList;
  window.generateAndSaveRegistrationCode = generateAndSaveRegistrationCode;
  window.getCachedSettingsDoc = getCachedSettingsDoc;

  // 預載：如果使用者已登入 (例如 Firebase auth state persisted)，在初始化時嘗試拿到 user 並初始化
  if (typeof auth !== 'undefined') {
    auth.onAuthStateChanged((user) => {
      if (user) {
        onUserSignedIn(user).catch(e => console.warn('onUserSignedIn 錯誤：', e));
      } else {
        // 未登入的預設 UI 處理（若需要）
      }
    });
  }

})();