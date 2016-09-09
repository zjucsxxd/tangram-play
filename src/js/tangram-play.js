import React from 'react';
import ReactDOM from 'react-dom';
import localforage from 'localforage';
import { debounce } from 'lodash';

// Core elements
import { tangramLayer, loadScene } from './map/map';
import { editor, getEditorContent, setEditorContent } from './editor/editor';

// Addons
import { showSceneLoadingIndicator, hideSceneLoadingIndicator } from './map/MapLoading';
import { initWidgetMarks } from './widgets/widgets-manager';
import { initErrorsManager } from './editor/errors';
import { initSuggestions } from './editor/suggest';
import { initGlslPickers } from './components/glsl-pickers/glsl-pickers';
import ErrorModal from './modals/ErrorModal';

// Import Utils
import { prependProtocolToUrl } from './tools/helpers';
import { getQueryStringObject, pushHistoryState, replaceHistoryState } from './tools/url-state';
import { isGistURL, getSceneURLFromGistAPI } from './tools/gist-url';
import { initHighlight, highlightRanges } from './editor/highlight';
import EventEmitter from './components/event-emitter';

const DEFAULT_SCENE = 'data/scenes/default.yaml';
const STORAGE_LAST_EDITOR_CONTENT = 'last-content';

let initialLoad = true;
let initialScene = ''; // Stores initial scene file for embedded play.

function showUnloadedState() {
    document.querySelector('.map-view').classList.add('map-view-not-loaded');
}

function hideUnloadedState() {
    document.querySelector('.map-view').classList.remove('map-view-not-loaded');
}
/**
 * Determine what is the scene url and content to load during start-up
 * Reading local memory is asynchronous, so this returns a Promise
 *
 * @returns {Promise} - resolves to an object of scene data.
 */
function determineScene() {
    // If there is a query, return it
    const query = getQueryStringObject();
    if (query.scene) {
        return new Promise((resolve) => {
            resolve({ url: query.scene });
        });
    }

    // Else if there is something saved in memory (localforage), return that
    // Check that contents exist and that it is not empty.
    return localforage.getItem(STORAGE_LAST_EDITOR_CONTENT)
        .then((sceneData) => {
            if (sceneData && sceneData.contents && sceneData.contents.trim().length > 0) {
                return sceneData;
            }

            // Else load the default scene file.
            return { url: DEFAULT_SCENE };
        });
}

// If editor is updated, send it to the map.
function updateContent() {
    const content = getEditorContent();
    const url = URL.createObjectURL(new Blob([content]));
    const isClean = editor.getDoc().isClean();

    // Send scene data to Tangram
    loadScene(url);

    // Update the page URL. When editor contents changes by user input
    // and the the editor state is not clean), we erase the ?scene= state
    // from the URL string. This prevents a situation where reloading (or
    // copy-pasting the URL) loads the scene file from an earlier state.
    if (!isClean) {
        replaceHistoryState({
            scene: null,
        });
    }
}

// Update widgets & content after a batch of changes
// Wrap updateContent() in a debounce function
const watchEditorForChanges = debounce(updateContent, 500);

function setSceneContentsInEditor(sceneData) {
    // Mark as "clean" if the contents are freshly loaded
    // (there is no is_clean property defined) or if contents
    // have been restored with the is_clean property set to "true"
    // This is converted from JSON so the value is a string, not
    // a Boolean. Otherwise, the document has not been previously
    // saved and it is left in the "dirty" state.
    const shouldMarkClean = (typeof sceneData.is_clean === 'undefined' ||
        sceneData.is_clean === 'true');

    setEditorContent(sceneData.contents, shouldMarkClean);

    if (window.isEmbedded === undefined) {
        // Restore cursor position, if provided.
        if (sceneData.cursor) {
            editor.doc.setCursor(sceneData.cursor, {
                scroll: false,
            });
        }
    }

    // Restores the part of the document that was scrolled to, if provided.
    if (sceneData.scrollInfo) {
        const left = sceneData.scrollInfo.left || 0;
        const top = sceneData.scrollInfo.top || 0;
        editor.scrollTo(left, top);
    }

    // Turn change watching back on.
    editor.on('changes', watchEditorForChanges);
}

function doLoadProcess(scene) {
    initialScene = scene; // Store our intial scene for use within embedded Tangram Play

    const url = scene.url || URL.createObjectURL(new Blob([scene.contents]));

    // Send url to map and contents to editor
    // TODO: get contents from Tangram instead of another xhr request.
    loadScene(url, {
        reset: true,
        basePath: scene.original_base_path,
    });
    setSceneContentsInEditor(scene);

    hideUnloadedState();

    // Update history
    // Don't push a new history state if we are loading a scene from the
    // initial load of Tangram Play.
    if (initialLoad === false) {
        pushHistoryState({
            scene: (scene.url) ? scene.url : null,
        });
    }

    // This should only be true once
    initialLoad = false;

    // Trigger Events
    // Event object is empty right now.
    EventEmitter.dispatch('tangram:sceneload', {});

    // Return the Promise from Tangram initializing
    return tangramLayer.scene.initializing;
}

function onLoadError(error, errorHandler) {
    function confirmFunction() {
        if (errorHandler && typeof errorHandler === 'function') {
            errorHandler(error);
        }
    }
    ReactDOM.render(
        <ErrorModal error={error.message} confirmFunction={confirmFunction} />,
        document.getElementById('modal-container')
    );
    hideSceneLoadingIndicator();

    // TODO: editor should not be attached to this
    if (initialLoad === true) {
        showUnloadedState(editor);
        editor.doc.markClean();
    }
}

