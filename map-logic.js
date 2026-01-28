// map-logic.js v1.9.7 - 完整版（含快取、debounce、錯誤處理）
(function () {
    'use strict';

    // 全域命名空間，以降低直接污染 window
    const ns = {
        map: null,
        markers: L.featureGroup(),
        navButtons: L.featureGroup(),
        geoJsonLayers: L.featureGroup(),
        allKmlFeatures: [],
        currentKmlLayerId: null,
        isLoadingKml: false,
        kmlCache: {}, // { [kmlId]: { data: <docData>, ts: <Date.now()> } }
        kmlCacheTtlMs: 1000 * 60 * 10, // 10 分鐘快取 TTL（視需求調整）
        _loadKmlDebounce: null
    };

    // ----------------------- 地圖初始化 -----------------------
    function initMap() {
        if (typeof L === 'undefined') {
            console.error('Leaflet 未載入，無法初始化地圖。');
            return;
        }

        // 初始化地圖
        ns.map = L.map('map', {
            attributionControl: true,
            zoomControl: false,
            maxZoom: 25,
            minZoom: 5
        }).setView([23.6, 120.9], 8);

        // 基本圖層定義
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
            'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
                maxZoom: 25,
                maxNativeZoom: 20
            })
        };

        // 嘗試還原上次使用的圖層（若不合法則回到預設）
        try {
            const lastLayerName = localStorage.getItem('lastBaseLayer');
            if (lastLayerName && baseLayers[lastLayerName]) {
                baseLayers[lastLayerName].addTo(ns.map);
                console.info(`已還原上次使用的圖層：${lastLayerName}`);
            } else {
                baseLayers['OpenStreetMap'].addTo(ns.map);
            }
        } catch (e) {
            baseLayers['OpenStreetMap'].addTo(ns.map);
            console.warn('還原上次使用圖層時發生錯誤，使用預設 OSM：', e);
        }

        // 加入控制層（可擴充）
        L.control.layers(baseLayers, {}).addTo(ns.map);

        // 加入 feature groups
        ns.geoJsonLayers.addTo(ns.map);
        ns.markers.addTo(ns.map);
        ns.navButtons.addTo(ns.map);
    }

    document.addEventListener('DOMContentLoaded', () => {
        initMap();
    });

    // ----------------------- GeoJSON 與圖層處理 -----------------------
    // 供外部使用：把 geojson 加到地圖
    function addGeoJsonLayers(geojsonOrFeatures, options = {}) {
        try {
            // 清除既有圖層
            ns.geoJsonLayers.clearLayers();

            const gj = (typeof geojsonOrFeatures === 'string') ? JSON.parse(geojsonOrFeatures) : geojsonOrFeatures;
            if (!gj) {
                console.warn('addGeoJsonLayers: 未提供有效 geojson');
                return;
            }

            // 支援 FeatureCollection 或單一 geometry/features
            const layer = L.geoJSON(gj, {
                onEachFeature: (feature, layer) => {
                    // 範例 popup：可依需修改
                    const name = feature.properties?.name || feature.properties?.title || '';
                    if (name) layer.bindPopup(name);
                },
                pointToLayer: (feature, latlng) => {
                    return L.marker(latlng);
                }
            });

            layer.eachLayer(l => ns.geoJsonLayers.addLayer(l));

            if (!ns.map) ns.map = window.map || ns.map;
            if (ns.map && options.fitBounds) {
                try {
                    const bounds = ns.geoJsonLayers.getBounds();
                    if (bounds && !bounds.isEmpty()) ns.map.fitBounds(bounds);
                } catch (e) {
                    console.warn('fitBounds 失敗：', e);
                }
            }

            // 同步 window.allKmlFeatures 以供搜尋使用（扁平化 features）
            try {
                const features = (gj.type === 'FeatureCollection' ? gj.features : (Array.isArray(gj) ? gj : [gj]));
                ns.allKmlFeatures = features || [];
                window.allKmlFeatures = ns.allKmlFeatures;
            } catch (e) {
                console.warn('同步 allKmlFeatures 失敗：', e);
            }
        } catch (e) {
            console.warn('addGeoJsonLayers 解析 geojson 失敗：', e);
        }
    }

    // 清除所有 KML / geojson 圖層（暴露給外部）
    function clearAllKmlLayers() {
        try {
            ns.geoJsonLayers.clearLayers();
            ns.markers.clearLayers();
            ns.allKmlFeatures = [];
            window.allKmlFeatures = ns.allKmlFeatures;
            ns.currentKmlLayerId = null;
            console.info('所有 KML 圖層和相關數據已清除。');
        } catch (e) {
            console.warn('clearAllKmlLayers 錯誤：', e);
        }
    }

    // ----------------------- 從 Firestore 載入 KML（含快取與去抖） -----------------------
    // 將 kml 存為 doc (geojson 欄位為字串或物件)，此函式只在必要時向 Firestore 讀取
    async function _fetchKmlDocFromFirestore(kmlId) {
        if (typeof db === 'undefined' || typeof appId === 'undefined') {
            throw new Error('Firestore 或 appId 未定義，無法讀取 KML。');
        }
        const docRef = db.collection('artifacts')
            .doc(appId).collection('public')
            .doc('data').collection('kmlLayers')
            .doc(kmlId);

        const doc = await docRef.get();
        if (!doc.exists) return null;
        return doc.data();
    }

    // 公開 API：載入 KML（有 debounce、local cache）
    async function loadKmlLayerFromFirestore(kmlId) {
        // 簡單去抖：清除前一次計時器並排程新的執行
        if (ns._loadKmlDebounce) clearTimeout(ns._loadKmlDebounce);

        ns._loadKmlDebounce = setTimeout(async () => {
            if (ns.isLoadingKml) {
                console.info("⏳ 已有讀取程序進行中，略過本次 loadKmlLayerFromFirestore()");
                return;
            }
            ns.isLoadingKml = true;

            try {
                if (!kmlId) {
                    console.info("未提供 KML ID，不載入。");
                    clearAllKmlLayers();
                    ns.isLoadingKml = false;
                    return;
                }

                // 若為相同 id 就直接返回（避免無謂讀取）
                if (ns.currentKmlLayerId === kmlId) {
                    console.info(`✅ 已載入圖層 ${kmlId}，略過重複讀取`);
                    ns.isLoadingKml = false;
                    return;
                }

                // 檢查本地快取
                const now = Date.now();
                const cacheEntry = ns.kmlCache[kmlId];
                if (cacheEntry && (now - cacheEntry.ts) < ns.kmlCacheTtlMs) {
                    console.info(`從本地快取讀取 KML ${kmlId}`);
                    const docData = cacheEntry.data;
                    try {
                        const geojson = (typeof docData.geojson === 'string') ? JSON.parse(docData.geojson) : docData.geojson;
                        addGeoJsonLayers(geojson, { fitBounds: true });
                        ns.currentKmlLayerId = kmlId;
                        ns.isLoadingKml = false;
                        return;
                    } catch (e) {
                        console.warn('解析快取的 geojson 失敗，將重新從 Firestore 讀取：', e);
                        // fallback -> fetch from Firestore
                    }
                }

                // 真正從 Firestore 讀取
                const docData = await _fetchKmlDocFromFirestore(kmlId);
                if (!docData) {
                    console.error('KML 圖層文檔未找到 ID:', kmlId);
                    window.showMessageCustom && window.showMessageCustom({ title: '錯誤', message: '找不到 KML 圖層' });
                    ns.isLoadingKml = false;
                    return;
                }

                // 寫入本地快取
                ns.kmlCache[kmlId] = { data: docData, ts: Date.now() };

                // 將 geojson 加到地圖
                try {
                    const geojson = (typeof docData.geojson === 'string') ? JSON.parse(docData.geojson) : docData.geojson;
                    addGeoJsonLayers(geojson, { fitBounds: true });
                } catch (e) {
                    console.error('解析從 Firestore 取得的 geojson 失敗：', e);
                }

                ns.currentKmlLayerId = kmlId;
            } catch (e) {
                console.error('載入 KML 發生錯誤：', e);
            } finally {
                ns.isLoadingKml = false;
            }
        }, 120); // 120 ms 去抖（避免 UI 連打）
    }

    // ----------------------- 輔助：載入全部 KML metadata，非每次抓 geojson（可用於列表） -----------------------
    async function listKmlLayersMeta() {
        if (typeof db === 'undefined' || typeof appId === 'undefined') {
            console.warn('Firestore 或 appId 未定義，無法列出 KML metadata。');
            return [];
        }
        try {
            const colRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers');
            const snap = await colRef.get();
            const arr = [];
            snap.forEach(d => arr.push({ id: d.id, ...(d.data() || {}) }));
            return arr;
        } catch (e) {
            console.warn('listKmlLayersMeta 失敗：', e);
            return [];
        }
    }

    // ----------------------- 對外暴露的 API 與命名空間 -----------------------
    window.addGeoJsonLayers = addGeoJsonLayers;
    window.clearAllKmlLayers = clearAllKmlLayers;
    window.loadKmlLayerFromFirestore = loadKmlLayerFromFirestore;
    window.listKmlLayersMeta = listKmlLayersMeta;
    window._internalMapLogicNamespace = ns;

})();