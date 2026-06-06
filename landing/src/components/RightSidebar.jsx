import React from 'react';
import RagleafAssistant from './RagleafAssistant';

export default function RightSidebar() {
  return (
    <div id="rightSidebar">
      <div className="sidebar-assistant-container" id="desktopAssistantPlaceholder">
        <RagleafAssistant insideSidebar={true} />
      </div>
    </div>
  );
}