/**
 * This function is the canonical way to load a scene in Tangram Play.
 * We want to avoid loading scene files directly into either Tangram
 * or in CodeMirror and then having to update other parts of Tangram Play.
 * Instead, we load new scenes here so that all the different parts
 * of the application can be updated predictably. The load function takes
 * either a URL path (for remote / external scenes), or the contents
 * of a Tangram YAML file itself.
 *
 * @param {Object} scene - an object containing one of two properties:
 *      scene.url - a URL path to load a scene from
 *      scene.contents - Tangram YAML as a text blob
 *      Do not pass in both! Currently `url` takes priority, but
 *      this is not guaranteed behaviour.
 * @param {Function} errorHandler - a function that is executed if loading
 *      results in an error. Called after dismissing the error modal.
 * @returns {Promise} A promise which is resolved when a scene's
 *      contents has been fetched.
 */
export function load(scene, errorHandler) {
    EventEmitter.dispatch('tangram:clear-palette', {});

    // Turn on loading indicator. This is turned off later
    // when Tangram reports that it's done.
    showSceneLoadingIndicator();

    // Turn off watching for changes in editor.
    editor.off('changes', watchEditorForChanges);

    let sceneUrl = scene.url;

    // Either we are passed a url path, or scene file contents
    if (scene.url) {
        let fetchPromise;

        // Provide protocol if it appears to be protocol-less URL
        sceneUrl = prependProtocolToUrl(sceneUrl);

        // If it appears to be a Gist URL:
        if (isGistURL(sceneUrl) === true) {
            fetchPromise = getSceneURLFromGistAPI(sceneUrl)
                .then(url => {
                    // Update the scene URL property with the correct URL
                    // to the raw YAML to ensure safe loading
                    sceneUrl = url;
                    return window.fetch(url);
                });
        } else {
            // Fetch the contents of a YAML file directly. This step
            // allows us to verify contents (TODO) or error status.
            fetchPromise = window.fetch(sceneUrl);
        }

        return fetchPromise.then(response => {
            if (!response.ok) {
                const errorObj = {
                    status: response.status,
                    url: sceneUrl,
                };

                if (response.status === 404) {
                    errorObj.message = 'The scene you requested could not be found.';
                    throw errorObj;
                } else {
                    errorObj.message = 'Something went wrong loading the scene!';
                    throw errorObj;
                }
            }

            return response.text();
        })
        .then(contents => doLoadProcess({ url: sceneUrl, contents }))
        .catch(error => {
            onLoadError(error, errorHandler);

            // Rethrow the error so it can be caught by the original caller of load()
            throw error;
        });
    } else if (scene.contents) {
        // If scene contents are provided, no asynchronous work is
        // performed here, but wrap this response in a Promise anyway
        // so that the return object is always a thenable.
        return new Promise((resolve) => {
            doLoadProcess(scene);
            resolve();
        });
    }

    // if neither `scene.url` or `scene.contents` is provided, throw an error
    throw new Error('no scene url or contents provided');
}

export function initTangramPlay() {
    // TODO: Manage history / routing in its own module
    window.onpopstate = (e) => {
        if (e.state && e.state.scene) {
            load({ url: e.state.scene });
        }
    };

    // LOAD SCENE FILE
    determineScene()
        .then(load)
        // Things we do after Tangram is finished initializing
        .then(() => {
            // Highlight lines if requested by the query string.
            const query = getQueryStringObject();
            if (query.lines) {
                highlightRanges(query.lines);
            }

            // Turn on highlighting module
            initHighlight();

            // Initialize addons after Tangram is done, because
            // some addons depend on Tangram scene config being present
            // TODO: Verify if this is still true?
            if (window.isEmbedded === undefined) {
                // Add widgets marks and errors manager.
                initWidgetMarks();
                initErrorsManager();

                initSuggestions();
                initGlslPickers();
            }

            // Need to send a signal to the dropdown widgets of type source to populate
            EventEmitter.dispatch('tangram:sceneinit', {});
        });

    // If the user bails for whatever reason, hastily shove the contents of
    // the editor into some kind of storage. This overwrites whatever was
    // there before. Note that there is not really a way of handling unload
    // with our own UI and logic, since this allows for widespread abuse
    // of normal browser functionality.
    window.addEventListener('beforeunload', () => {
        // TODO:
        // Don't take original url or original base path from
        // Tangram (it may be wrong). Instead, remember this
        // in a "session" variable
        /* eslint-disable camelcase */
        const doc = editor.getDoc();
        const sceneData = {
            original_url: tangramLayer.scene.config_source,
            original_base_path: tangramLayer.scene.config_path,
            contents: getEditorContent(),
            is_clean: doc.isClean(),
            scrollInfo: editor.getScrollInfo(),
            cursor: doc.getCursor(),
        };
        /* eslint-enable camelcase */

        // Expects an object of format:
        // {
        //     original_url: 'http://valid.url/path/scene.yaml',
        //     original_base_path: 'http://valid.url/path/',
        //     contents: 'Contents of scene.yaml',
        //     is_clean: boolean value; false indicates original contents
        //               were modified without saving
        //     scrollInfo: editor's scroll position
        //     cursor: where the cursor was positioned in the document.
        // }

        if (window.isEmbedded === undefined) {
            localforage.setItem(STORAGE_LAST_EDITOR_CONTENT, sceneData);
        }
    });
}

// This function is only used by the embedded version of Tangram Play.
// We need it in order to refresh the original scene file if user makes any changes in the editor
export function reloadOriginalScene() {
    setSceneContentsInEditor(initialScene);
}
