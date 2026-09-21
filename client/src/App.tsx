import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlayerProvider } from './player/PlayerContext';
import { LandingPage } from './pages/LandingPage';
import { PlayPage } from './pages/PlayPage';

/**
 * Three addresses. Nothing is gated any more: a visitor can play, and can see
 * the boards, without ever entering a nickname.
 */
export function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/play" element={<PlayPage />} />
          {/* the old front door, kept so printed and shared links still work */}
          <Route path="/enter" element={<Navigate to="/" replace />} />
        </Routes>
      </PlayerProvider>
    </BrowserRouter>
  );
}
