/**
 * Make a floating panel for Tangram errors. Not all errors have line numbers.
 * This just creates a panel to display all of them.
 */
import React from 'react';
import FloatingPanel from './FloatingPanel';

export default class ErrorsPanel extends React.Component {
    constructor(props) {
        super(props);

        this.width = 300;
        this.height = 300;
        this.show = true;
    }

    render() {
        const errorStyles = {
            position: 'relative',
            width: '300px',
            height: '100px',
            overflow: 'auto',
        };

        return (
            <FloatingPanel
                x={this.props.x}
                y={this.props.y}
                width={this.width}
                height={this.height}
                show={this.show}
                onClickClose={() => { this.show = !this.show }}
            >
                <div style={errorStyles}>
                    {this.props.errors.map((error, index) => {
                        let iconTypeClass;
                        if (error.type === 'error') {
                            iconTypeClass = 'btm bt-exclamation-triangle error-icon';
                        } else if (error.type === 'warning') {
                            iconTypeClass = 'btm bt-exclamation-circle warning-icon';
                        }

                        let displayText = error.message;
                        if (!displayText || displayText.length === 0) {
                            displayText = `Unspecified ${error.type}.`;
                        }

                        return (
                            <div className={error.type} key={index}>
                                <span className={iconTypeClass}>{displayText}</span>
                            </div>
                        );
                    })}
                </div>
            </FloatingPanel>
        );
    }
}

ErrorsPanel.propTypes = {
    x: React.PropTypes.number,
    y: React.PropTypes.number,
    errors: React.PropTypes.array,
};
