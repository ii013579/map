// --------------------------------------------------
// map-logic.js (Firepaths + kmlList + GeoJSON + 快取版)
// 可直接覆蓋 v1.9
// --------------------------------------------------

console.log("🔥 map-logic.js loaded");

if (!window.firepaths) {
    console.error("❌ firepaths 尚未初始化，請確認 firebase-init.js 已載入");
}

// Leaflet 全域物件
let map;
let geoJsonLayers = null;
let markers = null;

// 全域狀態
window.currentKmlLayerId = null;
window.isLoadingKml = false;
window.allKmlFeatures = [];

// --------------------------------------------------
// 初始化地圖
// --------------------------------------------------
window.initMap = function () {
    console.log("🌏 初始化地圖");

    map = L.map('map', {
        center: [23.5, 121],
        zoom: 8,
        zoomControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20
    }).addTo(map);

    geoJsonLayers = L.layerGroup().addTo(map);
    markers = L.layerGroup().addTo(map);

    console.log("🌏 地圖初始化完成");
};

// --------------------------------------------------
// 清除所有 KML 圖層
// --------------------------------------------------
window.clearAllKmlLayers = function () {
    if (geoJsonLayers) geoJsonLayers.clearLayers();
    if (markers) markers.clearLayers();

    window.allKmlFeatures = [];
    window.currentKmlLayerId = null;

    console.log("🧹 已清除所有 KML 圖層");
};

// --------------------------------------------------
// 將 GeoJSON 加入地圖
// --------------------------------------------------
window.addGeoJsonLayers = function (features) {
    if (!features || !Array.isArray(features)) {
        console.warn("⚠ addGeoJsonLayers() 接收到無效 features");
        return;
    }

    geoJsonLayers.clearLayers();
    markers.clearLayers();

    features.forEach(f => {
        if (!f.geometry) return;

        let layer = L.geoJSON(f, {
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.properties.name) {
                    layer.bindPopup(feature.properties.name);
                }
            }
        });

        layer.addTo(geoJsonLayers);

        // 點 feature 做成 marker（Leaflet 導航更好）
        if (f.geometry.type === "Point") {
            const coords = f.geometry.coordinates;
            L.marker([coords[1], coords[0]]).addTo(markers);
        }
    });

    console.log(`🗺 已加入 ${features.length} 個 GeoJSON features`);
};

// --------------------------------------------------
// 🚀 核心：從 Firestore 載入 KML 圖層（含快取）
// --------------------------------------------------
window.loadKmlLayerFromFirestore = async function (kmlId) {
    if (window.isLoadingKml) {
        console.log("⚠ 已有 KML 正在載入，略過本次呼叫");
        return;
    }
    window.isLoadingKml = true;
    console.log(`📥 載入 KML: ${kmlId}`);

    try {
        if (!kmlId) {
            console.warn("⚠ 未提供 KML ID，不載入");
            window.clearAllKmlLayers();
            return;
        }

        if (window.currentKmlLayerId === kmlId) {
            console.log(`⚠ 圖層 ${kmlId} 已載入，略過`);
            return;
        }

        window.clearAllKmlLayers();

        const docRef = window.firepaths.kmlList.doc(kmlId);

        // === 1. 先讀取快取 ===
        const cacheKey = `kmlCache_${kmlId}`;
        let cache = null;
        try {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) cache = JSON.parse(cachedData);
        } catch (e) {
            console.warn("⚠ 快取解析失敗，忽略", e);
        }

        if (cache) {
            console.log(`⚡ 從快取載入 KML（${kmlId}）`);
            window.allKmlFeatures = cache.geojson.features;
            window.currentKmlLayerId = kmlId;

            window.addGeoJsonLayers(cache.geojson.features);

            // zoom
            const allLayers = L.featureGroup([geoJsonLayers, markers]);
            const bounds = allLayers.getBounds();
            if (bounds && bounds.isValid()) {
                map.fitBounds(bounds, { padding: L.point(50, 50) });
            }

            // 背景檢查是否有新版
            docRef.get().then(doc => {
                if (!doc.exists) return;
                const serverUploadTime = doc.data().uploadTime?.toMillis?.() || 0;

                if (serverUploadTime > cache.uploadTime) {
                    console.log(`📦 Firestore 有新版本，更新快取: ${kmlId}`);

                    let geojson = doc.data().geojson;
                    if (typeof geojson === "string") {
                        try {
                            geojson = JSON.parse(geojson);
                        } catch (err) {
                            console.error("⚠ geojson 解析失敗", err);
                            return;
                        }
                    }

                    if (geojson && geojson.features) {
                        localStorage.setItem(
                            cacheKey,
                            JSON.stringify({
                                geojson: geojson,
                                uploadTime: serverUploadTime
                            })
                        );
                        console.log(`✅ 快取已更新 (${kmlId})`);
                    }
                }
            });

            return;
        }

        // === 2. 無快取 → 讀 Firestore ===
        const doc = await docRef.get();
        if (!doc.exists) {
            console.error("❌ 找不到 KML:", kmlId);
            window.showMessageCustom({
                title: "錯誤",
                message: "找不到指定的 KML 圖層。",
                buttonText: "確定"
            });
            return;
        }

        const kmlData = doc.data();

        let geojson = kmlData.geojson;
        if (typeof geojson === "string") {
            try {
                geojson = JSON.parse(geojson);
            } catch (err) {
                console.error("⚠ 無法解析 geojson", err);
                return;
            }
        }

        if (!geojson || !geojson.features || geojson.features.length === 0) {
            console.warn("⚠ 該 KML 沒有 features");
            window.allKmlFeatures = [];
            window.currentKmlLayerId = kmlId;
            return;
        }

        // 設定狀態
        window.allKmlFeatures = geojson.features;
        window.currentKmlLayerId = kmlId;

        window.addGeoJsonLayers(geojson.features);

        // 快取存檔
        localStorage.setItem(
            cacheKey,
            JSON.stringify({
                geojson: geojson,
                uploadTime: kmlData.uploadTime?.toMillis?.() || Date.now()
            })
        );

        // zoom
        const allLayers = L.featureGroup([geoJsonLayers, markers]);
        const bounds = allLayers.getBounds();
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: L.point(50, 50) });
        }

        console.log(`📦 已從 Firestore 載入: ${kmlId}`);

    } catch (err) {
        console.error("❌ loadKmlLayerFromFirestore 出錯:", err);
    } finally {
        window.isLoadingKml = false;
    }
};

// --------------------------------------------------
// 地圖初始化（確保 DOM ready）
// --------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        window.initMap();
    }, 200);
});
