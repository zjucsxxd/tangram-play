import { throttle } from 'lodash';
import localforage from 'localforage';
import L from 'leaflet';
import Tangram from 'tangram'; // eslint-disable-line import/no-extraneous-dependencies, import/no-unresolved
import LeafletHash from './leaflet-hash';
import EventEmitter from '../components/event-emitter';

import { hideSceneLoadingIndicator } from './MapLoading';
import { handleInspectionHoverEvent, handleInspectionClickEvent } from './inspection';

// We need to manually set the image path when Leaflet is bundled.
// See https://github.com/Leaflet/Leaflet/issues/766
L.Icon.Default.imagePath = './data/imgs';

/* eslint-disable import/no-mutable-exports */
// ^ Not ideal, but this is what it is right now
export let map;

// Declare these exports now, but Tangram is set up later.
// See initTangram() and loadScene().
export let tangramLayer = null;
export let tangramScene = null;

/**
 * Initializes Tangram
 * Tangram must be initialized with a scene file. Only initialize Tangram when
 * Tangram Play knows what scene to load, not before. See loadScene().
 */
function initTangram(pathToSceneFile) {
    // Add Tangram Layer
    tangramLayer = Tangram.leafletLayer({
        scene: pathToSceneFile,
        events: {
            hover: handleInspectionHoverEvent,
            click: handleInspectionClickEvent,
        },
    });
    tangramLayer.addTo(map);

    tangramLayer.scene.subscribe({
        load(args) {
            EventEmitter.dispatch('tangram:sceneupdate', args);
        },

        // Hides loading indicator after vector tiles have downloaded and rendered
        // Plus a short delay to ease the transition
        /* eslint-disable camelcase */
        view_complete() {
            window.setTimeout(() => {
                hideSceneLoadingIndicator();
            }, 250);
        },
        /* eslint-enable camelcase */
    });

    // Attach scene to export
    tangramScene = tangramLayer.scene;

    // Export to window for debugging.
    window.layer = tangramLayer;
    window.scene = tangramLayer.scene;
}

// Sends a scene path and base path to Tangram.
export function loadScene(pathToSceneFile, { reset = false, basePath = null } = {}) {
    // Initialize Tangram if it's not already set.
    // Tangram must be initialized with a scene file.
    // We only initialize Tangram when Tangram Play
    // knows what scene to load, not before.
    if (!tangramLayer) {
        return initTangram(pathToSceneFile);
    }

    // If scene is already set, re-use the internal path
    // If scene is not set, default to current path
    // This is ignored if reset is true; see below)
    const path = basePath || tangramLayer.scene.config_path;
    // Preserve scene base path unless reset requested (e.g. reset on new file load)
    return tangramLayer.scene.load(pathToSceneFile, !reset && path);
}

function getMapStartLocation() {
    // Set default location
    const defaultStartLocation = {
        latlng: [0.0, 0.0],
        zoom: 3,
    };

    // URL Parsing
    // Leaflet-style URL hash pattern: ?scene.yaml#[zoom],[lat],[lng]
    let urlHash = window.location.hash.slice(1).split('/');
    if (urlHash.length === 3) {
        // Convert from strings
        urlHash = urlHash.map(Number);

        return Promise.resolve({
            latlng: [urlHash[1], urlHash[2]],
            zoom: urlHash[0],
        });
    }

    // If no valid URL hash is provided, check local storage to see if
    // lat & lng & zoom have been saved from a previous session
    return localforage.getItem('last-map-view')
        .then((view) => {
            if (view && view.lat && view.lng && view.zoom) {
                return {
                    latlng: [view.lat, view.lng],
                    zoom: view.zoom,
                };
            }

            return defaultStartLocation;
        });
}

/* New section to handle React components */

// Need to setup dispatch services to let the React component MapPanel
// know when map has changed. These are throttled to prevent expensive
// React operations to be performed in rapid succession.
function setupEventListeners() {
    // Make sure that map zoom label changes when the map is done zooming
    map.on('zoomend', throttle((e) => {
        EventEmitter.dispatch('leaflet:zoomend', {});
    }), 500);
    // Any other time the map moves: drag, bookmark select, tangram play edit
    map.on('moveend', throttle((e) => {
        EventEmitter.dispatch('leaflet:moveend', {});
    }), 1000);
}

// Initializes Leaflet-based map
export function initMap() {
    // Initalize Leaflet
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        maxZoom: 24,
        keyboardZoomOffset: 0.05,
        zoomSnap: 0, // Enables fractional zoom.
    });

    // Get map start position
    getMapStartLocation()
        .then((mapStartLocation) => {
            // Create Leaflet map
            map.setView(mapStartLocation.latlng, mapStartLocation.zoom);

            // Add leaflet-hash (forked version)
            const hash = new LeafletHash(map, { refreshInterval: 250 }); // eslint-disable-line no-unused-vars

            // Report ready to other things that depend on map state.
            // The problem is that the other map-based sub-components like MapPanel
            // cannot assume that the map exists already when they're mounted,
            // because the children of this component will be mounted before
            // the parent's componentDidMount() is called. So, like all other
            // inter-component communication outside of the React framework, we
            // currently use an EventEmitter to report a ready state, which then
            // populates the sub-components' state. I'd imagine this situation to
            // improve when we look into a react-leaflet implementation.
            EventEmitter.dispatch('map:init');
        })
        .catch((error) => {
            console.error(error);
        });

    // Force Leaflet to update itself.
    // This resolves an issue where the map may sometimes not appear
    // or only partially appear when this app is first loaded.
    window.setTimeout(() => {
        map.invalidateSize(false);
    }, 0);

    // Set up a listener to record current map view settings when user leaves
    window.addEventListener('beforeunload', (event) => {
        localforage.setItem('last-map-view', {
            lat: map.getCenter().lat,
            lng: map.getCenter().lng,
            zoom: map.getZoom(),
        });
    });

    setupEventListeners();
}
