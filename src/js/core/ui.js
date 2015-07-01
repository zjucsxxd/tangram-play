'use strict';

var Utils = require('./common.js');
var Editor = require('./editor.js');
var Widgets = require('../addons/widgets.js');

// Import Greensock (GSAP)
require('gsap/src/uncompressed/Tweenlite.js');
require('gsap/src/uncompressed/plugins/CSSPlugin.js');
const Draggable = require('gsap/src/uncompressed/utils/Draggable.js');

const CM_MINIMUM_WIDTH = 160; // integer, in pixels
const LOCAL_STORAGE_PREFIX = 'tangram-play-';

let draggable;

module.exports = {
    reflowUI,
    updateUI,
    loadFromQueryString,
    init
}

function init (cm, tangram) {
    var transformStyle = 'translate3d(' + getDividerStartingPosition() + 'px, 0px, 0px)';
    var dividerEl = document.getElementById('divider');
    if (dividerEl.style.hasOwnProperty('transform')) {
        dividerEl.style.transform = transformStyle;
    } else if (dividerEl.style.hasOwnProperty('webkitTransform')) {
        // For Safari
        dividerEl.style.webkitTransform = transformStyle;
    } else {
        // For Firefox
        dividerEl.style.transform = transformStyle;
    }

    var count = 0;
    draggable = Draggable.create("#divider", {
        type: "x",
        bounds: getDraggableBounds(),
        cursor: 'col-resize',
        onDrag: function () {
            reflowUI(cm);
            Widgets.update(cm);
            //setWidgetPositions(cm);
        },
        onDragEnd: function () {
            updateUI(cm, tangram);
            saveDividerPosition();
        }
    });

    loadExamples("data/examples.json");
    // window.addEventListener('resize', onWindowResize);
    reflowUI(cm);

    document.getElementById('menu-button-open').addEventListener('click', function (e) {
        var menuEl = document.getElementById('menu-open')
        var posX = document.getElementById('menu-button-open').getBoundingClientRect().left
        menuEl.style.left = posX + 'px'
        menuEl.style.display = (menuEl.style.display === 'block') ? 'none' : 'block'
        document.body.addEventListener('click', onClickOutsideDropdown, false)
    }, false)

    document.getElementById('menu-button-new').addEventListener('click', onClickNewButton, false)
    document.getElementById('menu-button-export').addEventListener('click', saveContent, false);
    document.getElementById('menu-open-file').addEventListener('click', onClickOpenFile, false)
    document.getElementById('menu-open-example').addEventListener('click', onClickOpenExample, false)
    document.getElementById('example-cancel').addEventListener('click', hideExamplesModal, false)
    document.getElementById('example-confirm').addEventListener('click', onClickOpenExampleFromDialog, false)
    document.body.addEventListener('keyup', function (e) {
        // esc key
        if (e.keyCode === 27) {
            // TODO. Implement after UI elements handle / remember state better
        }
    })
    setupFileSelector();

    // Set up drag/drop file listeners
    document.body.addEventListener('dragenter', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        showFileDropArea();
    }, true)
    document.getElementById('file-drop').addEventListener('dragover', function (e) {
        e.preventDefault();
        showFileDropArea();
    }, false)
    document.getElementById('file-drop').addEventListener('dragleave', function (e) {
        e.preventDefault();
        hideFileDropArea();
    }, true)
    document.getElementById('file-drop').addEventListener('drop', onDropFile, false)

    window.onpopstate = function (e) {
        if (e.state && e.state.loadStyleURL) {
            loadFromQueryString();
        }
    }
};

function setupFileSelector () {
    var fileSelector = document.createElement('input');
    fileSelector.setAttribute('type', 'file');
    fileSelector.setAttribute('accept', 'text/x-yaml');
    fileSelector.style.display = 'none';
    fileSelector.id = 'file-selector';
    fileSelector.addEventListener('change', onFileSelectorChange);
    document.body.appendChild(fileSelector);
}

function getDividerStartingPosition () {
    var storedPosition = window.localStorage.getItem(LOCAL_STORAGE_PREFIX + 'divider-position-x')
    if (storedPosition) {
        return storedPosition
    }

    if (window.innerWidth > 1024) {
        return Math.floor(window.innerWidth * 0.6)
    } else {
        return Math.floor(window.innerWidth / 2)
    }
}

