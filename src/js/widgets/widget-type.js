import ColorButton from './color-button';
import ToggleButton from './toggle-button';
import DropDownMenu from './drop-down-menu';
import VectorButton from './vector-button';
import YamlButton from './yaml-button';

export default class WidgetType {
    constructor (datum) {
        const matchTypes = [
            'value',
            'key',
            'address',
        ];

        this.matchList = [];

        for (const key of matchTypes) {
            if (datum[key]) {
                this.matchList.push( { against: key, pattern: datum[key] } );
            }
        }

        this.type = datum.type;
        this.options = datum.options || [];
        this.source = datum.source || null;
    }

    match (keyPair) {
        let test = false;
        for (let matchPair of this.matchList) {
            if (!RegExp(matchPair.pattern).test(keyPair[matchPair.against])) {
                return false;
            }
            else {
                test = true;
            }
        }
        return test;
    }

    create (keyPair) {
        let widgetObj;

        switch (this.type) {
            case 'color':
                widgetObj = new ColorButton(this, keyPair);
                break;
            case 'boolean':
                widgetObj = new ToggleButton(this, keyPair);
                break;
            case 'string':
                widgetObj = new DropDownMenu(this, keyPair);
                break;
            case 'vector':
                widgetObj = new VectorButton(this, keyPair);
                break;
            case 'yaml':
                widgetObj = new YamlButton(this, keyPair);
                console.log('IMPORT',widgetObj)
                break;
            default:
                // Nothing
                break;
        }

        return widgetObj;
    }
}
