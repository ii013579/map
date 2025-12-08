// auth-kml-management.js v1.9 (firepaths 整合 + DOMContentLoaded 包裝)

document.addEventListener('DOMContentLoaded', () => {

  // 🔹 登入狀態監聽
  auth.onAuthStateChanged(async (user) => {
    const loginForm = document.getElementById("loginForm");
    const loggedInDashboard = document.getElementById("loggedInDashboard");
    const userEmailDisplay = document.getElementById("userEmailDisplay");

    const uploadSection = document.getElementById("uploadKmlSectionDashboard");
    const deleteSection = document.getElementById("deleteKmlSectionDashboard");
    const registrationSettingsSection = document.getElementById("registrationSettingsSection");
    const userManagementSection = document.getElementById("userManagementSection");

    if (user) {
      console.log("✅ 使用者已登入:", user.email);
      loginForm.style.display = "none";
      loggedInDashboard.style.display = "block";
      userEmailDisplay.textContent = user.email;
      window.currentUser = user;

      try {
        // 取得使用者角色
        const userDoc = await window.firepaths.users.doc(user.uid).get();
        const userData = userDoc.data();
        window.currentUserRole = userData?.role || "unapproved";
        console.log("🎭 使用者角色:", window.currentUserRole);

        // 根據角色顯示 UI
        if (window.currentUserRole === "owner") {
          uploadSection.style.display = "block";
          deleteSection.style.display = "block";
          registrationSettingsSection.style.display = "block";
          userManagementSection.style.display = "block";
        } else if (window.currentUserRole === "editor") {
          uploadSection.style.display = "block";
          deleteSection.style.display = "block";
          registrationSettingsSection.style.display = "none";
          userManagementSection.style.display = "none";
        } else {
          uploadSection.style.display = "none";
          deleteSection.style.display = "none";
          registrationSettingsSection.style.display = "none";
          userManagementSection.style.display = "none";
        }

        await updateKmlLayerSelects();
        updatePinButtonState();
      } catch (err) {
        console.error("⚠️ 無法載入使用者角色：", err);
        window.currentUserRole = "unapproved";
      }
    } else {
      console.log("👤 使用者未登入");
      window.currentUser = null;
      window.currentUserRole = "unapproved";
      loginForm.style.display = "block";
      loggedInDashboard.style.display = "none";
    }
  });

  // 🔹 更新圖層下拉選單
  async function updateKmlLayerSelects() {
    const select = document.getElementById("kmlLayerSelectDashboard");
    if (!select) return;

    try {
      const { kmlList } = window.firepaths;
      const snapshot = await kmlList.orderBy("uploadTime", "desc").get();

      select.innerHTML = '<option value="">-- 請選擇 KML 圖層 --</option>';
      snapshot.forEach((doc) => {
        const data = doc.data();
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = data.name || "(未命名)";
        select.appendChild(option);
      });
      select.disabled = false;
      console.log("✅ 已更新圖層清單");
    } catch (error) {
      console.error("❌ 更新圖層清單失敗：", error);
    }
  }

  // 🔹 上傳 KML 檔案
  document.getElementById("uploadKmlSubmitBtnDashboard").addEventListener("click", async () => {
    const hiddenInput = document.getElementById("hiddenKmlFileInput");
    const file = hiddenInput.files[0];
    if (!file) {
      window.showMessage("提示", "請先選擇 KML 檔案");
      return;
    }

    const fileName = file.name.replace(".kml", "");
    const selectedKmlFileNameDashboard = document.getElementById("selectedKmlFileNameDashboard");
    const uploadBtn = document.getElementById("uploadKmlSubmitBtnDashboard");

    try {
      const { kmlList } = window.firepaths;
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const kmlText = e.target.result;
          const parser = new DOMParser();
          const kmlDoc = parser.parseFromString(kmlText, "text/xml");
          const geojson = toGeoJSON.kml(kmlDoc);
          const blob = new Blob([JSON.stringify(geojson)], { type: "application/json" });

          const storageRef = storage.ref(`geojson/${fileName}.json`);
          await storageRef.put(blob);
          const downloadURL = await storageRef.getDownloadURL();

          // 檢查是否存在同名圖層

          const file = hiddenInput.files[0];
          if (!file) {
              window.showMessage("提示", "請先選擇 KML 檔案");
              return;
          }
      
          const fileName = file.name.replace(".kml", "");
          const selectedKmlFileNameDashboard = document.getElementById("selectedKmlFileNameDashboard");
          const uploadBtn = document.getElementById("uploadKmlSubmitBtnDashboard");
      
          const { kmlList } = window.firepaths;
      
          try {
              const reader = new FileReader();
      
              reader.onload = async (e) => {
                  try {
                      const kmlText = e.target.result;
                      const parser = new DOMParser();
                      const kmlDoc = parser.parseFromString(kmlText, "text/xml");
                      const geojson = toGeoJSON.kml(kmlDoc);
      
                      // ✔ 直接將 GeoJSON 存到 Firestore（完全不用存 Storage）
                      const docRef = kmlList.doc(); // 產生新 kmlList doc ID
                      const docId = docRef.id;
      
                      await docRef.set({
                          name: fileName,
                          uploadTime: firebase.firestore.FieldValue.serverTimestamp(),
                          geojson: geojson,
                          uploadedBy: auth.currentUser.email || auth.currentUser.uid,
                      });
      
                      window.showMessage("成功", `KML "${fileName}" 已上傳，共 ${geojson.features.length} 筆資料`);
      
                      hiddenInput.value = "";
                      selectedKmlFileNameDashboard.textContent = "尚未選擇檔案";
                      uploadBtn.disabled = true;
      
                      await updateKmlLayerSelects();
                      updatePinButtonState();
      
                  } catch (error) {
                      console.error("❌ KML 上傳錯誤：", error);
                      window.showMessage("錯誤", error.message);
                  }
              };
      
              reader.readAsText(file);
      
          } catch (error) {
              console.error("上傳流程錯誤：", error);
          }
      });

  // 🔹 刪除 KML 圖層
  document.getElementById("deleteSelectedKmlBtn").addEventListener("click", async () => {
    const select = document.getElementById("kmlLayerSelectDashboard");
    const selectedId = select.value;
    if (!selectedId) {
      window.showMessage("提示", "請先選擇要刪除的圖層");
      return;
    }

    try {
      const { kmlList } = window.firepaths;
      
      // 確認存在
      const docRef = kmlList.doc(selectedId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
          window.showMessage("錯誤", "找不到圖層文件。");
          return;
      }
      
      // 權限檢查
      const data = docSnap.data();
      const currentEmail = auth.currentUser.email;
      
      if (
          window.currentUserRole !== "owner" &&
          !(window.currentUserRole === "editor" && data.uploadedBy === currentEmail)
      ) {
          window.showMessage("權限不足", "您無權刪除此圖層。");
          return;
      }
      
      // 刪除
      await docRef.delete();
      window.showMessage("成功", `已刪除 "${data.name}"`);
      await updateKmlLayerSelects();
    } catch (err) {
      console.error("刪除 KML 錯誤：", err);
    }
  });

});