function saveDividerPosition () {
    var posX = document.getElementById('divider').getBoundingClientRect().left
    if (posX) {
        window.localStorage.setItem(LOCAL_STORAGE_PREFIX + 'divider-position-x', posX)
    }
}

function onClickNewButton (event) {
    if (isEditorSaved() === false) {
        showUnsavedModal(handleContinue, handleCancel)
    } else {
        handleContinue()
    }

    function handleContinue () {
        newContent();
    }

    function handleCancel () {
        return;
    }
}

function newContent () {
    window.location.href = ".";
}

function loadExamples (configFile) {
    var examples_data = JSON.parse(Utils.fetchHTTP(configFile));
    var examplesList = document.getElementById("examples");

    for (var i = 0; i < examples_data['examples'].length; i++) {
        var example = examples_data['examples'][i];
        var newOption = document.createElement('div');
        var nameEl = document.createElement('div');
        var name = example['name'].split('.')[0];
        var thumbnailEl = document.createElement('div');
        //var imgEl = document.createElement('img');
        newOption.className = 'example-option';
        newOption.setAttribute('data-value', example['url']);
        nameEl.className = 'example-option-name';
        nameEl.textContent = name.replace(/-/g, ' ');
        //imgEl.src = 'data/imgs/' + name + '.png';
        thumbnailEl.className = 'example-thumbnail';
        thumbnailEl.style.backgroundColor = 'rgba(255,255,255,0.05)';
        thumbnailEl.style.backgroundImage = 'url(https://cdn.rawgit.com/tangrams/tangram-sandbox/gh-pages/styles/' + name + '.png)';
        newOption.appendChild(nameEl);
        newOption.appendChild(thumbnailEl);
        //newOption.appendChild(imgEl);
        newOption.addEventListener('click', selectExample);
        examplesList.appendChild(newOption);
    }
}

function selectExample(event) {
    var target = event.target;
    while (!target.classList.contains('example-option')) {
        target = target.parentNode;
    }
    resetExamples();
    target.classList.add('example-selected');
    document.getElementById('example-confirm').disabled = false;
}

function resetExamples () {
    var all = document.querySelectorAll('.example-option');
    for (var i = 0, j = all.length; i < j; i++) {
        all[i].classList.remove('example-selected');
    }
}

function openExample (value) {
    window.history.pushState({
        loadStyleURL: value
    }, null, '.?style=' + value + window.location.hash);
    loadFromQueryString();
}

function parseQuery(qstr) {
    var query = {};
    var a = qstr.split('&');
    for (var i in a) {
        var b = a[i].split('=');
        query[decodeURIComponent(b[0])] = decodeURIComponent(b[1]);
    }
    return query;
};

function loadFromQueryString () {
    let query = parseQuery(window.location.search.slice(1));
    let source = query['style'] ? query['style'] : "data/styles/basic.yaml";
    Editor.loadStyle(editor,Utils.fetchHTTP(source));
}

function onFileSelectorChange (event) {
    var files = event.target.files;
    openContent(files[0]);
}

function openContent (content) {
    var reader = new FileReader();
    reader.onload = function(e) {
        Editor.loadStyle(editor, e.target.result);
    }
    reader.readAsText(content);
}

function saveContent () {
    if (editor) {
        var blob = new Blob([ Editor.getContent(editor)], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "style.yaml");
        editor.isSaved = true;
    }
}

function isEditorSaved () {
    if (editor) {
        return editor.isSaved;
    } else {
        return false;
    }
}

// function onWindowResize (event) {
//     reflowUI(editor);
//     applyNewDraggableBounds(draggable[0]);
//     updateUI(editor, map);
// }

function reflowUI( cm ) {
    var mapEl = document.getElementById('map');
    var contentEl = document.getElementById('content');
    var dividerEl = document.getElementById('divider');
    var menuEl = document.getElementById('menu-container');
    var menuBottom = menuEl.getBoundingClientRect().bottom;
    var positionX = dividerEl.getBoundingClientRect().left;

    mapEl.style.width = positionX + "px";
    contentEl.style.width = (window.innerWidth - positionX) + "px";

    cm.setSize('100%', (window.innerHeight - menuBottom) + 'px');
    dividerEl.style.height = (window.innerHeight - menuBottom) + 'px';
}

