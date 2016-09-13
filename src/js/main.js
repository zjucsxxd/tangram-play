// Polyfills
import 'babel-polyfill';
import 'whatwg-fetch';

// React
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

// Libraries
import Raven from 'raven-js';
import localforage from 'localforage';

// Components
import App from './components/App';

// Redux
import appReducers from './store/reducers';

// Miscellaneous
import { migrateLocalStorageToForage } from './storage/migrate';

// Error tracking
// Load this before all other modules. Only load when run in production.
// Requires `loose-envify` package in build process to set the correct `NODE_ENV`.
if (process.env.NODE_ENV === 'production') {
    Raven.config('https://728949999d2a438ab006fed5829fb9c5@app.getsentry.com/78467', {
        whitelistUrls: [/mapzen\.com/, /www\.mapzen\.com/],
        environment: process.env.NODE_ENV,
    }).install();
}

// Set and persist localForage options. This must be called before any other
// calls to localForage are made, but can be called after localForage is loaded.
localforage.config({
    name: 'Tangram Play',
    storeName: 'tangram_play',
});

// Convert all current localStorage items to localforage
// We want to do this very early on, because other scripts may need to read
// in the expected format / location in localforage
// TODO: Remove when migration is deemed unnecessary
migrateLocalStorageToForage();

// Initiate Redux store
const store = createStore(appReducers);

// Mount React components
ReactDOM.render(
    <Provider store={store}>
        <App />
    </Provider>,
    document.getElementById('tangram-play-app')
);
