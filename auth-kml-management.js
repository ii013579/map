// auth-kml-management.js v4.2.31

document.addEventListener('DOMContentLoaded', () => {
    // 獲取所有相關的 DOM 元素
    const loginForm = document.getElementById('loginForm');
    const loggedInDashboard = document.getElementById('loggedInDashboard');
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginMessage = document.getElementById('loginMessage');
    const userEmailDisplay = document.getElementById('userEmailDisplay');

    const uploadKmlSectionDashboard = document.getElementById('uploadKmlSectionDashboard');
    const selectedKmlFileNameDashboard = document.getElementById('selectedKmlFileNameDashboard');
    const uploadKmlSubmitBtnDashboard = document.getElementById('uploadKmlSubmitBtnDashboard');
    const hiddenKmlFileInput = document.getElementById('hiddenKmlFileInput'); // 新增這行
    const deleteKmlSectionDashboard = document.getElementById('deleteKmlSectionDashboard');
    const kmlLayerSelectDashboard = document.getElementById('kmlLayerSelectDashboard');
    const deleteSelectedKmlBtn = document.getElementById('deleteSelectedKmlBtn');

    const registrationSettingsSection = document.getElementById('registrationSettingsSection');
    const generateRegistrationCodeBtn = document.getElementById('generateRegistrationCodeBtn');
    const registrationCodeDisplay = document.getElementById('registrationCodeDisplay');
    const registrationCodeCountdown = document.getElementById('registrationCodeCountdown');
    const registerUserBtn = document.getElementById('registerUserBtn');
    const registrationCodeInput = document.getElementById('registrationCodeInput');
    const cancelRegistrationCodeBtn = document.getElementById('cancelRegistrationCodeBtn');

    const userManagementSection = document.getElementById('userManagementSection');
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    const userListDiv = document.getElementById('userListDiv');
    const userTableBody = document.getElementById('userTableBody');
    const searchUsersInput = document.getElementById('searchUsersInput');
    const downloadUserListBtn = document.getElementById('downloadUserListBtn');
    const userCountDisplay = document.getElementById('userCountDisplay');

    // 新增用於前端 KML 圖層選擇的元素
    const kmlLayerSelect = document.getElementById('kmlLayerSelect');
    const pinKmlLayerBtn = document.getElementById('pinKmlLayerBtn'); // 獲取新增的圖釘按鈕

    // Firebase 配置 (請確保這些變數在其他地方已正確初始化)
    // 例如：const firebaseConfig = { apiKey: "...", authDomain: "...", ... };
    // firebase.initializeApp(firebaseConfig);
    // const auth = firebase.auth();
    // const db = firebase.firestore();
    // const storage = firebase.storage();
    // const appId = "您的應用ID"; // 替換為您的實際應用 ID

    let currentFile = null;
    let registrationCodeTimer = null;
    let userListSortColumn = '';
    let userListSortDirection = 'asc';

    // UI 相關函數
    const updateUI = (user) => {
        if (user) {
            loggedInDashboard.style.display = 'block';
            loginForm.style.display = 'none';
            userEmailDisplay.textContent = user.email;
            window.currentUserEmail = user.email; // 設定全局變數
            fetchUserRole(user.uid);
            fetchKmlLayersForSelection(); // 登入後載入KML圖層列表到地圖選擇器
        } else {
            loggedInDashboard.style.display = 'none';
            loginForm.style.display = 'block';
            userEmailDisplay.textContent = '';
            window.currentUserEmail = null; // 清除全局變數
            window.currentUserRole = null; // 清除全局變數
            window.clearAllKmlLayers(); // 登出時清除所有 KML 圖層
        }
    };

    // 取得用戶角色
    const fetchUserRole = async (uid) => {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const userData = doc.data();
                window.currentUserRole = userData.role; // 設定全局變數
                console.log('User Role:', window.currentUserRole);
                updateAdminUI(window.currentUserRole);
            } else {
                console.log('No user role found for UID:', uid);
                window.currentUserRole = 'guest'; // 預設為 guest
                updateAdminUI(window.currentUserRole);
            }
        } catch (error) {
            console.error('Error fetching user role:', error);
            window.currentUserRole = 'guest'; // 發生錯誤時預設為 guest
            updateAdminUI(window.currentUserRole);
        }
    };

    // 根據角色更新管理面板 UI
    const updateAdminUI = (role) => {
        if (role === 'admin' || role === 'owner') {
            uploadKmlSectionDashboard.style.display = 'block';
            deleteKmlSectionDashboard.style.display = 'block';
            registrationSettingsSection.style.display = 'block';
            userManagementSection.style.display = 'block';
        } else {
            uploadKmlSectionDashboard.style.display = 'none';
            deleteKmlSectionDashboard.style.display = 'none';
            registrationSettingsSection.style.display = 'none';
            userManagementSection.style.display = 'none';
        }
    };

    // Firebase Authentication 狀態監聽
    auth.onAuthStateChanged((user) => {
        updateUI(user);
    });

    // 事件監聽器：Google 登入
    googleSignInBtn.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await auth.signInWithPopup(provider);
            const user = result.user;
            // 檢查用戶是否已在 Firestore 的 users 集合中
            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();
            if (!doc.exists) {
                // 新用戶，寫入 Firestore
                await userRef.set({
                    email: user.email,
                    role: 'pending', // 初始角色為 pending
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    registrationCodeUsed: null // 新增欄位
                });
                showMessage('登入成功', '新用戶已註冊，等待管理員審核。');
            } else {
                showMessage('登入成功', '歡迎回來！');
            }
        } catch (error) {
            console.error('Google Sign-In Error:', error);
            showMessage('登入失敗', error.message);
        }
    });

    // 事件監聽器：登出
    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            showMessage('登出成功', '您已成功登出。');
        } catch (error) {
            console.error('Logout Error:', error);
            showMessage('登出失敗', error.message);
        }
    });

    // 事件監聽器：上傳 KML 檔案（觸發隱藏的 input 點擊）
    uploadKmlSectionDashboard.querySelector('button').addEventListener('click', () => {
        hiddenKmlFileInput.click();
    });

    // 事件監聽器：處理檔案選擇
    hiddenKmlFileInput.addEventListener('change', (event) => {
        currentFile = event.target.files[0];
        if (currentFile) {
            selectedKmlFileNameDashboard.textContent = `選定檔案: ${currentFile.name}`;
            uploadKmlSubmitBtnDashboard.disabled = false;
        } else {
            selectedKmlFileNameDashboard.textContent = '未選定檔案';
            uploadKmlSubmitBtnDashboard.disabled = true;
        }
    });

    // 事件監聽器：提交上傳 KML
    uploadKmlSubmitBtnDashboard.addEventListener('click', async () => {
        if (!currentFile) {
            showMessage('錯誤', '請先選擇一個 KML 檔案。');
            return;
        }
        if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'owner') {
            showMessage('權限不足', '只有管理員才能上傳 KML 檔案。');
            return;
        }

        const fileName = currentFile.name;
        const storageRef = storage.ref(`kml_files/${appId}/${fileName}`);
        try {
            // 上傳檔案
            showMessage('上傳中', '正在上傳 KML 檔案...', true); // 顯示上傳中訊息，不自動關閉
            await storageRef.put(currentFile);
            const downloadURL = await storageRef.getDownloadURL();

            // 解析 KML 並儲存 GeoJSON features 到 Firestore
            const kmlText = await currentFile.text();
            const parser = new DOMParser();
            const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
            const geojson = toGeoJSON.kml(kmlDoc);

            // 為 KML 圖層建立一個主文檔
            const kmlLayerDocRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(fileName);
            await kmlLayerDocRef.set({
                name: fileName,
                uploadedBy: window.currentUserEmail,
                uploadTime: firebase.firestore.FieldValue.serverTimestamp(),
                downloadURL: downloadURL,
                featureCount: geojson.features.length // 儲存 feature 數量
            });

            // 將每個 feature 儲存為子集合中的獨立文檔
            const batch = db.batch();
            geojson.features.forEach((feature, index) => {
                const featureDocRef = kmlLayerDocRef.collection('features').doc(`${index}`); // 使用索引作為文檔 ID
                batch.set(feature);
            });
            await batch.commit();

            showMessage('上傳成功', `${fileName} 已成功上傳和處理！`);
            hiddenKmlFileInput.value = ''; // 清除選定的檔案
            selectedKmlFileNameDashboard.textContent = '未選定檔案';
            uploadKmlSubmitBtnDashboard.disabled = true;
            fetchKmlLayersForSelection(); // 更新 KML 圖層選單
            fetchKmlLayersForDeletion(); // 更新刪除選單
        } catch (error) {
            console.error('KML 上傳或處理失敗:', error);
            showMessage('上傳失敗', `上傳或處理 ${fileName} 失敗: ${error.message}`);
        }
    });

    // 獲取 KML 圖層列表以供選擇
    const fetchKmlLayersForSelection = async () => {
        try {
            kmlLayerSelect.innerHTML = '<option value="">-- 請選擇 KML 圖層 --</option>'; // 清空並添加預設選項

            const querySnapshot = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').orderBy('name').get();
            if (querySnapshot.empty) {
                const noOption = document.createElement('option');
                noOption.value = '';
                noOption.textContent = '無可用 KML 圖層';
                noOption.disabled = true;
                kmlLayerSelect.appendChild(noOption);
            } else {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = data.name;
                    kmlLayerSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error fetching KML layers for selection:', error);
            showMessage('錯誤', `載入 KML 圖層列表失敗: ${error.message}`);
        }
    };

    // 事件監聽器：KML 圖層選擇器變更 (主地圖顯示用)
    kmlLayerSelect.addEventListener('change', (event) => {
        const selectedKmlId = event.target.value;
        if (selectedKmlId) {
            // 呼叫 map-logic.js 中的函數來載入 KML 圖層
            window.loadKmlLayerFromFirestore(selectedKmlId);
        } else {
            // 如果選擇了預設選項，則清除所有 KML 圖層
            window.clearAllKmlLayers();
        }
    });

    // 獲取 KML 圖層列表以供管理員刪除
    const fetchKmlLayersForDeletion = async () => {
        try {
            kmlLayerSelectDashboard.innerHTML = '<option value="">-- 請選擇要刪除的 KML 圖層 --</option>'; // 清空並添加預設選項

            if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'owner') {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '權限不足';
                option.disabled = true;
                kmlLayerSelectDashboard.appendChild(option);
                deleteSelectedKmlBtn.disabled = true;
                return;
            }

            const querySnapshot = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').orderBy('name').get();
            if (querySnapshot.empty) {
                const noOption = document.createElement('option');
                noOption.value = '';
                noOption.textContent = '無可用 KML 圖層';
                noOption.disabled = true;
                kmlLayerSelectDashboard.appendChild(noOption);
                deleteSelectedKmlBtn.disabled = true;
            } else {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = `${data.name} (${data.featureCount || 0} features)`;
                    kmlLayerSelectDashboard.appendChild(option);
                });
                deleteSelectedKmlBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error fetching KML layers for deletion:', error);
            showMessage('錯誤', `載入 KML 圖層列表失敗: ${error.message}`);
        }
    };

    // 事件監聽器：KML 圖層刪除選單變更
    kmlLayerSelectDashboard.addEventListener('change', (event) => {
        if (event.target.value) {
            deleteSelectedKmlBtn.disabled = false;
        } else {
            deleteSelectedKmlBtn.disabled = true;
        }
    });

    // 事件監聽器：刪除選定的 KML
    deleteSelectedKmlBtn.addEventListener('click', async () => {
        const selectedKmlId = kmlLayerSelectDashboard.value;
        if (!selectedKmlId) {
            showMessage('錯誤', '請選擇一個要刪除的 KML 圖層。');
            return;
        }
        if (window.currentUserRole !== 'admin' && window.currentUserRole !== 'owner') {
            showMessage('權限不足', '只有管理員才能刪除 KML 檔案。');
            return;
        }

        window.showConfirmation({
            title: '確認刪除',
            message: `您確定要刪除 KML 圖層 "${selectedKmlId}" 及其所有地理要素嗎？此操作不可逆！`,
            onConfirm: async () => {
                try {
                    showMessage('刪除中', '正在刪除 KML 圖層...', true); // 顯示刪除中訊息，不自動關閉
                    // 1. 刪除 Firestore 中的 features 子集合
                    const featuresCollectionRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(selectedKmlId).collection('features');
                    const featureDocs = await featuresCollectionRef.get();
                    const deleteFeaturesBatch = db.batch();
                    featureDocs.forEach(doc => {
                        deleteFeaturesBatch.delete(doc.ref);
                    });
                    await deleteFeaturesBatch.commit();
                    console.log('Features 子集合已刪除。');

                    // 2. 刪除 Firestore 中的 KML 主文檔
                    await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(selectedKmlId).delete();
                    console.log('KML 主文檔已刪除。');

                    // 3. 刪除 Storage 中的 KML 檔案
                    const storageRef = storage.ref(`kml_files/${appId}/${selectedKmlId}`);
                    await storageRef.delete();
                    console.log('Storage 中的檔案已刪除。');

                    showMessage('刪除成功', `KML 圖層 "${selectedKmlId}" 已成功刪除。`);
                    fetchKmlLayersForDeletion(); // 更新刪除選單
                    fetchKmlLayersForSelection(); // 更新主地圖選擇選單
                    window.clearAllKmlLayers(); // 清除地圖上的 KML 圖層
                } catch (error) {
                    console.error('刪除 KML 圖層失敗:', error);
                    showMessage('刪除失敗', `刪除 KML 圖層失敗: ${error.message}`);
                }
            }
        });
    });

    // 事件監聽器：生成註冊碼
    generateRegistrationCodeBtn.addEventListener('click', async () => {
        if (window.currentUserRole !== 'owner') {
            showMessage('權限不足', '只有管理員才能生成註冊碼。');
            return;
        }
        try {
            const docRef = db.collection('artifacts').doc(appId).collection('private').doc('registration');
            const newCode = Math.random().toString(36).substring(2, 10).toUpperCase(); // 8位隨機碼
            const expirationTime = firebase.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000); // 5分鐘後過期

            await docRef.set({
                code: newCode,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: expirationTime,
                generatedBy: window.currentUserEmail
            });

            registrationCodeDisplay.textContent = newCode;
            registrationCodeCountdown.style.display = 'inline';
            let countdownSeconds = 300; // 5分鐘 = 300秒

            if (registrationCodeTimer) {
                clearInterval(registrationCodeTimer);
            }

            registrationCodeTimer = setInterval(() => {
                countdownSeconds--;
                if (countdownSeconds >= 0) {
                    registrationCodeCountdown.textContent = ` (剩餘 ${countdownSeconds} 秒)`;
                } else {
                    clearInterval(registrationCodeTimer);
                    registrationCodeTimer = null;
                    registrationCodeDisplay.textContent = '註冊碼已過期';
                    registrationCodeCountdown.style.display = 'none';
                }
            }, 1000);
            
            const tempInput = document.createElement('textarea');
            tempInput.value = newCode;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);

            showMessage('成功', `一次性註冊碼已生成並複製到剪貼簿，設定為 ${countdownSeconds} 秒後過期！`);
        } catch (error) {
            console.error("生成註冊碼時出錯:", error);
            showMessage('錯誤', `生成註冊碼失敗: ${error.message}`);
        }
    });

    // 事件監聽器：註冊新用戶
    registerUserBtn.addEventListener('click', async () => {
        const code = registrationCodeInput.value.toUpperCase();
        if (!code) {
            showMessage('錯誤', '請輸入註冊碼。');
            return;
        }

        try {
            const docRef = db.collection('artifacts').doc(appId).collection('private').doc('registration');
            const doc = await docRef.get();

            if (!doc.exists) {
                showMessage('錯誤', '無效的註冊碼。');
                return;
            }

            const data = doc.data();
            if (data.code !== code) {
                showMessage('錯誤', '註冊碼不匹配。');
                return;
            }

            if (data.expiresAt.toDate() < new Date()) {
                showMessage('錯誤', '註冊碼已過期。');
                return;
            }

            // 更新當前登入用戶的角色為 'user'
            if (auth.currentUser) {
                await db.collection('users').doc(auth.currentUser.uid).update({
                    role: 'user',
                    registrationCodeUsed: code, // 記錄使用的註冊碼
                    registeredAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showMessage('註冊成功', '您的帳戶已成功註冊！');
                updateUI(auth.currentUser); // 更新 UI
            } else {
                showMessage('錯誤', '請先登入後再使用註冊碼。');
            }
            registrationCodeInput.value = ''; // 清除輸入框
        } catch (error) {
            console.error("註冊用戶時出錯:", error);
            showMessage('錯誤', `註冊失敗: ${error.message}`);
        }
    });

    // 事件監聽器：取消註冊碼輸入
    cancelRegistrationCodeBtn.addEventListener('click', () => {
        registrationCodeInput.value = '';
        showMessage('提示', '註冊碼輸入已取消。');
    });


    // 事件監聽器：重新整理用戶列表 (Owner Only)
    refreshUsersBtn.addEventListener('click', () => {
        if (window.currentUserRole !== 'owner') {
            showMessage('權限不足', '只有管理員才能查看或編輯使用者列表。');
            return;
        }
    
        const isVisible = userListDiv.style.display !== 'none';
    
        if (isVisible) {
            userListDiv.style.display = 'none';
        } else {
            userListDiv.style.display = 'block';
            fetchUserList();
        }
    });

    // 獲取用戶列表
    const fetchUserList = async () => {
        userTableBody.innerHTML = '<tr><td colspan="5">載入中...</td></tr>';
        userCountDisplay.textContent = '0';
        try {
            const querySnapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
            let users = [];
            querySnapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });
            window.allUsers = users; // 儲存到全局變數以便搜尋
            displayUserList(users);
        } catch (error) {
            console.error('Error fetching user list:', error);
            userTableBody.innerHTML = '<tr><td colspan="5">載入用戶列表失敗。</td></tr>';
        }
    };

    // 顯示用戶列表
    const displayUserList = (users) => {
        userTableBody.innerHTML = '';
        userCountDisplay.textContent = users.length;
        if (users.length === 0) {
            userTableBody.innerHTML = '<tr><td colspan="5">無使用者。</td></tr>';
            return;
        }

        const sortedUsers = [...users].sort((a, b) => {
            const aValue = a[userListSortColumn];
            const bValue = b[userListSortColumn];

            if (aValue === undefined || bValue === undefined) return 0;

            if (typeof aValue === 'string') {
                return userListSortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            if (aValue instanceof firebase.firestore.Timestamp && bValue instanceof firebase.firestore.Timestamp) {
                return userListSortDirection === 'asc' ? aValue.toMillis() - bValue.toMillis() : bValue.toMillis() - aValue.toMillis();
            }
            return userListSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        });

        sortedUsers.forEach(user => {
            const row = userTableBody.insertRow();
            row.insertCell(0).textContent = user.email || 'N/A';
            row.insertCell(1).textContent = user.role || 'N/A';
            row.insertCell(2).textContent = user.createdAt ? new Date(user.createdAt.toDate()).toLocaleString() : 'N/A';
            row.insertCell(3).textContent = user.registrationCodeUsed || 'N/A';
            
            const actionsCell = row.insertCell(4);
            // 只有 owner 可以更改角色
            if (window.currentUserRole === 'owner' && user.id !== auth.currentUser.uid) { // 不能更改自己的角色
                const select = document.createElement('select');
                select.className = 'role-select';
                select.dataset.uid = user.id;
                ['pending', 'user', 'admin'].forEach(role => {
                    const option = document.createElement('option');
                    option.value = role;
                    option.textContent = role;
                    if (user.role === role) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                select.addEventListener('change', async (e) => {
                    const newRole = e.target.value;
                    const uidToUpdate = e.target.dataset.uid;
                    await updateUserRole(uidToUpdate, newRole);
                });
                actionsCell.appendChild(select);
            } else {
                actionsCell.textContent = 'N/A'; // 或顯示當前角色，不可編輯
            }
        });
    };

    // 更新用戶角色
    const updateUserRole = async (uid, newRole) => {
        try {
            await db.collection('users').doc(uid).update({ role: newRole });
            showMessage('更新成功', `用戶 ${uid} 的角色已更新為 ${newRole}。`);
            fetchUserList(); // 重新整理列表
        } catch (error) {
            console.error('Error updating user role:', error);
            showMessage('錯誤', `更新用戶角色失敗: ${error.message}`);
        }
    };

    // 搜尋用戶
    searchUsersInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = window.allUsers.filter(user =>
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.role && user.role.toLowerCase().includes(searchTerm)) ||
            (user.registrationCodeUsed && user.registrationCodeUsed.toLowerCase().includes(searchTerm))
        );
        displayUserList(filteredUsers);
    });

    // 下載用戶列表為 CSV
    downloadUserListBtn.addEventListener('click', () => {
        if (window.currentUserRole !== 'owner') {
            showMessage('權限不足', '只有管理員才能下載用戶列表。');
            return;
        }

        if (!window.allUsers || window.allUsers.length === 0) {
            showMessage('提示', '沒有用戶數據可下載。');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // 添加 BOM 以確保 Excel 正常顯示中文
        csvContent += "Email,角色,註冊時間,註冊碼\n"; // CSV 表頭

        window.allUsers.forEach(user => {
            const createdAt = user.createdAt ? new Date(user.createdAt.toDate()).toLocaleString() : 'N/A';
            csvContent += `${user.email || 'N/A'},${user.role || 'N/A'},"${createdAt}",${user.registrationCodeUsed || 'N/A'}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "user_list.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 用戶列表排序
    document.querySelectorAll('.user-list-header .sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;
            if (userListSortColumn === column) {
                userListSortDirection = userListSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                userListSortColumn = column;
                userListSortDirection = 'asc';
            }
            // 移除所有排序標示
            document.querySelectorAll('.user-list-header .sortable').forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            // 添加當前排序標示
            header.classList.add(`sort-${userListSortDirection}`);
            displayUserList(window.allUsers);
        });
    });

    // 訊息彈出框
    window.showMessage = (title, message, autoClose = true) => {
        window.showMessageCustom({
            title: title,
            message: message,
            buttonText: '確定',
            autoClose: autoClose,
            autoCloseDelay: 3000
        });
    };

    // 確認彈出框
    window.showConfirmation = ({ title, message, onConfirm, onCancel }) => {
        const overlay = document.getElementById('confirmationModalOverlay');
        const modalTitle = document.getElementById('confirmationModalTitle');
        const modalMessage = document.getElementById('confirmationModalMessage');
        const confirmYesBtn = document.getElementById('confirmYesBtn');
        const confirmNoBtn = document.getElementById('confirmNoBtn');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        overlay.classList.add('visible');

        confirmYesBtn.onclick = () => {
            overlay.classList.remove('visible');
            if (typeof onConfirm === 'function') onConfirm();
        };

        confirmNoBtn.onclick = () => {
            overlay.classList.remove('visible');
            if (typeof onCancel === 'function') onCancel();
        };
    };

    // 初始化載入 KML 圖層選單 (登入後才會真正載入)
    fetchKmlLayersForSelection();
    fetchKmlLayersForDeletion();


    // ===== 新增的圖釘按鈕相關邏輯 =====
    // 當 KML 圖層下拉選單的值改變時，處理圖釘按鈕的啟用/禁用狀態
    kmlLayerSelect.addEventListener('change', () => {
        if (kmlLayerSelect.value) {
            pinKmlLayerBtn.removeAttribute('disabled'); // 如果有選擇圖層，啟用圖釘按鈕
        } else {
            pinKmlLayerBtn.setAttribute('disabled', 'true'); // 如果沒有選擇圖層，禁用圖釘按鈕
        }
    });

    // 初始化時先禁用圖釘按鈕 (確保頁面載入時是禁用狀態)
    if (pinKmlLayerBtn) {
        pinKmlLayerBtn.setAttribute('disabled', 'true');
    }


    // 監聽圖釘按鈕的點擊事件
    if (pinKmlLayerBtn) {
        pinKmlLayerBtn.addEventListener('click', async () => {
            const selectedKmlId = kmlLayerSelect.value; // 獲取當前選中的 KML ID

            if (selectedKmlId) {
                console.log(`嘗試釘選 KML 圖層: ${selectedKmlId}`);
                // 呼叫 map-logic.js 中的函數來載入 KML 圖層
                // window.loadKmlLayerFromFirestore 會自動將選定的圖層 ID 存入 localStorage
                await window.loadKmlLayerFromFirestore(selectedKmlId);
                
                // 獲取選擇的圖層名稱以顯示友好的訊息
                const selectedOption = kmlLayerSelect.options[kmlLayerSelect.selectedIndex];
                const kmlLayerName = selectedOption ? selectedOption.textContent : selectedKmlId;

                window.showMessageCustom({
                    title: '釘選成功',
                    message: `「${kmlLayerName}」已釘選為預設圖層，下次載入網頁時將自動顯示。`,
                    buttonText: '確定',
                    autoClose: true,
                    autoCloseDelay: 3000
                });
            } else {
                window.showMessageCustom({
                    title: '釘選失敗',
                    message: '請先從下拉選單中選擇一個 KML 圖層才能釘選。',
                    buttonText: '確定'
                });
                console.warn('沒有選擇 KML 圖層可釘選。');
            }
        });
    } else {
        console.error('找不到 id 為 "pinKmlLayerBtn" 的圖釘按鈕，釘選功能無法啟用。');
    }
    // ===== 圖釘按鈕相關邏輯結束 =====

}); // DOMContentLoaded 結束