import TokenList from "../components/TokenList";

const Tokens = () => {
  return (
    <main className="tokens-page">
      <section className="tokens-hero">
        <span className="tokens-eyebrow">ALLSWAP MARKETS</span>
        <h1>Tokens</h1>
        <p>
          Track live prices for PILOT and popular tokens, and check the
          balances in your connected wallet.
        </p>
      </section>

      <TokenList />
    </main>
  );
};

export default Tokens;
