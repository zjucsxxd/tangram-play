import Widget from './widget.js';

export default class YamlButton extends Widget {
    createEl (key) {
        const id = 'yaml-' + key.address;
        const el = document.createElement('div');
        el.className = 'widget widget-yaml';
        el.innerhtml = '...';

        el.addEventListener('click', (event) => {
            console.log('HIT');
        });

        const labelEl = document.createElement('div');
        labelEl.htmlFor = id;
        labelEl.innerhtml = '<p>...</p>';

        el.appendChild(labelEl);

        return el;
    }
}
