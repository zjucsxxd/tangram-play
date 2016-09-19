import React from 'react';
import DocsPanel from './DocsPanel';
import { initEditor } from '../editor/editor';
import Divider from './Divider';

// DocsPanel is only displayed if user is Mapzen admin
import { requestUserSignInState } from '../user/sign-in';
import EventEmitter from './event-emitter';

export default class Editor extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            mapzenAdmin: false,
        };

        this.getUserData = this.getUserData.bind(this);
    }

    componentDidMount() {
        // instantiate CodeMirror with the editor container element's
        // DOM node reference
        initEditor(this.editorEl);

        EventEmitter.subscribe('mapzen:sign_in', this.getUserData);
        EventEmitter.subscribe('mapzen:sign_out', () => {
            this.setState({ mapzenAccount: false });
        });
    }

    getUserData() {
        requestUserSignInState().then(data => {
            // Note: currently this is only enabled for admin accounts.
            if (data && data.admin === true) {
                this.setState({ mapzenAdmin: true });
            }
        });
    }

    render() {
        return (
            /* id='content' is used only as a hook for Divider right now */
            <div className="editor-container" id="content">
                <Divider />
                <div className="editor" id="editor" ref={(ref) => { this.editorEl = ref; }} />

                {(() => {
                    if (this.state.mapzenAdmin === true) {
                        return (
                            <DocsPanel ref={(ref) => { ref.init(); }} />
                        );
                    }
                    return null;
                })()}
            </div>
        );
    }
}
