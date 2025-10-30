// =======================================================
// auth-kml-management.js v2.1
// - �f�t map-logic.js v2.0
// - �䴩 roles: owner, editor, user, unapproved
// - �䴩 registrationCodes �s�� artifacts/{appId}/public/data/registrationCodes/{code}
// =======================================================
// ==
/* globals firebase, loadKmlLayerList, loadKmlLayerData, map */ 

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let currentUserDoc = null; // firestore users/{uid} doc data
let appId = "defaultApp";   // �i���A�ݨD�ק�
let kmlListCache = [];     // local runtime cache of kmlList entries

// utility: role check shortcuts
function isOwner() { return currentUserDoc?.role === "owner"; }
function isEditor() { return currentUserDoc?.role === "editor"; }
function canUpload() { return isOwner() || isEditor(); }
function canGenerateCode() { return isOwner(); }
function canDeleteLayer(layerDoc) {
  if (!currentUserDoc) return false;
  if (currentUserDoc.role === "owner") return true;
  if (currentUserDoc.role === "editor") {
    // editor can delete only their own uploads
    return layerDoc?.uploadedBy === (currentUser?.email || "");
  }
  return false;
}

// =======================================================
// onAuthStateChanged
// =======================================================
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    console.log(`?? �w�n�J�G${user.email}`);

    // load or create user doc if not exist
    await ensureUserDoc(user);

    // load kmlList and fill selects
    await loadKmlLayerList();      // implemented in map-logic.js v2.0, reads kmlList doc
    await updateKmlLayerSelects(); // fills UI selects using kmlList doc

    // auto load pinned (if any) and pinned stored possibly in user prefs or localStorage
    await loadUserPinnedLayers(user.uid);

    updateUIAfterLogin();
  } else {
    console.log("?? �ϥΪ̵n�X�Υ��n�J");
    currentUser = null;
    currentUserDoc = null;
    clearLoggedInUI();
  }
});

// =======================================================
// Ensure user doc exists in users/{uid}
// =======================================================
async function ensureUserDoc(user) {
  try {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();
    if (!doc.exists) {
      // new user -> default role = unapproved
      const newDoc = {
        email: user.email || "",
        nickname: user.displayName || "",
        role: "unapproved",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await userRef.set(newDoc);
      currentUserDoc = newDoc;
      console.log("?? �إ߷s�ϥΪ̤��]���f�֡^");
    } else {
      currentUserDoc = doc.data();
      console.log("?? ���J�ϥΪ̤��", currentUserDoc);
    }
  } catch (err) {
    console.error("Ū��/�إߨϥΪ̤�󥢱ѡG", err);
  }
}

// =======================================================
// UI helpers
// =======================================================
function updateUIAfterLogin() {
  // show/hide dashboard elements by role
  const registrationSection = document.getElementById("registrationSettingsSection");
  const userManagementSection = document.getElementById("userManagementSection");
  const kmlControlsDashboard = document.getElementById("kmlControlsDashboard");

  if (registrationSection) registrationSection.style.display = canGenerateCode() ? "block" : "none";
  if (userManagementSection) userManagementSection.style.display = isOwner() ? "block" : "none";
  if (kmlControlsDashboard) kmlControlsDashboard.style.display = canUpload() ? "block" : "none";

  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay && currentUser) emailDisplay.textContent = currentUser.email;
}

function clearLoggedInUI() {
  // revert UI
  const registrationSection = document.getElementById("registrationSettingsSection");
  const userManagementSection = document.getElementById("userManagementSection");
  const kmlControlsDashboard = document.getElementById("kmlControlsDashboard");
  if (registrationSection) registrationSection.style.display = "none";
  if (userManagementSection) userManagementSection.style.display = "none";
  if (kmlControlsDashboard) kmlControlsDashboard.style.display = "none";

  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay) emailDisplay.textContent = "";
}

// =======================================================
// loadUserPinnedLayers (reuse earlier design)
// =======================================================
async function loadUserPinnedLayers(uid) {
  try {
    const docRef = db.collection("users").doc(uid).collection("preferences").doc("pinned");
    const doc = await docRef.get();
    if (!doc.exists) return;
    const pinned = doc.data().layers || [];
    if (Array.isArray(pinned) && pinned.length > 0) {
      for (const p of pinned) {
        // call map-logic load; will be cached by loadKmlLayerData
        await loadKmlLayerData(p.id);
      }
    }
  } catch (err) {
    console.error("Ū pinned ���ѡG", err);
  }
}

