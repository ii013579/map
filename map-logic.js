// =======================================================
// map-logic.js v2.0 ����
// Firestore �ϼh�M�� + ��h�֨�����
// =======================================================

document.addEventListener("DOMContentLoaded", function() {
    window.map = L.map("map", {
        zoomControl: false,
        attributionControl: false
    }).setView([23.7, 120.9], 7);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // ���J����
    L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 19,
        subdomains: ["mt0", "mt1", "mt2", "mt3"]
    }).addTo(map);

    // ��l�ƥ���ϼh�ܼ�
    window.geoJsonLayers = L.layerGroup().addTo(map);
    window.markers = L.layerGroup().addTo(map);

    console.log("? �a�Ϫ�l�Ƨ���");
});

// =======================================================
// GeoJSON �B�z�P�˦��]�w
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
    console.log(`?? �w�[�J ${features.length} �Ӧa�Ϥ���`);
};

// �M���Ҧ��ϼh
window.clearAllKmlLayers = function() {
    window.geoJsonLayers.clearLayers();
    window.markers.clearLayers();
    console.log("?? �Ҧ��ϼh�w�M��");
};

// =======================================================
// v2.0: Firestore �ϼh�M�� + ��h�֨�
// =======================================================

window.isLoadingKml = false;
window.kmlLayerList = [];
window.currentKmlLayerId = null;

/**
 * �@���ʸ��J KML �ϼh�M��]�u�� Firestore 1 ���^
 */
window.loadKmlLayerList = async function() {
    try {
        const listRef = db.collection("artifacts").doc(appId)
            .collection("public").doc("data")
            .doc("kmlList"); // ? ��@���A�s�Ҧ��ϼh��T

        const doc = await listRef.get();
        if (!doc.exists) {
            console.error("? �䤣��ϼh�M����");
            return;
        }

        const data = doc.data();
        window.kmlLayerList = data.layers || [];
        console.log(`?? �w���J�ϼh�M��A�@ ${window.kmlLayerList.length} �h`);

        // �۰ʶ�J�U�Կ��
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
        console.error("Ū���ϼh�M�楢��:", err);
    }
};

/**
 * ���J��@�ϼh�]�t localStorage �֨� + uploadTime ���ҡ^
 */
window.loadKmlLayerData = async function(kmlId) {
    if (window.isLoadingKml) {
        console.log("?? �ϼh���J���A���L���ƩI�s");
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

        // �q�M���X metadata�]�]�t uploadTime�^
        const meta = window.kmlLayerList.find(l => l.id === kmlId);
        const serverUploadTime = meta?.uploadTime || 0;

        // ? ���֨��B�ɶ��@�P �� ������
        if (cache && cache.uploadTime === serverUploadTime) {
            console.log(`? �q�֨����J�ϼh ${kmlId}`);
            window.addGeoJsonLayers(cache.geojson.features);
            fitMapToCurrentLayers();
            return;
        }

        // ? �S�֨��Ϊ������� �� �q Firestore �U��
        const docRef = db.collection("artifacts").doc(appId)
            .collection("public").doc("data")
            .collection("kmlLayers").doc(kmlId);

        const doc = await docRef.get();
        if (!doc.exists) {
            console.error("�䤣��ϼh���:", kmlId);
            return;
        }

        const kmlData = doc.data();
        let geojson = kmlData.geojsonContent;
        if (typeof geojson === "string") {
            try { geojson = JSON.parse(geojson); } catch (e) { console.error(e); return; }
        }

        if (!geojson || !geojson.features) {
            console.warn("�ϼh�S�� features:", kmlId);
            return;
        }

        // �[�J�a��
        window.addGeoJsonLayers(geojson.features);
        fitMapToCurrentLayers();

        // �s�J�֨�
        localStorage.setItem(cacheKey, JSON.stringify({
            geojson,
            uploadTime: serverUploadTime
        }));

        console.log(`?? �w���J Firestore: ${kmlId}`);
    } catch (err) {
        console.error("���J�ϼh�ɥX��:", err);
    } finally {
        window.isLoadingKml = false;
    }
};

/**
 * �վ�a�Ͻd��
 */
function fitMapToCurrentLayers() {
    const allLayers = L.featureGroup([geoJsonLayers, markers]);
    const bounds = allLayers.getBounds();
    if (bounds && bounds.isValid()) {
        map.fitBounds(bounds, { padding: L.point(50, 50) });
    }
}
