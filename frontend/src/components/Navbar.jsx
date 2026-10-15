import { NavLink } from "react-router-dom";
import ConnectWallet from "./ConnectWallet";
import ThemeToggle from "./ThemeToggle";
import { useTheme } from "../context/ThemeContext.jsx";

const Navbar = () => {
  const { theme } = useTheme();

  return (
    <nav className="navbar">
      {/* Logo */}
      <div className="navbar-left">
        <NavLink to="/swap" className="logo" aria-label="AllSwap home">
          <img
            className="logo-full"
            src={theme === "dark" ? "/logo-dark.png" : "/logo.png"}
            alt="AllSwap"
          />
          <img
            className="logo-mark"
            src="/logo-icon.png"
            alt="AllSwap"
          />
        </NavLink>
      </div>

      {/* Navigation */}
      <div className="nav-links">
        <NavLink
          to="/swap"
          className={({ isActive }) =>
            `nav-link ${isActive ? "active" : ""}`
          }
        >
          Swap
        </NavLink>

        <NavLink
          to="/tokens"
          className={({ isActive }) =>
            `nav-link ${isActive ? "active" : ""}`
          }
        >
          Tokens
        </NavLink>
      </div>

      {/* Theme + Wallet */}
      <div className="navbar-right">
        <ThemeToggle />
        <ConnectWallet />
      </div>
    </nav>
  );
};

export default Navbar;