// =======================================================
// handleKmlUpload (�W�Ǩç�s kmlList)
//  - editors can upload; owner can upload
// =======================================================
async function handleKmlUpload(fileInput) {
  if (!currentUser || !currentUserDoc) {
    showMessageCustom("�Х��n�J", "error");
    return;
  }
  if (!canUpload()) {
    showMessageCustom("�z�S���W���v��", "error");
    return;
  }

  const file = fileInput.files?.[0];
  if (!file) {
    showMessageCustom("������ɮ�", "error");
    return;
  }

  // derive id and metadata
  const rawName = file.name.replace(/\.kml$/i, "");
  const layerId = rawName.replace(/\s+/g, "_").toLowerCase();
  const layerName = rawName;
  const uploadTime = Date.now();

  try {
    // parse KML -> GeoJSON using toGeoJSON (already in index.html)
    const text = await file.text();
    const parser = new DOMParser();
    const kmlDoc = parser.parseFromString(text, "text/xml");
    const geojson = toGeoJSON.kml(kmlDoc);
    const geojsonStr = JSON.stringify(geojson);

    // write kmlLayers/{layerId}
    const layerRef = db.collection("artifacts").doc(appId)
      .collection("public").doc("data")
      .collection("kmlLayers").doc(layerId);

    await layerRef.set({
      name: layerName,
      uploadTime,
      uploadedBy: currentUser.email || "",
      geojsonContent: geojsonStr
    });

    // update kmlList
    await updateKmlListAfterUpload(appId, layerId, layerName, uploadTime);

    showMessageCustom(`�W�ǧ����G${layerName}`, "success");

    // refresh selects
    await updateKmlLayerSelects();

  } catch (err) {
    console.error("�W�ǿ��~�G", err);
    showMessageCustom("�W�ǥ��ѡA�Э���", "error");
  }
}

// =======================================================
// updateKmlListAfterUpload (�ۮe v2.0 �� kmlList doc)
// =======================================================
async function updateKmlListAfterUpload(appIdParam, newLayerId, newLayerName, uploadTime) {
  try {
    const listRef = db.collection("artifacts").doc(appIdParam)
      .collection("public").doc("data")
      .doc("kmlList");

    const doc = await listRef.get();
    let layers = [];
    if (doc.exists) {
      layers = doc.data().layers || [];
      const idx = layers.findIndex(l => l.id === newLayerId);
      if (idx >= 0) {
        layers[idx].name = newLayerName;
        layers[idx].uploadTime = uploadTime;
        layers[idx].uploadedBy = currentUser?.email || layers[idx].uploadedBy || "";
      } else {
        layers.push({ id: newLayerId, name: newLayerName, uploadTime, uploadedBy: currentUser?.email || "" });
      }
    } else {
      layers = [{ id: newLayerId, name: newLayerName, uploadTime, uploadedBy: currentUser?.email || "" }];
    }
    await listRef.set({ layers });
    // update runtime cache
    kmlListCache = layers;
    console.log("kmlList �w��s");
  } catch (err) {
    console.error("updateKmlListAfterUpload failed:", err);
  }
}

