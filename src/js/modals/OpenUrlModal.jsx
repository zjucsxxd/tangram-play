import React from 'react';
import ReactDOM from 'react-dom';
import Button from 'react-bootstrap/lib/Button';
import Modal from './Modal';
import Icon from '../components/Icon';
import LoadingSpinner from './LoadingSpinner';

import { load } from '../tangram-play';

export default class OpenUrlModal extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            thinking: false,
            validInput: false,
        };

        this.onClickConfirm = this.onClickConfirm.bind(this);
        this.onClickCancel = this.onClickCancel.bind(this);
        this.onKeyUpInput = this.onKeyUpInput.bind(this);
    }

    componentDidMount() {
        // Set initial input value and focus
        // This allows modal to be opened with a prepopulated value
        this.input.value = this.props.inputValue;
        this.input.focus();
    }

    onClickConfirm() {
        // Waiting state
        this.setState({
            thinking: true,
        });

        function errorHandler(error) {
            console.log(error);
            ReactDOM.render(<OpenUrlModal inputValue={error.url} />, document.getElementById('modal-container'));
        }

        const url = this.input.value.trim();

        load({ url }, errorHandler)
            .then(() => {
                // If nothing has gotten rid of this modal yet, get rid of it
                if (this.component) {
                    this.component.unmount();
                }
            });
    }

    onClickCancel(event) {
        this.component.unmount();
    }

    onKeyUpInput(event) {
        // We no longer check for valid URL signatures.
        // It is easier to attempt to fetch an input URL and see what happens.
        if (this.input.value) {
            this.setState({ validInput: true });

            const key = event.keyCode || event.which;
            if (key === 13) {
                this.onClickConfirm();
            }
        } else {
            this.setState({ validInput: false });
        }
    }

    render() {
        return (
            <Modal
                className="modal-alt open-url-modal"
                disableEsc={this.state.thinking}
                ref={(ref) => { this.component = ref; }}
                cancelFunction={this.onClickCancel}
            >
                <h4>Open a scene file from URL</h4>

                <div className="modal-content open-url-input">
                    <input
                        type="text"
                        id="open-url-input"
                        placeholder="https://"
                        spellCheck="false"
                        ref={(ref) => { this.input = ref; }}
                        onKeyUp={this.onKeyUpInput}
                    />
                </div>

                <div className="modal-buttons">
                    <LoadingSpinner on={this.state.thinking} />
                    <Button
                        className="modal-cancel"
                        disabled={this.state.thinking}
                        onClick={this.onClickCancel}
                    >
                        <Icon type="bt-times" /> Cancel
                    </Button>
                    <Button
                        className="modal-confirm"
                        disabled={!this.state.validInput || this.state.thinking}
                        onClick={this.onClickConfirm}
                    >
                        <Icon type="bt-check" /> Open
                    </Button>
                </div>
            </Modal>
        );
    }
}

OpenUrlModal.propTypes = {
    inputValue: React.PropTypes.string,
}

OpenUrlModal.defaultProps = {
    inputValue: '',
}
