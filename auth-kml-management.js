// auth-kml-management.js - v1.9 minimal patch -> use window.firepaths (kmlList + users)
// 保留原本邏輯與 UI，只把 Firestore 路徑改為 window.firepaths

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM elements
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

  // --- state
  window.currentUserRole = null;
  let registrationCodeTimer = null;

  // --- helpers
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
    pinButton.disabled = !kmlId;
    if (kmlId && pinnedId === kmlId) pinButton.classList.add('clicked');
    else pinButton.classList.remove('clicked');
  };

  // confirmation modal wrapper (if not provided)
  if (typeof window.showConfirmationModal === 'undefined') {
    window.showConfirmationModal = function (title, message) {
      return new Promise(resolve => {
        const modalOverlay = document.getElementById('confirmationModalOverlay');
        const modalTitle = document.getElementById('confirmationModalTitle');
        const modalMessage = document.getElementById('confirmationModalMessage');
        const confirmYesBtn = document.getElementById('confirmYesBtn');
        const confirmNoBtn = document.getElementById('confirmNoBtn');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalOverlay.classList.add('visible');

        const cleanupAndResolve = (result) => {
          modalOverlay.classList.remove('visible');
          confirmYesBtn.removeEventListener('click', yesHandler);
          confirmNoBtn.removeEventListener('click', noHandler);
          resolve(result);
        };

        const yesHandler = () => cleanupAndResolve(true);
        const noHandler = () => cleanupAndResolve(false);

        confirmYesBtn.addEventListener('click', yesHandler);
        confirmNoBtn.addEventListener('click', noHandler);
      });
    };
  }

  // --- refresh user list (owner only)
  const refreshUserList = async () => {
    // clear existing
    const cards = userListDiv.querySelectorAll('.user-card');
    cards.forEach(card => card.remove());

    try {
      // use firepaths.users
      const usersRef = window.firepaths.users;
      const snapshot = await usersRef.get();

      if (snapshot.empty) {
        userListDiv.innerHTML = '<p>目前沒有註冊用戶。</p>';
        return;
      }

      let usersData = [];
      snapshot.forEach(doc => {
        const user = doc.data();
        const uid = doc.id;
        if (auth.currentUser && uid === auth.currentUser.uid) return; // skip self
        usersData.push({ id: uid, ...user });
      });

      const roleOrder = { 'unapproved': 1, 'user': 2, 'editor': 3, 'owner': 4 };
      usersData.sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99));

      usersData.forEach(user => {
        const uid = user.id;
        const emailName = user.email ? user.email.split('@')[0] : 'N/A';
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.dataset.nickname = user.name || 'N/A';
        userCard.dataset.uid = uid;

        userCard.innerHTML = `
          <div class="user-email">${emailName}</div>
          <div class="user-nickname">${user.name || 'N/A'}</div>
          <div class="user-role-controls">
            <select id="role-select-${uid}" data-uid="${uid}" data-original-value="${user.role}" class="user-role-select">
              <option value="unapproved" ${user.role === 'unapproved' ? 'selected' : ''}>未審核</option>
              <option value="user" ${user.role === 'user' ? 'selected' : ''}>一般</option>
              <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>編輯者</option>
              <option value="owner" ${user.role === 'owner' ? 'selected' : ''}>擁有者</option>
            </select>
          </div>
          <div class="user-actions">
            <button class="change-role-btn" data-uid="${uid}" disabled>變</button>
            <button class="delete-user-btn action-buttons delete-btn" data-uid="${uid}">刪</button>
          </div>
        `;
        userListDiv.appendChild(userCard);
      });

      // attach events
      userListDiv.querySelectorAll('.user-role-select').forEach(select => {
        const changeButton = select.closest('.user-card').querySelector('.change-role-btn');
        select.addEventListener('change', () => {
          changeButton.disabled = (select.value === select.dataset.originalValue);
        });

        changeButton.addEventListener('click', async () => {
          const userCard = changeButton.closest('.user-card');
          const uidToUpdate = userCard.dataset.uid;
          const nicknameToUpdate = userCard.dataset.nickname;
          const newRole = select.value;

          const confirmUpdate = await window.showConfirmationModal(
            '確認變更角色',
            `確定要將用戶 ${nicknameToUpdate} (${uidToUpdate.substring(0,6)}...) 的角色變更為 ${getRoleDisplayName(newRole)} 嗎？`
          );

          if (!confirmUpdate) {
            select.value = select.dataset.originalValue;
            changeButton.disabled = true;
            return;
          }

          try {
            await window.firepaths.users.doc(uidToUpdate).update({ role: newRole });
            window.showMessage('成功', `用戶 ${nicknameToUpdate} 的角色已更新為 ${getRoleDisplayName(newRole)}。`);
            select.dataset.originalValue = newRole;
            changeButton.disabled = true;
          } catch (error) {
            window.showMessage('錯誤', `更新角色失敗: ${error.message}`);
            select.value = select.dataset.originalValue;
            changeButton.disabled = true;
          }
        });
      });

      userListDiv.querySelectorAll('.delete-user-btn').forEach(button => {
        button.addEventListener('click', async () => {
          const userCard = button.closest('.user-card');
          const uidToDelete = userCard.dataset.uid;
          const nicknameToDelete = userCard.dataset.nickname;

          const confirmDelete = await window.showConfirmationModal(
            '確認刪除用戶',
            `確定要刪除用戶 ${nicknameToDelete} (${uidToDelete.substring(0,6)}...) 嗎？此操作不可逆！`
          );

          if (!confirmDelete) return;

          try {
            await window.firepaths.users.doc(uidToDelete).delete();
            window.showMessage('成功', `用戶 ${nicknameToDelete} 已刪除。`);
            userCard.remove();
          } catch (error) {
            window.showMessage('錯誤', `刪除失敗: ${error.message}`);
          }
        });
      });

      // sorting UI
      let currentSortKey = 'role';
      let sortAsc = true;

      document.querySelectorAll('.user-list-header .sortable').forEach(header => {
        header.addEventListener('click', () => {
          const key = header.dataset.key;
          if (currentSortKey === key) sortAsc = !sortAsc;
          else { currentSortKey = key; sortAsc = true; }
          sortUserList(currentSortKey, sortAsc);
          updateSortIndicators();
        });
      });

      function sortUserList(key, asc = true) {
        const cards = Array.from(document.querySelectorAll('#userList .user-card'));
        const container = document.getElementById('userList');
        const sorted = cards.sort((a, b) => {
          const getValue = (el) => {
            if (key === 'email') return el.querySelector('.user-email')?.textContent?.toLowerCase() || '';
            if (key === 'nickname') return el.querySelector('.user-nickname')?.textContent?.toLowerCase() || '';
            if (key === 'role') return el.querySelector('.user-role-select')?.value || '';
            return '';
          };
          const aVal = getValue(a);
          const bVal = getValue(b);
          return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
        sorted.forEach(card => container.appendChild(card));
      }

      function updateSortIndicators() {
        document.querySelectorAll('.user-list-header .sortable').forEach(header => {
          header.classList.remove('sort-asc', 'sort-desc');
          if (header.dataset.key === currentSortKey) {
            header.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
          }
        });
      }

    } catch (error) {
      userListDiv.innerHTML = `<p style="color: red;">載入用戶列表失敗: ${error.message}</p>`;
      console.error("載入用戶列表時出錯:", error);
    }
  };

  // --- auth state
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      loginForm.style.display = 'none';
      loggedInDashboard.style.display = 'block';
      userEmailDisplay.textContent = `${user.email} (載入中...)`;

      // subscribe to user's doc (use firepaths.users)
      const userDocRef = window.firepaths.users.doc(user.uid);
      userDocRef.onSnapshot(async (doc) => {
        if (!doc.exists) {
          console.warn('⚠️ 用戶資料不存在，登出。');
          await auth.signOut();
          return;
        }

        const userData = doc.data();
        window.currentUserRole = userData.role || 'unapproved';
        userEmailDisplay.textContent = `${user.email} (${getRoleDisplayName(window.currentUserRole)})`;

        const isOwner = window.currentUserRole === 'owner';
        const canEdit = ['owner', 'editor'].includes(window.currentUserRole);

        if (uploadKmlSectionDashboard) uploadKmlSectionDashboard.style.display = canEdit ? 'flex' : 'none';
        if (deleteKmlSectionDashboard) deleteKmlSectionDashboard.style.display = canEdit ? 'flex' : 'none';
        registrationSettingsSection.style.display = isOwner ? 'flex' : 'none';
        userManagementSection.style.display = isOwner ? 'block' : 'none';

        uploadKmlSubmitBtnDashboard.disabled = !canEdit;
        deleteSelectedKmlBtn.disabled = !canEdit;
        generateRegistrationCodeBtn.disabled = !isOwner;
        refreshUsersBtn.disabled = !isOwner;

        if (isOwner) {
          refreshUserList();
        }

        if (window.currentUserRole === 'unapproved') {
          window.showMessage('帳號審核中', '您的帳號正在等待管理員審核。在審核通過之前，您將無法上傳或刪除 KML。');
        }

        await window.updateKmlLayerSelects();
        updatePinButtonState();
      }, (error) => {
        if (!auth.currentUser && error.code === 'permission-denied') {
          console.warn("因登出導致的權限錯誤，已忽略訊息。");
        } else {
          console.error("監聽用戶角色時出錯:", error);
          window.showMessage('錯誤', `獲取用戶角色失敗: ${error.message}`);
          auth.signOut();
        }
      });

    } else {
      loginForm.style.display = 'block';
      loggedInDashboard.style.display = 'none';
      window.currentUserRole = null;
      userEmailDisplay.textContent = '';
      await window.updateKmlLayerSelects();
      updatePinButtonState();
    }
  });

  // --- Google sign-in + registration with code
  googleSignInBtn.addEventListener('click', async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const userCredential = await auth.signInWithPopup(provider);
      const user = userCredential.user;

      // check if user doc exists
      const userDoc = await window.firepaths.users.doc(user.uid).get();
      if (!userDoc.exists) {
        // sign user out, then request registration code
        await auth.signOut();
        window.showRegistrationCodeModal(async (result) => {
          if (result) {
            const code = result.code;
            const nickname = result.nickname;
            try {
              const regDoc = await window.firepaths.root.collection('settings')?.doc ? // fallback if root usage
                db.collection('settings').doc('registration').get() :
                db.collection('settings').doc('registration').get();

              if (regDoc.exists) {
                const storedCode = regDoc.data().oneTimeCode;
                const expiryTime = regDoc.data().oneTimeCodeExpiry ? regDoc.data().oneTimeCodeExpiry.toDate() : null;
                const currentTime = new Date();

                if (!storedCode || storedCode !== code || (expiryTime && currentTime > expiryTime)) {
                  window.showMessage('註冊失敗', '無效或過期的註冊碼。');
                  return;
                }
              } else {
                window.showMessage('註冊失敗', '註冊系統未啟用或無效的註冊碼。請聯繫管理員。');
                return;
              }

              // re-authenticate to ensure current auth user (popup may be required)
              const reAuth = await auth.signInWithPopup(provider);
              const reUser = reAuth.user;

              // create user doc
              await window.firepaths.users.doc(reUser.uid).set({
                email: reUser.email,
                name: nickname,
                role: 'unapproved',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                registeredWithCode: true,
                registrationCodeUsed: code
              });

              // try to invalidate code (optional; may be blocked by rules)
              try {
                await db.collection('settings').doc('registration').set({
                  oneTimeCode: null,
                  oneTimeCodeExpiry: null
                }, { merge: true });
              } catch (err) {
                console.warn('嘗試使註冊碼失效時發生錯誤（可能規則阻止）:', err.message);
              }

              window.showMessage('註冊成功', `歡迎 ${reUser.email} (${nickname})！您的帳號已成功註冊，正在等待審核。`);
            } catch (error) {
              console.error('使用註冊碼登入/註冊失敗:', error);
              window.showMessage('註冊失敗', `使用註冊碼登入/註冊時發生錯誤: ${error.message}`);
            }
          } else {
            window.showMessage('取消', '您已取消註冊。');
          }
        });
      } else {
        window.showMessage('登入成功', `歡迎回來 ${user.email}！`);
      }
    } catch (error) {
      console.error('Google 登入失敗:', error);
      loginMessage.textContent = `登入失敗: ${error.message}`;
      window.showMessage('登入失敗', `Google 登入時發生錯誤: ${error.message}`);
    }
  });

  // --- logout
  logoutBtn.addEventListener('click', async () => {
    try {
      await auth.signOut();
      window.showMessage('登出成功', '用戶已登出。');
    } catch (error) {
      console.error('登出失敗:', error);
      window.showMessage('登出失敗', `登出時發生錯誤: ${error.message}`);
    }
  });

  // --- upload UI wiring
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

  // --- upload handler (uses kmlList)
  uploadKmlSubmitBtnDashboard.addEventListener('click', async () => {
    const file = hiddenKmlFileInput.files[0];
    if (!file) {
      window.showMessage('提示', '請先選擇 KML 檔案。');
      return;
    }
    if (!auth.currentUser || !['owner', 'editor'].includes(window.currentUserRole)) {
      window.showMessage('錯誤', '您沒有權限上傳 KML，請登入或等待管理員審核。');
      return;
    }

    const fileName = file.name;
    const reader = new FileReader();
    reader.onload = async () => {
      console.log(`正在處理 KML 檔案: ${file.name}`);
      try {
        const kmlString = reader.result;
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlString, 'text/xml');

        if (kmlDoc.getElementsByTagName('parsererror').length > 0) {
          const errorText = kmlDoc.getElementsByTagName('parsererror')[0].textContent;
          throw new Error(`KML XML 解析錯誤: ${errorText}`);
        }

        const geojson = toGeoJSON.kml(kmlDoc);
        const parsedFeatures = geojson.features || [];

        if (parsedFeatures.length === 0) {
          window.showMessage('KML 載入', 'KML 檔案中沒有找到任何可顯示的地理要素 (Placemark)。');
          return;
        }

        const kmlListRef = window.firepaths.kmlList;

        // check existing by name
        const existingQuery = await kmlListRef.where('name', '==', fileName).get();
        let kmlDocRef;
        let isOverwriting = false;

        if (!existingQuery.empty) {
          // confirm overwrite
          const confirmOverwrite = await window.showConfirmationModal(
            '覆蓋 KML 檔案',
            `資料庫中已存在名為 "${fileName}" 的 KML 圖層。您確定要覆蓋它嗎？`
          );
          if (!confirmOverwrite) {
            window.showMessage('已取消', 'KML 檔案上傳已取消。');
            hiddenKmlFileInput.value = '';
            selectedKmlFileNameDashboard.textContent = '尚未選擇檔案';
            uploadKmlSubmitBtnDashboard.disabled = true;
            return;
          }
          kmlDocRef = existingQuery.docs[0].ref;
          isOverwriting = true;
        } else {
          kmlDocRef = kmlListRef.doc(); // new doc
        }

        // write doc (store geojson directly)
        await kmlDocRef.set({
          name: fileName,
          geojson: geojson,
          uploadTime: firebase.firestore.FieldValue.serverTimestamp(),
          uploadedBy: auth.currentUser.email || auth.currentUser.uid,
          uploadedByRole: window.currentUserRole
        }, { merge: true });

        const successMessage = isOverwriting ?
          `KML 檔案 "${fileName}" 已成功覆蓋並儲存 ${parsedFeatures.length} 個地理要素。` :
          `KML 檔案 "${fileName}" 已成功上傳並儲存 ${parsedFeatures.length} 個地理要素。`;

        // show message
        window.showMessage('成功', successMessage);

        // reset UI
        hiddenKmlFileInput.value = '';
        selectedKmlFileNameDashboard.textContent = '尚未選擇檔案';
        uploadKmlSubmitBtnDashboard.disabled = true;

        // update selects & pin state
        await window.updateKmlLayerSelects();
        updatePinButtonState();

      } catch (error) {
        console.error('處理 KML 檔案或上傳到 Firebase 時出錯:', error);
        window.showMessage('KML 處理錯誤', `處理 KML 檔案或上傳時發生錯誤：${error.message}`);
      }
    };
    reader.readAsText(file);
  });

  // --- delete handler (uses kmlList)
  deleteSelectedKmlBtn.addEventListener('click', async () => {
    const kmlIdToDelete = kmlLayerSelectDashboard.value;
    if (!kmlIdToDelete) {
      window.showMessage('提示', '請先選擇要刪除的 KML 圖層。');
      return;
    }
    if (!auth.currentUser || !['owner', 'editor'].includes(window.currentUserRole)) {
      window.showMessage('錯誤', '您沒有權限刪除 KML。');
      return;
    }

    const confirmDelete = await window.showConfirmationModal(
      '確認刪除 KML',
      '確定要刪除此 KML 圖層及其所有地理要素嗎？此操作不可逆！'
    );

    if (!confirmDelete) return;

    try {
      const docRef = window.firepaths.kmlList.doc(kmlIdToDelete);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        window.showMessage('錯誤', '找不到該 KML 圖層。');
        return;
      }
      const kmlData = docSnap.data();
      const fileName = kmlData.name || kmlIdToDelete;

      // permission: owner or editor who uploaded
      const currentEmail = auth.currentUser.email;
      if (!(window.currentUserRole === 'owner' || (window.currentUserRole === 'editor' && kmlData.uploadedBy === currentEmail))) {
        window.showMessage('權限不足', '您無權刪除此圖層。');
        return;
      }

      await docRef.delete();
      window.showMessage('成功', `KML 圖層 "${fileName}" 已成功刪除。`);
      await window.updateKmlLayerSelects();
      window.clearAllKmlLayers?.();
      updatePinButtonState();

    } catch (error) {
      console.error('刪除 KML 失敗:', error);
      window.showMessage('刪除失敗', `刪除 KML 圖層時發生錯誤: ${error.message}`);
    }
  });

  // --- generate registration code
  function generateRegistrationAlphanumericCode() {
    let result = '';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '013456789';
    for (let i = 0; i < 3; i++) result += letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 5; i++) result += digits.charAt(Math.floor(Math.random() * digits.length));
    return result;
  }

  generateRegistrationCodeBtn.addEventListener('click', async () => {
    if (window.currentUserRole !== 'owner') {
      window.showMessage('權限不足', '只有管理員才能生成註冊碼。');
      return;
    }
    if (registrationCodeTimer) {
      clearInterval(registrationCodeTimer);
      registrationCodeTimer = null;
    }

    try {
      const code = generateRegistrationAlphanumericCode();
      let countdownSeconds = 60;
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + countdownSeconds);

      // write to settings (global)
      await db.collection('settings').doc('registration').set({
        oneTimeCode: code,
        oneTimeCodeExpiry: firebase.firestore.Timestamp.fromDate(expiryDate)
      }, { merge: true });

      registrationCodeDisplay.textContent = code;
      registrationCodeCountdown.textContent = ` (剩餘 ${countdownSeconds} 秒)`;
      registrationCodeDisplay.style.display = 'inline-block';
      registrationCodeCountdown.style.display = 'inline-block';
      registrationExpiryDisplay.style.display = 'none';

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

      // copy to clipboard
      const tempInput = document.createElement('textarea');
      tempInput.value = code;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);

      window.showMessage('成功', `一次性註冊碼已生成並複製到剪貼簿，設定為 ${60} 秒後過期！`);
    } catch (error) {
      console.error('生成註冊碼時出錯:', error);
      window.showMessage('錯誤', `生成註冊碼失敗: ${error.message}`);
    }
  });

  // refresh users button
  refreshUsersBtn.addEventListener('click', () => {
    if (window.currentUserRole !== 'owner') {
      window.showMessage('權限不足', '只有管理員才能查看或編輯使用者列表。');
      return;
    }
    const isVisible = userListDiv.style.display !== 'none';
    if (isVisible) userListDiv.style.display = 'none';
    else {
      userListDiv.style.display = 'block';
      refreshUserList();
    }
  });

  // --- KML select wiring (main dropdown)
  if (kmlLayerSelect) {
    kmlLayerSelect.addEventListener('change', () => {
      const kmlId = kmlLayerSelect.value;
      updatePinButtonState();
      if (kmlId) window.loadKmlLayerFromFirestore?.(kmlId);
      else window.clearAllKmlLayers?.();
    });
  } else {
    console.error('找不到 id 為 "kmlLayerSelect" 的下拉選單，KML 載入功能無法啟用。');
  }

  // --- pin button
  if (pinButton) {
    pinButton.addEventListener('click', () => {
      const selectedKmlId = kmlLayerSelect.value;
      if (!selectedKmlId) {
        window.showMessage('釘選失敗', '請先從下拉選單中選擇一個 KML 圖層才能釘選。');
        return;
      }
      const currentPinnedId = localStorage.getItem('pinnedKmlId');
      if (currentPinnedId === selectedKmlId) {
        localStorage.removeItem('pinnedKmlId');
        window.showMessageCustom?.({
          title: '取消釘選',
          message: `已取消釘選。`,
          buttonText: '確定',
          autoClose: true,
          autoCloseDelay: 2000
        });
      } else {
        localStorage.setItem('pinnedKmlId', selectedKmlId);
        window.showMessageCustom?.({
          title: '釘選成功',
          message: `已釘選為預設圖層。`,
          buttonText: '確定',
          autoClose: true,
          autoCloseDelay: 2000
        });
      }
      updatePinButtonState();
    });
  } else {
    console.error('找不到 id 為 "pinButton" 的圖釘按鈕，釘選功能無法啟用。');
  }

  // --- expose updateKmlLayerSelects on window if not defined (minimal)
  if (typeof window.updateKmlLayerSelects !== 'function') {
    window.updateKmlLayerSelects = async function () {
      const sel = document.getElementById('kmlLayerSelect');
      const selDash = document.getElementById('kmlLayerSelectDashboard');
      if (!sel && !selDash) return;
      try {
        const snapshot = await window.firepaths.kmlList.orderBy('uploadTime', 'desc').get();
        if (sel) sel.innerHTML = '<option value="">-- 請選擇 KML  --</option>';
        if (selDash) selDash.innerHTML = '<option value="">-- 請選擇 KML 圖層 --</option>';
        snapshot.forEach(doc => {
          const data = doc.data();
          const id = doc.id;
          const name = data.name || id;
          if (sel) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = name;
            sel.appendChild(opt);
          }
          if (selDash) {
            const opt2 = document.createElement('option');
            opt2.value = id;
            opt2.textContent = name;
            selDash.appendChild(opt2);
          }
        });
        console.log('✅ KML 下拉選單已更新 (from kmlList)');
        // try pinned load
        if (!window.alreadyLoadedPinned) window.tryLoadPinnedKmlLayerWhenReady();
      } catch (err) {
        console.error('更新 KML 下拉選單失敗:', err);
      }
    };
  }

  // initial call to populate selects for unauthenticated users too
  window.updateKmlLayerSelects();

}); // DOMContentLoaded end