// =======================================================
// deleteKmlLayer (owner can delete any; editor only own uploads)
// =======================================================
async function deleteKmlLayer(layerId) {
  if (!currentUserDoc) {
    showMessageCustom("�Х��n�J", "error");
    return;
  }
  try {
    // read layer meta to check uploadedBy
    const layerRef = db.collection("artifacts").doc(appId)
      .collection("public").doc("data")
      .collection("kmlLayers").doc(layerId);

    const doc = await layerRef.get();
    if (!doc.exists) {
      showMessageCustom("�䤣��ϼh", "error");
      return;
    }
    const layerData = doc.data();

    if (!canDeleteLayer(layerData)) {
      showMessageCustom("�z�S���R���v��", "error");
      return;
    }

    await layerRef.delete();
    // update kmlList
    const listRef = db.collection("artifacts").doc(appId)
      .collection("public").doc("data").doc("kmlList");

    const listDoc = await listRef.get();
    if (listDoc.exists) {
      const layers = (listDoc.data().layers || []).filter(l => l.id !== layerId);
      await listRef.set({ layers });
      kmlListCache = layers;
    }
    showMessageCustom("�R�����\", "success");
    await updateKmlLayerSelects(); // refresh UI
  } catch (err) {
    console.error("�R�����ѡG", err);
    showMessageCustom("�R������", "error");
  }
}

// =======================================================
// loadKmlLayerList (wrap map-logic.js function and update cache)
// - map-logic.js already implements loadKmlLayerList that populates selects,
//   but for safety we implement a wrapper to maintain kmlListCache.
// =======================================================
async function loadKmlLayerListWrapper() {
  try {
    const listRef = db.collection("artifacts").doc(appId)
      .collection("public").doc("data").doc("kmlList");
    const doc = await listRef.get();
    if (!doc.exists) {
      kmlListCache = [];
      return;
    }
    kmlListCache = doc.data().layers || [];
    // call map-logic's loader if exists
    if (typeof loadKmlLayerList === "function") {
      await loadKmlLayerList();
    }
  } catch (err) {
    console.error("Ū�� kmlList ���ѡG", err);
  }
}

// =======================================================
// updateKmlLayerSelects (reads kmlList doc and fills selects)
// =======================================================
async function updateKmlLayerSelects() {
  try {
    const listRef = db.collection("artifacts").doc(appId)
      .collection("public").doc("data").doc("kmlList");

    const doc = await listRef.get();
    if (!doc.exists) {
      kmlListCache = [];
      return;
    }

    const layers = doc.data().layers || [];
    kmlListCache = layers;

    const mainSelect = document.getElementById("kmlLayerSelect");
    const dashboardSelect = document.getElementById("kmlLayerSelectDashboard");

    if (mainSelect) {
      mainSelect.innerHTML = '<option value="">-- �п�� KML --</option>';
      layers.forEach(l => {
        const opt = document.createElement("option");
        opt.value = l.id;
        opt.textContent = l.name;
        mainSelect.appendChild(opt);
      });
    }

    if (dashboardSelect) {
      dashboardSelect.innerHTML = '<option value="">-- �п�� KML �ϼh --</option>';
      layers.forEach(l => {
        const opt = document.createElement("option");
        opt.value = l.id;
        opt.textContent = l.name;
        dashboardSelect.appendChild(opt);
      });
    }
    console.log("�U�Կ��w��s (kmlList)");
  } catch (err) {
    console.error("��s�U�Կ�楢�ѡG", err);
  }
}

// =======================================================
// Registration code management
// - registrationCodes stored in:
//   artifacts/{appId}/public/data/registrationCodes/{code}
// fields: role, createdBy, expiresAt (ms), createdAt
// =======================================================

function generateRandomCode(len = 8) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // avoid confusing chars
  let s = "";
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

async function generateRegistrationCode(role = "editor", ttlMinutes = 60) {
  if (!canGenerateCode()) {
    showMessageCustom("�z�S�����͵��U�X���v��", "error");
    return null;
  }
  const code = generateRandomCode(10);
  const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);
  const docRef = db.collection("artifacts").doc(appId)
    .collection("public").doc("data")
    .collection("registrationCodes").doc(code);
  await docRef.set({
    role,
    createdBy: currentUser?.email || "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    expiresAt
  });
  console.log("�w���͵��U�X�G", code);
  return code;
}

