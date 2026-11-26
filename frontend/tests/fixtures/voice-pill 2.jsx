// Visual regression fixture: simulated input exercises expansion without microphone permission.
import React from 'react';
import {createRoot} from 'react-dom/client';
import VoicePill from '../../src/components/VoicePill';
import '../../css/style.css';
import '../../css/design.css';
createRoot(document.getElementById('root')).render(<div className="voice-controls">
  <button className="btn round" aria-label="Transcript">T</button>
  <div id="voice-pill-root"><VoicePill size={44} centered pressScale={1} reactive="simulated"
    mode="toggle" accentColor="#f4e5d8" iconColor="#bad7cc" background="#2c5355"
    ariaLabel="Test recording animation" onStart={async()=>true} /></div>
  <button className="btn round" aria-label="Stop">S</button>
</div>);
