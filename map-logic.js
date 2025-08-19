// map-logic.js v1.8.2 - 修正載入 GeoJSON 後無法顯示問題

// 全域變數初始化，確保它們在整個腳本中可被訪問
let map;
let markers = L.featureGroup();
let navButtons = L.featureGroup();
let geoJsonLayers = L.featureGroup();
window.allKmlFeatures = [];
window.currentKmlLayerId = null;
let appId = 'example'; // 請替換為您的 Firebase 專案ID

// DOM 載入完成後初始化地圖和控制項
document.addEventListener('DOMContentLoaded', () => {
    // 初始化地圖
    map = L.map('map', {
        attributionControl: true,
        zoomControl: false,
        maxZoom: 25,
        minZoom: 5
    }).setView([23.6, 120.9], 8);

    // 定義基本圖層
    const baseLayers = {
        'Google 街道圖': L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps',
            maxZoom: 25,
            maxNativeZoom: 20
        }),
        'Google 衛星圖': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps',
            maxZoom: 25,
            maxNativeZoom: 20
        }),
        'Google 地形圖': L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps',
            maxZoom: 25,
            maxNativeZoom: 20
        })
    };

    baseLayers['Google 街道圖'].addTo(map);

    // 載入地圖上所有控制項
    loadAllMapControls(map, baseLayers, markers, navButtons, geoJsonLayers);
});

// 全域函式：清理所有 KML 圖層
window.clearAllKmlLayers = function() {
    console.log("正在清除所有 KML 圖層...");
    
    if (geoJsonLayers) {
        geoJsonLayers.clearLayers();
    }
    window.allKmlFeatures = [];
    window.currentKmlLayerId = null;
    
    console.log("KML 圖層已清除。");
};

// 全域函式：將 GeoJSON features 添加到地圖上
// 此函式現在接受 GeoJSON 物件並將其添加到 geoJsonLayers L.featureGroup
window.addGeoJsonLayers = function(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) {
        console.warn("未提供有效的 GeoJSON 或 features 為空，無法添加圖層。");
        return;
    }
    
    // 清除舊圖層
    geoJsonLayers.clearLayers();
    
    // 遍歷所有 features 並創建新的 Leaflet 圖層
    const newGeoJsonLayer = L.geoJSON(geojson, {
        style: function(feature) {
            return {
                color: '#ff7800',
                weight: 5,
                opacity: 0.65
            };
        },
        onEachFeature: function(feature, layer) {
            // 綁定彈出視窗
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(`<strong>${feature.properties.name}</strong>`);
            }
        }
    }).addTo(geoJsonLayers);
    
    // 將 geoJsonLayers 群組添加到地圖
    geoJsonLayers.addTo(map);
    
    console.log(`已成功添加 ${geojson.features.length} 個新的 GeoJSON 圖層到地圖。`);
};

// 載入 KML 圖層
window.loadKmlLayerFromFirestore = async function(kmlId) {
    if (window.currentKmlLayerId === kmlId) {
        console.log(`✅ 已載入圖層 ${kmlId}，略過重複讀取`);
        return;
    }

    try {
        window.clearAllKmlLayers();

        const docRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(kmlId);
        const doc = await docRef.get();
        if (!doc.exists) {
            console.error(`找不到 ID 為 ${kmlId} 的 KML 圖層文檔。`);
            window.showMessageCustom({
                title: '錯誤',
                message: '找不到指定的 KML 圖層。',
                buttonText: '確定'
            });
            return;
        }

        const kmlData = doc.data();
        let geojson;
        
        if (kmlData.geojsonContent) {
            try {
                geojson = JSON.parse(kmlData.geojsonContent);
            } catch (jsonError) {
                console.error("解析 GeoJSON 內容時出錯:", jsonError);
                window.showMessageCustom({
                    title: '載入失敗',
                    message: 'GeoJSON 內容格式錯誤，無法解析。',
                    buttonText: '確定'
                });
                return;
            }
        } else {
            console.warn(`KML 圖層 "${kmlData.name}" (ID: ${kmlId}) 沒有 'geojsonContent' 欄位。`);
            window.showMessageCustom({
                title: '載入警示',
                message: 'KML 圖層內容已過時或無效，請重新上傳。',
                buttonText: '確定'
            });
            window.allKmlFeatures = [];
            window.currentKmlLayerId = kmlId;
            return;
        }

        if (!geojson || !geojson.features || geojson.features.length === 0) {
            console.warn(`KML 圖層 "${kmlData.name}" 沒有有效的 geojsonContent 或 features 為空。`);
            window.showMessageCustom({
                title: '載入警示',
                message: 'KML 圖層載入完成但未發現有效地圖元素。',
                buttonText: '確定'
            });
            window.allKmlFeatures = [];
            window.currentKmlLayerId = kmlId;
            return;
        }

        window.allKmlFeatures = geojson.features;
        window.currentKmlLayerId = kmlId;

        // 呼叫更新後的函式
        window.addGeoJsonLayers(geojson);

        const bounds = geoJsonLayers.getBounds();
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: L.point(50, 50) });
        }
        
    } catch (error) {
        console.error("讀取 KML 圖層失敗:", error);
        window.showMessageCustom({
            title: '載入失敗',
            message: `載入 KML 圖層時發生錯誤：${error.message}`,
            buttonText: '確定'
        });
        window.currentKmlLayerId = null;
    }
};

// ... (其他您自定義的函式，例如 loadAllMapControls, toGeoJSON, 等，請從您的原始檔案中複製過來)
// 確保您在 `DOMContentLoaded` 事件中正確呼叫了 `loadAllMapControls`