async function redeemRegistrationCode(code, nickname) {
  try {
    const codeRef = db.collection("artifacts").doc(appId)
      .collection("public").doc("data")
      .collection("registrationCodes").doc(code);
    const doc = await codeRef.get();
    if (!doc.exists) {
      showMessageCustom("�L�Ī����U�X", "error");
      return false;
    }
    const data = doc.data();
    if (Date.now() > (data.expiresAt || 0)) {
      showMessageCustom("���U�X�w�L��", "error");
      return false;
    }
    const role = data.role || "unapproved";

    // write user doc
    const uid = currentUser?.uid;
    if (!uid) {
      showMessageCustom("�Х��ϥ� Google �n�J", "error");
      return false;
    }
    const userRef = db.collection("users").doc(uid);
    await userRef.set({
      email: currentUser.email || "",
      nickname: nickname || (currentUser.displayName || ""),
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // delete the registration code (one-time)
    await codeRef.delete();

    showMessageCustom("���U�����A�Э��s��z�����H�M���v��", "success");
    // refresh user doc in memory
    await ensureUserDoc(currentUser);
    updateUIAfterLogin();
    return true;
  } catch (err) {
    console.error("�I�����U�X���ѡG", err);
    showMessageCustom("���U����", "error");
    return false;
  }
}

// =======================================================
// User management for owner
// - listUsers, changeUserRole, removeUser
// =======================================================
async function listUsers(limit = 200) {
  if (!isOwner()) {
    showMessageCustom("�z���O�޲z��", "error");
    return [];
  }
  try {
    const snapshot = await db.collection("users").limit(limit).get();
    const users = [];
    snapshot.forEach(doc => {
      users.push({ uid: doc.id, ...doc.data() });
    });
    return users;
  } catch (err) {
    console.error("�C�X�ϥΪ̥��ѡG", err);
    return [];
  }
}

async function changeUserRole(uid, newRole) {
  if (!isOwner()) {
    showMessageCustom("�z�S���v��", "error");
    return;
  }
  try {
    await db.collection("users").doc(uid).update({ role: newRole });
    showMessageCustom("�w��s�ϥΪ̨���", "success");
  } catch (err) {
    console.error("��s���⥢�ѡG", err);
    showMessageCustom("��s���⥢��", "error");
  }
}

async function removeUser(uid) {
  if (!isOwner()) {
    showMessageCustom("�z�S���v��", "error");
    return;
  }
  try {
    await db.collection("users").doc(uid).delete();
    showMessageCustom("�ϥΪ̤w����", "success");
  } catch (err) {
    console.error("�����ϥΪ̥��ѡG", err);
    showMessageCustom("��������", "error");
  }
}

// =======================================================
// DOMContentLoaded: wire UI elements from index.html
// =======================================================
document.addEventListener("DOMContentLoaded", () => {
  // main select
  const mainSelect = document.getElementById("kmlLayerSelect");
  if (mainSelect) {
    mainSelect.addEventListener("change", async (e) => {
      const id = e.target.value;
      if (id) await loadKmlLayerData(id);
    });
  }

  // dashboard file input and upload
  const hiddenFile = document.getElementById("hiddenKmlFileInput");
  const selectedNameSpan = document.getElementById("selectedKmlFileNameDashboard");
  const uploadBtn = document.getElementById("uploadKmlSubmitBtnDashboard");
  if (hiddenFile && selectedNameSpan && uploadBtn) {
    hiddenFile.addEventListener("change", () => {
      const f = hiddenFile.files?.[0];
      if (f) {
        selectedNameSpan.textContent = f.name;
        uploadBtn.disabled = false;
      } else {
        selectedNameSpan.textContent = "�|������ɮ�";
        uploadBtn.disabled = true;
      }
    });
    selectedNameSpan.addEventListener("click", () => hiddenFile.click());
    uploadBtn.addEventListener("click", async () => {
      await handleKmlUpload(hiddenFile);
      hiddenFile.value = "";
      selectedNameSpan.textContent = "�|������ɮ�";
      uploadBtn.disabled = true;
    });
  }

  // delete controls
  const deleteSelect = document.getElementById("kmlLayerSelectDashboard");
  const deleteBtn = document.getElementById("deleteSelectedKmlBtn");
  if (deleteSelect && deleteBtn) {
    deleteSelect.addEventListener("change", () => {
      deleteBtn.disabled = !deleteSelect.value;
    });
    deleteBtn.addEventListener("click", async () => {
      const id = deleteSelect.value;
      if (!id) return;
      if (!confirm(`�T�w�R�� ${id} ?`)) return;
      await deleteKmlLayer(id);
    });
  }

  // google sign-in
  const googleBtn = document.getElementById("googleSignInBtn");
  if (googleBtn) googleBtn.addEventListener("click", signInWithGoogle);

  // logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // pin button (localStorage)
  const pinBtn = document.getElementById("pinButton");
  if (pinBtn) {
    pinBtn.addEventListener("click", () => {
      const select = document.getElementById("kmlLayerSelect");
      const id = select?.value;
      if (!id) return;
      const key = "pinnedKmlId";
      const cur = localStorage.getItem(key);
      if (cur === id) {
        localStorage.removeItem(key);
        pinBtn.classList.remove("pinned");
        pinBtn.title = "�v��";
      } else {
        localStorage.setItem(key, id);
        pinBtn.classList.add("pinned");
        pinBtn.title = "�w�v��";
      }
    });
  }

  // registration code UI bindings
  const genCodeBtn = document.getElementById("generateRegistrationCodeBtn");
  const regCodeDisplay = document.getElementById("registrationCodeDisplay");
  const regCountdown = document.getElementById("registrationCodeCountdown");
  if (genCodeBtn) {
    genCodeBtn.addEventListener("click", async () => {
      if (!canGenerateCode()) {
        showMessageCustom("�z�S���v�����͵��U�X", "error");
        return;
      }
      const code = await generateRegistrationCode("editor", 60); // 60 minutes by default
      if (code && regCodeDisplay) {
        regCodeDisplay.textContent = code;
        regCodeDisplay.style.display = "inline";
        // optional countdown
        let remaining = 60 * 60; // seconds
        if (regCountdown) {
          regCountdown.style.display = "inline";
          regCountdown.textContent = `�Ѿl ${Math.floor(remaining/60)} ����`;
          const iv = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
              clearInterval(iv);
              regCountdown.style.display = "none";
              regCodeDisplay.style.display = "none";
            } else {
              regCountdown.textContent = `�Ѿl ${Math.floor(remaining/60)} ����`;
            }
          }, 1000);
        }
      }
    });
  }

  // registration modal confirm
  const confirmRegBtn = document.getElementById("confirmRegistrationCodeBtn");
  const regInput = document.getElementById("registrationCodeInput");
  const nickInput = document.getElementById("nicknameInput");
  if (confirmRegBtn && regInput && nickInput) {
    confirmRegBtn.addEventListener("click", async () => {
      const code = regInput.value.trim();
      const nickname = nickInput.value.trim() || currentUser?.displayName || "";
      if (!code) {
        showMessageCustom("�п�J���U�X", "error");
        return;
      }
      const ok = await redeemRegistrationCode(code, nickname);
      if (ok) {
        // close modal if exists
        const modal = document.getElementById("registrationCodeModalOverlay");
        if (modal) modal.style.display = "none";
      }
    });
  }

  // refresh users list (owner only)
  const refreshUsersBtn = document.getElementById("refreshUsersBtn");
  if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener("click", async () => {
      if (!isOwner()) {
        showMessageCustom("�z�S���v��", "error");
        return;
      }
      const users = await listUsers();
      renderUserList(users);
    });
  }
});

