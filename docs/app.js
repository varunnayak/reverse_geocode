/**
 * Reverse Geocode Demo - JavaScript Implementation
 * A browser-based implementation of reverse geocoding using a KD-tree
 */

// ===========================
// KD-Tree Implementation
// ===========================

class KDTree {
    constructor(points, k = 2) {
        this.k = k;
        this.root = this.buildTree(points, 0);
    }

    buildTree(points, depth) {
        if (points.length === 0) return null;

        const axis = depth % this.k;
        points.sort((a, b) => a.coords[axis] - b.coords[axis]);

        const mid = Math.floor(points.length / 2);

        return {
            point: points[mid],
            left: this.buildTree(points.slice(0, mid), depth + 1),
            right: this.buildTree(points.slice(mid + 1), depth + 1),
            axis: axis
        };
    }

    nearest(target, node = this.root, best = null, bestDist = Infinity, depth = 0) {
        if (node === null) return { best, bestDist };

        const point = node.point;
        const dist = this.distance(target, point.coords);

        if (dist < bestDist) {
            best = point;
            bestDist = dist;
        }

        const axis = depth % this.k;
        const diff = target[axis] - point.coords[axis];

        const first = diff < 0 ? node.left : node.right;
        const second = diff < 0 ? node.right : node.left;

        const result1 = this.nearest(target, first, best, bestDist, depth + 1);
        best = result1.best;
        bestDist = result1.bestDist;

        // Check if we need to search the other subtree
        if (Math.abs(diff) < bestDist) {
            const result2 = this.nearest(target, second, best, bestDist, depth + 1);
            best = result2.best;
            bestDist = result2.bestDist;
        }

        return { best, bestDist };
    }

    distance(a, b) {
        // Euclidean distance (good enough for nearby points)
        return Math.sqrt(
            Math.pow(a[0] - b[0], 2) +
            Math.pow(a[1] - b[1], 2)
        );
    }
}

// ===========================
// Application State
// ===========================

let cities = [];
let tree = null;
let currentMinPop = 0;
let map = null;
let marker = null;

// ===========================
// Initialization
// ===========================

async function init() {
    initMap();
    await loadCities();
    setupEventListeners();
}

function initMap() {
    map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
        attributionControl: false
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Custom marker icon
    const markerIcon = L.divIcon({
        html: `<div class="custom-marker">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="10" r="3"/>
                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
            </svg>
        </div>`,
        className: 'marker-container',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    // Add marker style
    const style = document.createElement('style');
    style.textContent = `
        .marker-container {
            background: none !important;
            border: none !important;
        }
        .custom-marker {
            width: 40px;
            height: 40px;
            color: #6366f1;
            filter: drop-shadow(0 4px 8px rgba(99, 102, 241, 0.4));
            animation: bounceIn 0.3s ease;
        }
        .custom-marker svg {
            width: 100%;
            height: 100%;
            fill: #6366f1;
        }
        @keyframes bounceIn {
            0% { transform: scale(0) translateY(-20px); }
            60% { transform: scale(1.1) translateY(0); }
            100% { transform: scale(1) translateY(0); }
        }
    `;
    document.head.appendChild(style);

    // Click handler
    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        document.getElementById('latitude').value = lat.toFixed(6);
        document.getElementById('longitude').value = lng.toFixed(6);
        search(lat, lng);
    });
}

async function loadCities() {
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');

    try {
        const response = await fetch('data/cities.json');
        cities = await response.json();

        console.log(`Loaded ${cities.length} cities`);

        // Build initial tree with all cities
        buildTree(0);

        loading.classList.add('hidden');
    } catch (error) {
        console.error('Failed to load cities:', error);
        loading.innerHTML = '<span style="color: #ef4444;">Failed to load city data</span>';
    }
}

function buildTree(minPop) {
    currentMinPop = minPop;

    // Filter cities by population
    const filtered = minPop > 0
        ? cities.filter(c => c.pop >= minPop)
        : cities;

    // Prepare points for KD-tree
    const points = filtered.map(city => ({
        coords: [city.lat, city.lng],
        data: city
    }));

    tree = new KDTree(points);
    console.log(`Built tree with ${points.length} cities (min pop: ${minPop})`);
}

// ===========================
// Event Listeners
// ===========================

function setupEventListeners() {
    // Search button
    document.getElementById('searchBtn').addEventListener('click', () => {
        const lat = parseFloat(document.getElementById('latitude').value);
        const lng = parseFloat(document.getElementById('longitude').value);

        if (isNaN(lat) || isNaN(lng)) {
            alert('Please enter valid coordinates');
            return;
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            alert('Coordinates out of range');
            return;
        }

        search(lat, lng);
    });

    // Population filter
    const popFilter = document.getElementById('populationFilter');
    const popValue = document.getElementById('popValue');

    popFilter.addEventListener('input', () => {
        const val = parseInt(popFilter.value);
        popValue.textContent = formatNumber(val);
    });

    popFilter.addEventListener('change', () => {
        const val = parseInt(popFilter.value);
        if (val !== currentMinPop) {
            buildTree(val);

            // Re-search if we have coordinates
            const lat = parseFloat(document.getElementById('latitude').value);
            const lng = parseFloat(document.getElementById('longitude').value);
            if (!isNaN(lat) && !isNaN(lng)) {
                search(lat, lng);
            }
        }
    });

    // Enter key on inputs
    ['latitude', 'longitude'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('searchBtn').click();
            }
        });
    });
}

// ===========================
// Search & Display
// ===========================

function search(lat, lng) {
    if (!tree) {
        console.error('Tree not initialized');
        return;
    }

    const result = tree.nearest([lat, lng]);

    if (result.best) {
        displayResult(result.best.data, lat, lng);
        updateMap(lat, lng, result.best.data);
    }
}

function displayResult(city, searchLat, searchLng) {
    const results = document.getElementById('results');
    results.classList.remove('hidden');

    // City name
    document.getElementById('resultCity').textContent = city.city;

    // Location (state, country)
    const locationParts = [];
    if (city.state) locationParts.push(city.state);
    if (city.country) locationParts.push(city.country);
    document.getElementById('resultLocation').textContent = locationParts.join(', ');

    // Details
    document.getElementById('resultCountryCode').textContent = city.country_code;
    document.getElementById('resultPopulation').textContent = formatNumber(city.pop);
    document.getElementById('resultCoords').textContent = `${city.lat.toFixed(4)}, ${city.lng.toFixed(4)}`;
}

function updateMap(lat, lng, city) {
    // Remove existing marker
    if (marker) {
        map.removeLayer(marker);
    }

    // Add new marker
    const markerIcon = L.divIcon({
        html: `<div class="custom-marker">
            <svg viewBox="0 0 24 24">
                <circle cx="12" cy="10" r="3" fill="#6366f1"/>
                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" fill="#6366f1"/>
            </svg>
        </div>`,
        className: 'marker-container',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    marker = L.marker([lat, lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`
            <div style="text-align: center; min-width: 150px;">
                <strong style="font-size: 1.1em; color: #a5b4fc;">${city.city}</strong><br>
                <span style="color: #a1a1aa;">${city.state ? city.state + ', ' : ''}${city.country}</span><br>
                <span style="font-size: 0.85em; color: #71717a;">Pop: ${formatNumber(city.pop)}</span>
            </div>
        `)
        .openPopup();

    // Pan map to location
    map.setView([lat, lng], Math.max(map.getZoom(), 6), { animate: true });
}

// ===========================
// Utilities
// ===========================

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num.toLocaleString();
}

// ===========================
// Start Application
// ===========================

document.addEventListener('DOMContentLoaded', init);
