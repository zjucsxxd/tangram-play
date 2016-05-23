import TangramPlay from '../tangram-play';

// Import CodeMirror
import CodeMirror from 'codemirror';

export default class Tabs {
    constructor () {
        this.buffers = {};
        this.tabs = {};
        this.current = 'main';
    }

    new (name, content) {
        if (!this.el) {
            // Create DOM element
            this.el = document.createElement('ul');
            this.el.className = 'tab_panel';

            console.log('New Current in a different tab');
            this.new(this.current, TangramPlay.getContent());
        }

        this.buffers[name] = CodeMirror.Doc(content, 'text/x-yaml-tangram');

        // Create a new tab
        let tab = document.createElement('li');
        tab.setAttribute('class', 'tab');
        tab.textContent = name;
        CodeMirror.on(tab, 'click', () => {
            this.select(name);
        });

        let close = tab.appendChild(document.createElement('a'));
        close.textContent = 'x';
        close.setAttribute('class', 'tab_close');
        CodeMirror.on(close, 'click', () => {
            this.close(name);
        });

        this.el.appendChild(tab);
        this.tabs[name] = tab;

        if (this.el && !this.panel && this.countTabs() > 1) {
            // Create Panel CM element
            this.panel = TangramPlay.editor.addPanel(this.el, { position: 'top' });
        }
    }

    select (name) {
        let buf = this.buffers[name];

        if (buf === undefined) {
            return;
        }

        if (buf.getEditor()) {
            buf = buf.linkedDoc({ sharedHist: true });
        }
        let old = TangramPlay.editor.swapDoc(buf);
        let linked = old.iterLinkedDocs(function(doc) {
            linked = doc;
        });
        if (linked) {
            // Make sure the document in buffers is the one the other view is looking at
            for (let bufferName in this.buffers) {
                if (this.buffers[bufferName] === old) {
                    this.buffers[bufferName] = linked;
                }
            }
            old.unlinkDoc(linked);
        }
        TangramPlay.editor.focus();
        TangramPlay.setContent(TangramPlay.getContent());

        if (this.tabs[this.current]) {
            this.tabs[this.current].setAttribute('class', 'tab');
        }
        this.tabs[name].setAttribute('class', 'tab_active');
        this.current = name;

        TangramPlay.editor.setSize(null, 'auto');
        TangramPlay.editor.getWrapperElement().style.height = 'auto';
    }

    close (name) {
        let needChange = name === this.getCurrent();

        this.el.removeChild(this.tabs[name]);
        delete this.tabs[name];
        delete this.buffers[name];

        if (this.countTabs() === 1) {
            this.panel.clear();
            this.panel = undefined;
            this.el = undefined;
        }

        if (needChange) {
            for (let prop in this.tabs) {
                this.select(prop);
                break;
            }
        }
    }

    getCurrent () {
        return this.current;
    }

    countTabs () {
        return Object.keys(this.buffers).length;
    }
}
