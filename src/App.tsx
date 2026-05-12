import { useCallback, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuctionProvider } from "./context/AuctionProvider";
import { Layout } from "./components/Layout";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { HomePage } from "./pages/HomePage";
import { LotPage } from "./pages/LotPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { isWelcomeComplete } from "./lib/guest";

export function App() {
  const [welcomeDone, setWelcomeDone] = useState(() => isWelcomeComplete());

  const onWelcomeComplete = useCallback(() => {
    setWelcomeDone(true);
  }, []);

  return (
    <BrowserRouter>
      <AuctionProvider>
        {!welcomeDone ? (
          <WelcomeScreen onComplete={onWelcomeComplete} />
        ) : (
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="lot/:id" element={<LotPage />} />
              <Route path="404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
          </Routes>
        )}
      </AuctionProvider>
    </BrowserRouter>
  );
}
