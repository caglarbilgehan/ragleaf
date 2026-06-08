"use client";

import React, { useEffect } from 'react';
import { getApiBaseUrl } from '../utils/api';

export default function RagleafAssistant() {
  useEffect(() => {
    // Build unique script selector to avoid duplicate loading
    const selector = 'script[data-agent-id="ag_ragleaf_system01"]:not([data-container-id])';

    if (document.querySelector(selector)) return;

    const apiBase = getApiBaseUrl();

    const script = document.createElement('script');
    script.src = `${apiBase}/widget.js`;
    script.setAttribute('data-agent-id', 'ag_ragleaf_system01');
    script.setAttribute('data-api-key', 'ak_0001bf4f0faa39f6fb0c7429cbc8b301bdf23fdd8874fc90');
    script.setAttribute('data-api-url', apiBase);
    script.setAttribute('data-widget-id', 'wdg_54z3qukuz');
    script.setAttribute('data-primary-color', '#22c55e');
    script.setAttribute('data-title', 'Ragleaf Asistanı');
    script.setAttribute('data-auto-theme', 'true');
    
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      // Clean up widget DOM nodes
      const widgetHost = document.getElementById('ragleaf-widget-host');
      if (widgetHost) widgetHost.remove();
    };
  }, []);

  return null;
}
