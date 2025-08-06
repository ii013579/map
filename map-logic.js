// map-logic.js v4.2.48 - 修正圖層顯示錯誤

// 全域變數初始化
let map;
let markers = L.featureGroup();
let navButtons = L.featureGroup();
let geoJsonLayers = L.featureGroup();
// 新增 MarkerCluster 插件，用於自動聚合點位標記
let markerClusterGroup = L.markerClusterGroup({
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    removeOutsideVisibleBounds: true,
});
window.allKmlFeatures = [];
window.currentKmlLayerId = null;

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
        }),
        '臺灣通用電子地圖': L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
            attribution: '內政部國土測繪中心',
            maxZoom: 25,
            maxNativeZoom: 20
        }),
    };

    // 將所有基本圖層添加到地圖
    L.control.layers(baseLayers).addTo(map);

    // 預設載入 Google 街道圖
    baseLayers['Google 街道圖'].addTo(map);

    // 添加縮放控制項
    L.control.zoom({ position: 'topright' }).addTo(map);

    // 添加比例尺
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);

    // 將圖層群組添加到地圖
    geoJsonLayers.addTo(map);
    markers.addTo(map);
    navButtons.addTo(map);
    // 新增 MarkerCluster 圖層群組到地圖
    markerClusterGroup.addTo(map);
});


// 清空所有圖層、標記和快取
window.clearAllKmlLayers = () => {
    console.log("清空所有地圖圖層。");
    geoJsonLayers.clearLayers();
    markers.clearLayers();
    navButtons.clearLayers();
    markerClusterGroup.clearLayers();
    window.allKmlFeatures = [];
    window.currentKmlLayerId = null;
};

// --- 新增：從快取載入圖層的函數 ---
window.loadKmlLayerFromCache = (kmlId) => {
    if (!kmlId || !window.kmlLayerCache[kmlId]) {
        console.error("快取中找不到指定的圖層資料。");
        return;
    }
    
    window.clearAllKmlLayers();

    const cachedData = window.kmlLayerCache[kmlId];
    window.allKmlFeatures = cachedData.features;
    window.currentKmlLayerId = kmlId;
    
    window.addGeoJsonLayers(window.allKmlFeatures);
    
    const allLayers = L.featureGroup([geoJsonLayers, markers, navButtons, markerClusterGroup]);
    if (allLayers.getLayers().length > 0) {
        const bounds = allLayers.getBounds();
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: L.point(50, 50) });
        }
    }
    window.showMessage('載入成功', `圖層「${cachedData.name}」已從快取載入。`, () => {}, 3000);
};


