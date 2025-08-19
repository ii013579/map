// auth-kml-management.js v4.2.47 - 修正重複讀取問題（強化判斷）

document.addEventListener('DOMContentLoaded', () => {
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

    const handleKmlLayerSelectChange = () => {
        const kmlId = kmlLayerSelect?.value;
        updatePinButtonState();

        if (kmlId && typeof window.loadKmlLayerFromFirestore === 'function') {
            // 🔒 避免重複讀取
            if (window.currentKmlLayerId !== kmlId) {
                window.loadKmlLayerFromFirestore(kmlId);
            } else {
                console.log(`⚡ 已載入過圖層 ${kmlId}，不再重複讀取`);
            }
        } else if (!kmlId && typeof window.clearAllKmlLayers === 'function') {
            window.clearAllKmlLayers();
        }
    };

    // --- 載入釘選圖層（應用啟動時），已修正重複讀取問題 ---
    const tryLoadPinnedKmlLayerWhenReady = () => {
        const oldPinnedId = localStorage.getItem('pinnedKmlLayerId');
        if (oldPinnedId) {
            localStorage.setItem('pinnedKmlId', oldPinnedId);
            localStorage.removeItem('pinnedKmlLayerId');
            console.log('已將舊的釘選狀態轉換為新格式。');
        }

        const pinnedId = localStorage.getItem('pinnedKmlId');
        currentPinnedKmlId = pinnedId;
        
        if (pinnedId && kmlLayerSelect) {
            const option = Array.from(kmlLayerSelect.options).find(opt => opt.value === pinnedId);
            if (option) {
                kmlLayerSelect.value = pinnedId;
                // 🔒 避免重複讀取
                if (typeof window.loadKmlLayerFromFirestore === 'function') {
                    if (window.currentKmlLayerId !== pinnedId) {
                        window.loadKmlLayerFromFirestore(pinnedId);
                    } else {
                        console.log(`⚡ 已自動載入過圖層 ${pinnedId}，不再重複讀取`);
                    }
                }
                updatePinButtonState();
                return;
            } else {
                localStorage.removeItem('pinnedKmlId');
                currentPinnedKmlId = null;
                console.warn(`已釘選的 KML 圖層 ID ${pinnedId} 不存在，已清除釘選狀態。`);
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

    // ... 其餘程式碼保持不變 ...

    if (kmlLayerSelect) {
      kmlLayerSelect.addEventListener('change', handleKmlLayerSelectChange);
    } else {
      console.error('找不到 id 為 "kmlLayerSelect" 的下拉選單，KML 載入功能無法啟用。');
    }

    if (pinButton) {
        pinButton.addEventListener('click', () => {
            const selectedKmlId = kmlLayerSelect.value;
            const currentPinnedId = localStorage.getItem('pinnedKmlId');

            if (!selectedKmlId) {
                window.showMessage('釘選失敗', '請先從下拉選單中選擇一個 KML 圖層才能釘選。');
                return;
            }
            
            if (currentPinnedId === selectedKmlId) {
                localStorage.removeItem('pinnedKmlId');
                window.showMessageCustom({
                    title: '取消釘選',
                    message: `「${kmlLayerSelect.options[kmlLayerSelect.selectedIndex]?.textContent || selectedKmlId}」已取消釘選，下次將不自動載入。`,
                    buttonText: '確定',
                    autoClose: true,
                    autoCloseDelay: 3000
                });
            } else {
                localStorage.setItem('pinnedKmlId', selectedKmlId);
                const selectedOption = kmlLayerSelect.options[kmlLayerSelect.selectedIndex];
                const kmlLayerName = selectedOption ? selectedOption.textContent : selectedKmlId;
                window.showMessageCustom({
                    title: '釘選成功',
                    message: `「${kmlLayerName}」已釘選為預設圖層。`,
                    buttonText: '確定',
                    autoClose: true,
                    autoCloseDelay: 3000
                });
            }
            updatePinButtonState();
        });
    } else {
        console.error('找不到 id 為 "pinButton" 的圖釘按鈕，釘選功能無法啟用。');
    }
});
