import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './client/App';
import '@fontsource-variable/dm-sans';
import './client/styles.css';
import './client/typography.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