// =======================================================
// renderUserList (helper to populate userManagementSection list)
// =======================================================
function renderUserList(users) {
  const userListContainer = document.getElementById("userList");
  if (!userListContainer) return;

  // clear existing items except header
  const header = userListContainer.querySelector(".user-list-header");
  userListContainer.innerHTML = "";
  if (header) userListContainer.appendChild(header);

  users.forEach(u => {
    const row = document.createElement("div");
    row.className = "user-row";
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    row.style.padding = "6px 0";

    const email = document.createElement("div");
    email.className = "user-email";
    email.textContent = u.email || "";

    const nick = document.createElement("div");
    nick.className = "user-nick";
    nick.textContent = u.nickname || "";

    const role = document.createElement("div");
    role.className = "user-role";
    role.textContent = u.role || "";

    const actions = document.createElement("div");
    actions.className = "user-actions";

    // role select (owner can change)
    if (isOwner()) {
      const sel = document.createElement("select");
      ["owner", "editor", "user", "unapproved"].forEach(r => {
        const o = document.createElement("option");
        o.value = r;
        o.textContent = r;
        if (u.role === r) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", async () => {
        await changeUserRole(u.uid, sel.value);
      });
      actions.appendChild(sel);

      // remove button
      const rm = document.createElement("button");
      rm.textContent = "�R��";
      rm.addEventListener("click", async () => {
        if (!confirm(`�T�w�����ϥΪ� ${u.email} ?`)) return;
        await removeUser(u.uid);
        // refresh view
        const users2 = await listUsers();
        renderUserList(users2);
      });
      actions.appendChild(rm);
    } else {
      actions.textContent = "-";
    }

    row.appendChild(email);
    row.appendChild(nick);
    row.appendChild(role);
    row.appendChild(actions);
    userListContainer.appendChild(row);
  });
}

// =======================================================
// Expose some functions to global for console / debug
// =======================================================
window.handleKmlUpload = handleKmlUpload;
window.deleteKmlLayer = deleteKmlLayer;
window.generateRegistrationCode = generateRegistrationCode;
window.redeemRegistrationCode = redeemRegistrationCode;
window.listUsers = listUsers;
window.changeUserRole = changeUserRole;
window.removeUser = removeUser;
window.updateKmlLayerSelects = updateKmlLayerSelects;
window.loadKmlLayerListWrapper = loadKmlLayerListWrapper;

// =======================================================
// End of file
// =======================================================
