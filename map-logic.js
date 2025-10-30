// =======================================================
// map-logic.js v2.0 版本
// Firestore 圖層清單 + 單層快取機制
// =======================================================

document.addEventListener("DOMContentLoaded", function() {
    window.map = L.map("map", {
        zoomControl: false,
        attributionControl: false
    }).setView([23.7, 120.9], 7);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // 載入底圖
    L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 19,
        subdomains: ["mt0", "mt1", "mt2", "mt3"]
    }).addTo(map);

    // 初始化全域圖層變數
    window.geoJsonLayers = L.layerGroup().addTo(map);
    window.markers = L.layerGroup().addTo(map);

    console.log("? 地圖初始化完成");
});

// =======================================================
// GeoJSON 處理與樣式設定
// =======================================================

window.addGeoJsonLayers = function(features) {
    if (!features || !Array.isArray(features)) return;

    window.geoJsonLayers.clearLayers();
    window.markers.clearLayers();

    const geoJsonLayer = L.geoJson(features, {
        pointToLayer: function(feature, latlng) {
            const marker = L.circleMarker(latlng, {
                radius: 6,
                fillColor: "#0078FF",
                color: "#fff",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.9
            });

            if (feature.properties && feature.properties.name) {
                marker.bindPopup(feature.properties.name);
            }
            window.markers.addLayer(marker);
            return marker;
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(feature.properties.name);
            }
        },
        style: {
            color: "#3388ff",
            weight: 2,
            opacity: 0.6
        }
    });

    window.geoJsonLayers.addLayer(geoJsonLayer);
    console.log(`?? 已加入 ${features.length} 個地圖元素`);
};

// 清除所有圖層
window.clearAllKmlLayers = function() {
    window.geoJsonLayers.clearLayers();
    window.markers.clearLayers();
    console.log("?? 所有圖層已清除");
};

// =======================================================
// v2.0: Firestore 圖層清單 + 單層快取
// =======================================================

window.isLoadingKml = false;
window.kmlLayerList = [];
window.currentKmlLayerId = null;

/**
 * 一次性載入 KML 圖層清單（只打 Firestore 1 次）
 */
window.loadKmlLayerList = async function() {
    try {
        const listRef = db.collection("artifacts").doc(appId)
            .collection("public").doc("data")
            .doc("kmlList"); // ? 單一文件，存所有圖層資訊

        const doc = await listRef.get();
        if (!doc.exists) {
            console.error("? 找不到圖層清單文件");
            return;
        }

        const data = doc.data();
        window.kmlLayerList = data.layers || [];
        console.log(`?? 已載入圖層清單，共 ${window.kmlLayerList.length} 層`);

        // 自動填入下拉選單
        const select = document.getElementById("kmlLayerSelect");
        if (select) {
            select.innerHTML = "";
            window.kmlLayerList.forEach(layer => {
                const opt = document.createElement("option");
                opt.value = layer.id;
                opt.textContent = layer.name;
                select.appendChild(opt);
            });
        }

    } catch (err) {
        console.error("讀取圖層清單失敗:", err);
    }
};

/**
 * 載入單一圖層（含 localStorage 快取 + uploadTime 驗證）
 */
window.loadKmlLayerData = async function(kmlId) {
    if (window.isLoadingKml) {
        console.log("?? 圖層載入中，略過重複呼叫");
        return;
    }
    window.isLoadingKml = true;

    try {
        window.clearAllKmlLayers();

        const cacheKey = `kmlCache_${kmlId}`;
        const cacheRaw = localStorage.getItem(cacheKey);
        let cache = null;
        if (cacheRaw) {
            try { cache = JSON.parse(cacheRaw); } catch { cache = null; }
        }

        // 從清單找出 metadata（包含 uploadTime）
        const meta = window.kmlLayerList.find(l => l.id === kmlId);
        const serverUploadTime = meta?.uploadTime || 0;

        // ? 有快取且時間一致 → 直接用
        if (cache && cache.uploadTime === serverUploadTime) {
            console.log(`? 從快取載入圖層 ${kmlId}`);
            window.addGeoJsonLayers(cache.geojson.features);
            fitMapToCurrentLayers();
            return;
        }

        // ? 沒快取或版本不符 → 從 Firestore 下載
        const docRef = db.collection("artifacts").doc(appId)
            .collection("public").doc("data")
            .collection("kmlLayers").doc(kmlId);

        const doc = await docRef.get();
        if (!doc.exists) {
            console.error("找不到圖層文件:", kmlId);
            return;
        }

        const kmlData = doc.data();
        let geojson = kmlData.geojsonContent;
        if (typeof geojson === "string") {
            try { geojson = JSON.parse(geojson); } catch (e) { console.error(e); return; }
        }

        if (!geojson || !geojson.features) {
            console.warn("圖層沒有 features:", kmlId);
            return;
        }

        // 加入地圖
        window.addGeoJsonLayers(geojson.features);
        fitMapToCurrentLayers();

        // 存入快取
        localStorage.setItem(cacheKey, JSON.stringify({
            geojson,
            uploadTime: serverUploadTime
        }));

        console.log(`?? 已載入 Firestore: ${kmlId}`);
    } catch (err) {
        console.error("載入圖層時出錯:", err);
    } finally {
        window.isLoadingKml = false;
    }
};

/**
 * 調整地圖範圍
 */
function fitMapToCurrentLayers() {
    const allLayers = L.featureGroup([geoJsonLayers, markers]);
    const bounds = allLayers.getBounds();
    if (bounds && bounds.isValid()) {
        map.fitBounds(bounds, { padding: L.point(50, 50) });
    }
}
