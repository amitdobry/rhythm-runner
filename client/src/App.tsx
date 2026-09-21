import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlayerProvider } from './player/PlayerContext';
import { RequirePlayer } from './player/RequirePlayer';
import { EnterPage } from './pages/EnterPage';
import { HomePage } from './pages/HomePage';

export function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <Routes>
          <Route path="/enter" element={<EnterPage />} />
          <Route
            path="/"
            element={
              <RequirePlayer>
                <HomePage />
              </RequirePlayer>
            }
          />
        </Routes>
      </PlayerProvider>
    </BrowserRouter>
  );
}