// --- 修正：從 Firestore 讀取並將資料存入快取 ---
window.loadKmlLayerFromFirestore = async (kmlId) => {
    if (!kmlId) {
        console.error("未指定 KML 圖層 ID。");
        window.clearAllKmlLayers();
        return;
    }
    
    // 如果快取中已有資料，則直接從快取載入，並提早結束此函數
    if (window.kmlLayerCache[kmlId]) {
        console.log(`圖層 ${kmlId} 的資料已在快取中，直接從快取載入。`);
        window.loadKmlLayerFromCache(kmlId);
        return;
    }

    window.clearAllKmlLayers();
    const kmlLayersCollectionRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers');

    try {
        const kmlDoc = await kmlLayersCollectionRef.doc(kmlId).get();
        if (!kmlDoc.exists) {
            window.showMessage('錯誤', '找不到該 KML 圖層。');
            window.clearAllKmlLayers();
            return;
        }
        const kmlData = kmlDoc.data();
        const featuresSubCollectionRef = kmlLayersCollectionRef.doc(kmlId).collection('features');
        const featuresSnapshot = await featuresSubCollectionRef.get();
        
        let loadedFeatures = [];
        if (!featuresSnapshot.empty) {
            featuresSnapshot.forEach(doc => {
                const feature = doc.data();
                loadedFeatures.push(feature);
            });
        }
        
        if (loadedFeatures.length === 0) {
            window.showMessage('提示', 'KML 圖層載入完成但未發現有效地圖元素。', () => {}, 3000);
            window.allKmlFeatures = [];
            window.currentKmlLayerId = kmlId;
            // 即使是空圖層，也快取起來，避免重複讀取
            window.kmlLayerCache[kmlId] = {
                name: kmlData.name || kmlId,
                features: []
            };
            return;
        }

        // 成功載入後，將資料存入快取
        window.kmlLayerCache[kmlId] = {
            name: kmlData.name || kmlId,
            features: loadedFeatures
        };
        console.log(`已將圖層 ${kmlId} 的資料存入快取。`);
        
        window.allKmlFeatures = loadedFeatures;
        window.addGeoJsonLayers(window.allKmlFeatures);
        
        const allLayers = L.featureGroup([geoJsonLayers, markers, navButtons, markerClusterGroup]);
        if (allLayers.getLayers().length > 0) {
            const bounds = allLayers.getBounds();
            if (bounds && bounds.isValid()) {
                map.fitBounds(bounds, { padding: L.point(50, 50) });
            } else {
                console.warn("地理要素存在，但其邊界對於地圖視圖不適用。");
            }
        } else {
            console.warn("地圖上沒有圖層可適合。");
        }
        
        window.currentKmlLayerId = kmlId;
        window.showMessage('載入成功', `圖層「${kmlData.name}」已載入完成，共 ${loadedFeatures.length} 個地圖元素。`, () => {}, 3000);

    } catch (error) {
        console.error("從 Firestore 載入 KML 圖層時出錯:", error);
        window.showMessage('錯誤', `載入 KML 圖層時發生錯誤: ${error.message}`);
        window.clearAllKmlLayers();
    }
};

// 輔助函數：將 GeoJSON features 添加到地圖
window.addGeoJsonLayers = (features) => {
    // 移除此行，因為它會清除已載入的圖層
    // window.clearAllKmlLayers(); 
    
    const pointFeatures = features.filter(f => f.geometry.type === 'Point');
    const nonPointFeatures = features.filter(f => f.geometry.type !== 'Point');
    
    // 處理非點位 features (線條, 多邊形)
    L.geoJSON(nonPointFeatures, {
        style: (feature) => {
            const { styleUrl, styleHash, ...properties } = feature.properties;
            const style = {};
            if (properties.stroke) style.color = properties.stroke;
            if (properties['stroke-width']) style.weight = properties['stroke-width'];
            if (properties['stroke-opacity']) style.opacity = properties['stroke-opacity'];
            if (properties.fill) style.fillColor = properties.fill;
            if (properties['fill-opacity']) style.fillOpacity = properties['fill-opacity'];
            return style;
        },
        onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.name) {
                layer.bindPopup(`<h3>${feature.properties.name}</h3>`);
            }
        }
    }).addTo(geoJsonLayers);
    
    // 處理點位 features
    const pointMarkers = L.geoJSON(pointFeatures, {
        pointToLayer: (feature, latlng) => {
            const name = feature.properties.name || '未命名點';
            const description = feature.properties.description || '';
            
            const dotIcon = L.divIcon({
                className: 'user-location-dot',
                html: `<div class="user-location-pulse"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            const marker = L.marker(latlng, { icon: dotIcon, interactive: true });
            
            let popupContent = `<h3>${name}</h3>`;
            if (description) {
                popupContent += `<p>${description}</p>`;
            }
            
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latlng.lat},${latlng.lng}`;
            popupContent += `
                <a href="${googleMapsUrl}" target="_blank" class="popup-button">
                    <span class="material-symbols-outlined">near_me</span>
                    <span>導航</span>
                </a>
            `;
            marker.bindPopup(popupContent, {
                closeButton: true,
                autoClose: true
            });
            
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
            });
            
            return marker;
        }
    });

    markerClusterGroup.addLayer(pointMarkers);
};