function updateUI (cm, map) {
    map.invalidateSize(false);
    Widgets.update(cm);
    applyNewDraggableBounds(draggable[0]);
}

function applyNewDraggableBounds (draggable) {
    draggable.applyBounds(getDraggableBounds())
}

function getDraggableBounds () {
    return {
        minX: 100,
        maxX: window.innerWidth - CM_MINIMUM_WIDTH
    }
}

function takeScreenshot() {
    if (take_screenshot == false){
        take_screenshot = true;
        scene.requestRedraw();
    }
}

function showShield () {
    document.getElementById('shield').style.display = 'block'
}

function hideShield () {
    document.getElementById('shield').style.display = 'none'
}

function showUnsavedModal (confirmCallback, cancelCallback) {
    showShield()
    var modalEl = document.getElementById('confirm-unsaved')
    modalEl.style.display = 'block'
    modalEl.querySelector('#modal-confirm').addEventListener('click', handleConfirm, false)
    modalEl.querySelector('#modal-cancel').addEventListener('click', handleCancel, false)

    function handleConfirm () {
        hideUnsavedModal()
        confirmCallback()
    }

    function handleCancel () {
        hideUnsavedModal()
        cancelCallback()
    }

    function hideUnsavedModal () {
        hideShield();
        document.getElementById('confirm-unsaved').style.display = 'none'
        modalEl.querySelector('#modal-confirm').removeEventListener('click', handleConfirm, false)
        modalEl.querySelector('#modal-cancel').removeEventListener('click', handleCancel, false)
    }
}

function hideMenus () {
    var els = document.querySelectorAll('.menu-dropdown');
    for (var i = 0, j = els.length; i < j; i++) {
        els[i].style.display = 'none';
    }
    document.body.removeEventListener('click', onClickOutsideDropdown, false);
}

function loseMenuFocus () {
    hideMenus();
}

function onClickOutsideDropdown (event) {
    let target = event.target;

    while (target !== document.documentElement && !target.classList.contains('menu-item')) {
        target = target.parentNode;
    }

    if (!target.classList.contains('menu-item')) {
        loseMenuFocus();
        document.body.removeEventListener('click', onClickOutsideDropdown, false);
    }
}

function onClickOpenFile (event) {
    if (isEditorSaved() === false) {
        showUnsavedModal(handleContinue, handleCancel);
    } else {
        handleContinue();
    }

    function handleContinue () {
        var input = document.getElementById('file-selector');
        input.click();
    }

    function handleCancel () {
        return;
    }
}

function onClickOpenExample (event) {
    if (isEditorSaved() === false) {
        showUnsavedModal(handleContinue, handleCancel);
    } else {
        handleContinue();
    }

    function handleContinue () {
        showExamplesModal();
    }

    function handleCancel () {
        return;
    }
}

function showExamplesModal () {
    showShield();
    document.getElementById('choose-example').style.display = 'block';
}

function hideExamplesModal () {
    hideShield();
    resetExamples();
    document.getElementById('example-confirm').disabled = true;
    document.getElementById('choose-example').style.display = 'none';
}

function onClickOpenExampleFromDialog () {
    var selected = document.querySelectorAll('.example-option.example-selected')[0];
    var value = selected.getAttribute('data-value');
    hideExamplesModal();
    openExample(value);
}

function showFileDropArea () {
    document.getElementById('file-drop').style.display = 'block';
}

function hideFileDropArea () {
    document.getElementById('file-drop').style.display = 'none';
}

function onDropFile (event) {
    event.preventDefault();
    hideFileDropArea();
    var dataTransfer = event.dataTransfer;
    if (dataTransfer.files.length > 0) {
        var file = dataTransfer.files[0];
        if (isEditorSaved() === false) {
            showUnsavedModal(handleContinue, handleCancel);
        } else {
            handleContinue();
        }
    }

    function handleContinue () {
        openContent(file);
    }

    function handleCancel () {
        return;
    }
}
