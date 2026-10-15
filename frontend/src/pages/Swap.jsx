import SwapCard from "../components/SwapCard";

const Swap = () => {
  return (
    <main className="swap-page">

      <div className="hero-section">

        <h1>Swap Tokens</h1>

        <p>
          Fast, simple and secure token swapping
          with AllSwap.
        </p>

      </div>

      <SwapCard />

      <div className="swap-note">

        <span>🔒</span>

        <span>
          Your assets remain in your wallet until
          you confirm a transaction.
        </span>

      </div>

    </main>
  );
};

export default Swap;