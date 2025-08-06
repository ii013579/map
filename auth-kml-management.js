// auth-kml-management.js - 修正並新增除錯訊息版本

document.addEventListener('DOMContentLoaded', () => {
    console.log("auth-kml-management.js: DOMContentLoaded 事件已觸發，開始初始化。");
    
    const loginForm = document.getElementById('loginForm');
    const loggedInDashboard = document.getElementById('loggedInDashboard');
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginMessage = document.getElementById('loginMessage');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const pinButton = document.getElementById('pinButton');
    const kmlLayerSelect = document.getElementById('kmlLayerSelect');

    const uploadKmlSectionDashboard = document.getElementById('uploadKmlSectionDashboard');
    const selectedKmlFileNameDashboard = document.getElementById('selectedKmlFileNameDashboard');
    const uploadKmlSubmitBtnDashboard = document.getElementById('uploadKmlSubmitBtnDashboard');
    const hiddenKmlFileInput = document.getElementById('hiddenKmlFileInput');
    const deleteKmlSectionDashboard = document.getElementById('deleteKmlSectionDashboard');
    const kmlLayerSelectDashboard = document.getElementById('kmlLayerSelectDashboard');
    const deleteSelectedKmlBtn = document.getElementById('deleteSelectedKmlBtn');

    const registrationSettingsSection = document.getElementById('registrationSettingsSection');
    const generateRegistrationCodeBtn = document.getElementById('generateRegistrationCodeBtn');
    const registrationCodeDisplay = document.getElementById('registrationCodeDisplay');
    const registrationCodeCountdown = document.getElementById('registrationCodeCountdown');
    const registrationExpiryDisplay = document.getElementById('registrationExpiryDisplay');

    const userManagementSection = document.getElementById('userManagementSection');
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    const userListDiv = document.getElementById('userList');

    window.currentUserRole = null;
    let currentKmlLayers = [];
    let registrationCodeTimer = null;
    let currentPinnedKmlId = null;
    
    // === 新增：全域圖層快取物件 ===
    window.kmlLayerCache = {};

    const getRoleDisplayName = (role) => {
        switch (role) {
            case 'unapproved': return '未審核';
            case 'user': return '一般';
            case 'editor': return '編輯者';
            case 'owner': return '擁有者';
            default: return role;
        }
    };

    const updatePinButtonState = () => {
        if (!pinButton || !kmlLayerSelect) return;

        const kmlId = kmlLayerSelect.value;
        const pinnedId = localStorage.getItem('pinnedKmlId');
        
        if (kmlId) {
            pinButton.removeAttribute('disabled');
        } else {
            pinButton.setAttribute('disabled', 'true');
        }

        if (kmlId && pinnedId === kmlId) {
            pinButton.classList.add('clicked');
        } else {
            pinButton.classList.remove('clicked');
        }
    };

    // --- 修正後的 KML 圖層選擇處理函數 ---
    const handleKmlLayerSelectChange = () => {
        console.log("auth-kml-management.js: 圖層選擇器已變動，正在處理...");
        const kmlId = kmlLayerSelect?.value;
        
        updatePinButtonState();

        if (kmlId) {
            // 在載入前，檢查快取中是否有資料
            if (window.kmlLayerCache && window.kmlLayerCache[kmlId] && typeof window.loadKmlLayerFromCache === 'function') {
                console.log(`auth-kml-management.js: 從快取載入圖層：${kmlId}`);
                window.loadKmlLayerFromCache(kmlId);
            } else if (typeof window.loadKmlLayerFromFirestore === 'function') {
                console.log(`auth-kml-management.js: 快取中沒有資料，從 Firestore 載入圖層：${kmlId}`);
                window.loadKmlLayerFromFirestore(kmlId);
            } else {
                console.error("auth-kml-management.js: 找不到 loadKmlLayerFromFirestore 或 loadKmlLayerFromCache 函數。");
            }
        } else if (!kmlId && typeof window.clearAllKmlLayers === 'function') {
            console.log("auth-kml-management.js: 未選擇圖層，清除所有圖層。");
            window.clearAllKmlLayers();
        }
    };
    
    // 新增事件監聽器
    if (kmlLayerSelect) {
        kmlLayerSelect.addEventListener('change', handleKmlLayerSelectChange);
    } else {
        console.error("auth-kml-management.js: 找不到 kmlLayerSelect 元素，請檢查 HTML。");
    }

    const tryLoadPinnedKmlLayerWhenReady = () => {
        const oldPinnedId = localStorage.getItem('pinnedKmlLayerId');
        if (oldPinnedId) {
            localStorage.setItem('pinnedKmlId', oldPinnedId);
            localStorage.removeItem('pinnedKmlLayerId');
            console.log('auth-kml-management.js: 已將舊的釘選狀態轉換為新格式。');
        }

        const pinnedId = localStorage.getItem('pinnedKmlId');
        currentPinnedKmlId = pinnedId;
        
        if (pinnedId && kmlLayerSelect) {
            const option = Array.from(kmlLayerSelect.options).find(opt => opt.value === pinnedId);
            if (option) {
                kmlLayerSelect.value = pinnedId;
                
                // 載入釘選圖層時，同樣檢查快取
                if (window.kmlLayerCache[pinnedId] && typeof window.loadKmlLayerFromCache === 'function') {
                    console.log(`auth-kml-management.js: 從快取載入釘選圖層：${pinnedId}`);
                    window.loadKmlLayerFromCache(pinnedId);
                } else if (typeof window.loadKmlLayerFromFirestore === 'function') {
                    console.log(`auth-kml-management.js: 快取中沒有資料，從 Firestore 載入釘選圖層：${pinnedId}`);
                    window.loadKmlLayerFromFirestore(pinnedId);
                }

                updatePinButtonState();
                return;
            } else {
                localStorage.removeItem('pinnedKmlId');
                currentPinnedKmlId = null;
                console.warn(`auth-kml-management.js: 已釘選的 KML 圖層 ID ${pinnedId} 不存在，已清除釘選狀態。`);
            }
        }
        
        if (kmlLayerSelect) {
            kmlLayerSelect.value = "";
        }
        updatePinButtonState();
        if (typeof window.clearAllKmlLayers === 'function') {
            window.clearAllKmlLayers();
        }
    };

    const updateKmlLayerSelects = async () => {
        console.log("auth-kml-management.js: 正在更新 KML 圖層下拉選單。");
        const kmlLayerSelect = document.getElementById('kmlLayerSelect');
        const kmlLayerSelectDashboard = document.getElementById('kmlLayerSelectDashboard');
        const deleteSelectedKmlBtn = document.getElementById('deleteSelectedKmlBtn');
        
        if (!kmlLayerSelect) {
            console.error("auth-kml-management.js: 找不到 KML 圖層下拉選單。");
            return;
        }

        kmlLayerSelect.innerHTML = '<option value="">-- 請選擇 KML 圖層 --</option>';
        if (kmlLayerSelectDashboard) {
            kmlLayerSelectDashboard.innerHTML = '<option value="">-- 請選擇 KML 圖層 --</option>';
        }
        if (deleteSelectedKmlBtn) deleteSelectedKmlBtn.disabled = true;
        
        kmlLayerSelect.disabled = false;
        
        const canEdit = (window.currentUserRole === 'owner' || window.currentUserRole === 'editor');
        if (uploadKmlSectionDashboard) {
            uploadKmlSectionDashboard.style.display = canEdit ? 'flex' : 'none';
        }
        if (deleteKmlSectionDashboard) {
            deleteKmlSectionDashboard.style.display = canEdit ? 'flex' : 'none';
        }
        if (kmlLayerSelectDashboard) kmlLayerSelectDashboard.disabled = !canEdit;
        if (uploadKmlSubmitBtnDashboard) uploadKmlSubmitBtnDashboard.disabled = !canEdit;

        try {
            const kmlRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers');
            let snapshot;

            if (window.currentUserRole === 'editor' && auth.currentUser && auth.currentUser.email) {
                snapshot = await kmlRef.where('uploadedBy', '==', auth.currentUser.email).get();
            } else {
                snapshot = await kmlRef.get();
            }

            currentKmlLayers = [];

            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const kmlId = doc.id;
                    const kmlName = data.name || `KML_${kmlId.substring(0, 8)}`;
                    const option = document.createElement('option');
                    option.value = kmlId;
                    option.textContent = kmlName;
                    kmlLayerSelect.appendChild(option);

                    if (kmlLayerSelectDashboard) {
                        const optionDashboard = document.createElement('option');
                        optionDashboard.value = kmlId;
                        optionDashboard.textContent = kmlName;
                        kmlLayerSelectDashboard.appendChild(optionDashboard);
                    }
                    currentKmlLayers.push({ id: kmlId, name: kmlName });
                });
            }
            if (currentKmlLayers.length > 0 && canEdit && deleteSelectedKmlBtn) {
                deleteSelectedKmlBtn.disabled = false;
            }
            
            console.log("auth-kml-management.js: KML 圖層列表更新完成。");
            tryLoadPinnedKmlLayerWhenReady();
        } catch (error) {
            console.error("auth-kml-management.js: 更新 KML 圖層列表時出錯:", error);
            window.showMessage('錯誤', '無法載入 KML 圖層列表。');
        }
    };
    
    // ... [其餘程式碼保持不變] ...
    // (由於程式碼長度限制，這裡只顯示與問題相關的部分，請確保您替換所有內容)

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // ... [登入後的邏輯] ...
        } else {
            // ... [登出後的邏輯] ...
        }
    });

    googleSignInBtn.addEventListener('click', async () => {
        // ... [登入邏輯] ...
    });

    logoutBtn.addEventListener('click', async () => {
        // ... [登出邏輯] ...
    });
    
    // 監聽器和函數
    selectedKmlFileNameDashboard.addEventListener('click', () => {
        hiddenKmlFileInput.click();
    });

    hiddenKmlFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            selectedKmlFileNameDashboard.textContent = file.name;
            uploadKmlSubmitBtnDashboard.disabled = false;
        } else {
            selectedKmlFileNameDashboard.textContent = '尚未選擇檔案';
            uploadKmlSubmitBtnDashboard.disabled = true;
        }
    });

    uploadKmlSubmitBtnDashboard.addEventListener('click', async () => {
        // ... [上傳邏輯] ...
    });

    deleteSelectedKmlBtn.addEventListener('click', async () => {
        // ... [刪除邏輯] ...
    });

    // ... [其他函數，例如 generateRegistrationAlphanumericCode, refreshUserList, showConfirmationModal 等] ...
    // 確保您的檔案中包含這些函式的完整定義。
});