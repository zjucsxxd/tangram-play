import CodeMirror from 'codemirror';
import { unfoldAll, foldByLevel } from './codemirror/tools';
import { changeFontSize } from './codemirror/font-size';
import { takeScreenshot } from '../map/screenshot';

/**
 * Creates and exports additional keybinding functionality to CodeMirror.
 *
 * @returns {Object} extraKeysSettings - an object of extra key mappings to
 *              provide to the settings object of CodeMirror.
 */
export function getExtraKeyMap() {
    // Test for whether to use a Ctrl key (Windows) or Cmd key (Mac)
    const isMac = CodeMirror.keyMap.default === CodeMirror.keyMap.macDefault;
    const ctrlKey = isMac ? 'Cmd-' : 'Ctrl-';

    const extraKeysSettings = {
        'Ctrl-Space': 'autocomplete',
        Tab(cm) {
            // If something is selected, particularly for selection of multiple
            // lines, tab inserts additional indentation, rather than replace
            // the selection with a tab character.
            if (cm.somethingSelected()) {
                cm.indentSelection('add');
            } else {
                // Maps the tab key to insert spaces instead of a tab character.
                // https://codemirror.net/doc/manual.html#keymaps
                cm.replaceSelection(Array(cm.getOption('indentUnit') + 1).join(' '));
            }
        },
        'Alt-F': (cm) => {
            cm.foldCode(cm.getCursor(), cm.state.foldGutter.options.rangeFinder);
        },
        'Alt-P': (cm) => {
            takeScreenshot();
        },
        'Ctrl-0': (cm) => {
            unfoldAll(cm);
        },
        'Ctrl-1': (cm) => {
            foldByLevel(cm, 0);
        },
        'Ctrl-2': (cm) => {
            foldByLevel(cm, 1);
        },
        'Ctrl-3': (cm) => {
            foldByLevel(cm, 2);
        },
        'Ctrl-4': (cm) => {
            foldByLevel(cm, 3);
        },
        'Ctrl-5': (cm) => {
            foldByLevel(cm, 4);
        },
        'Ctrl-6': (cm) => {
            foldByLevel(cm, 5);
        },
        'Ctrl-7': (cm) => {
            foldByLevel(cm, 6);
        },
        'Ctrl-8': (cm) => {
            foldByLevel(cm, 7);
        },
    };

    // Set Ctrl- or Cmd- buttons depending on Mac or Windows devices.
    extraKeysSettings[`${ctrlKey}-`] = (cm) => {
        changeFontSize(cm, false);
    };
    // Equal (=) maps to the Plus (+)
    extraKeysSettings[`${ctrlKey}=`] = (cm) => {
        changeFontSize(cm, true);
    };

    return extraKeysSettings;
}
