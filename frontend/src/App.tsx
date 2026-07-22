import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { BetsPage } from "./pages/BetsPage";
import { LoginPage } from "./pages/LoginPage";
import { OddsInputPage } from "./pages/OddsInputPage";
import { PreRaceInfoPage } from "./pages/PreRaceInfoPage";
import { RaceEntriesPage } from "./pages/RaceEntriesPage";
import { RaceFormPage } from "./pages/RaceFormPage";
import { RaceListPage } from "./pages/RaceListPage";
import { ResultsPage } from "./pages/ResultsPage";
import { RulesPage } from "./pages/RulesPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/races" element={<RaceListPage />} />
            <Route path="/races/new" element={<RaceFormPage />} />
            <Route path="/races/:raceId/entries" element={<RaceEntriesPage />} />
            <Route path="/races/:raceId/pre-race" element={<PreRaceInfoPage />} />
            <Route path="/races/:raceId/odds" element={<OddsInputPage />} />
            <Route path="/races/:raceId/bets" element={<BetsPage />} />
            <Route path="/races/:raceId/results" element={<ResultsPage />} />
            <Route path="/rules" element={<RulesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/races" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
