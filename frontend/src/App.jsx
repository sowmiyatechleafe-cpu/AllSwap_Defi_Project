import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import PriceTicker from "./components/PriceTicker.jsx";
import Swap from "./pages/Swap.jsx";
import Tokens from "./pages/Tokens.jsx";
import { WalletProvider } from "./context/WalletContext.jsx";
import { PriceProvider } from "./context/PriceContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <PriceProvider>
          <BrowserRouter>
            <div className="app">
              <Navbar />
              <PriceTicker />

              <Routes>
                <Route path="/" element={<Navigate to="/swap" replace />} />
                <Route path="/swap" element={<Swap />} />
                <Route path="/tokens" element={<Tokens />} />
              </Routes>
            </div>
          </BrowserRouter>
        </PriceProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;
