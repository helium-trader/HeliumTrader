import Link from "next/link";
import Navbar from "@/components/Navbar";
import HowItWorksJourney from "@/components/HowItWorksJourney";
import styles from "./page.module.css";

const features = [
  {
    title: "Parameter-Tuned Strategies",
    description:
      "Fine-tune SMA Crossover, RSI, Bollinger Bands, and MACD with interactive sliders. Find the optimal configuration for any market condition.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 10h12M4 6h6M4 14h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: "Backtesting Simulation",
    description:
      "Run strategies against historical crypto data. View equity curves, win rates, Sharpe ratios, and max drawdown before risking a single token.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 14l4-4 3 3 4-6 3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: "On-Chain Paper Trading",
    description:
      "Paper trade on Sui&apos;s DeepBook with virtual balances. Test strategies against real-time order book data — transparently on-chain.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: "AI-Powered Reports",
    description:
      "Intelligent analysis of your trading performance. AI identifies patterns, suggests parameter tweaks, and generates daily summary reports.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 7v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: "Decentralized Storage",
    description:
      "Trading reports and strategy configs stored on Walrus — permanent, verifiable, and censorship-resistant. Your data, your control.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3 7l7-4 7 4v6l-7 4-7-4V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: "Democratized Trading",
    description:
      "Institutional-grade algorithmic tools, accessible to everyone. No black boxes, no gatekeeping — just transparent, on-chain strategies.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="7" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="13" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 16c0-2.5 2-4 5-4M13 12c3 0 5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Algorithmic trading,{" "}
              <span className={styles.heroTitleAccent}>democratized.</span>
            </h1>

            <p className={styles.heroDescription}>
              Parameter-tuned strategies, backtesting simulation, on-chain paper
              trading via Sui DeepBook, and AI-powered reports — all transparent
              and free to start.
            </p>

            <div className={styles.heroActions}>
              <Link href="/register" className="btn btn-primary btn-lg">
                Get Started Free
              </Link>
              <Link href="/dashboard" className="btn btn-secondary btn-lg">
                Try Simulation
              </Link>
            </div>

            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>4</span>
                <span className={styles.heroStatLabel}>Strategies</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>0</span>
                <span className={styles.heroStatLabel}>Risk to start</span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>&infin;</span>
                <span className={styles.heroStatLabel}>Configurations</span>
              </div>
            </div>
          </div>

          <div className={styles.heroImageWrap} aria-hidden="true">
            <img
              src="https://images.unsplash.com/photo-1689732888407-310424e3a372?w=900&auto=format&fit=crop&q=80"
              alt="Live trading charts on multiple monitors"
              className={styles.heroImage}
            />
            <div className={styles.heroImageOverlay} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features} id="features">
        <div className="page-container">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>Features</p>
            <h2 className={styles.sectionTitle}>Everything you need to trade smarter</h2>
            <p className={styles.sectionSubtitle}>
              A complete algorithmic trading toolkit built for everyone, from first-time traders to funds.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            {features.map((f, i) => (
              <div className={styles.featureCard} key={i}>
                <div className={styles.featureIconWrap}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDescription}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works — cinematic journey */}
      <section className={styles.learn} id="learn">
        <HowItWorksJourney />
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <h2 className={styles.ctaTitle}>Start trading smarter today.</h2>
        <p className={styles.ctaDescription}>
          No wallet required for simulation. Free forever with no hidden fees.
        </p>
        <div className={styles.ctaActions}>
          <Link href="/register" className="btn btn-primary btn-lg">
            Create Free Account
          </Link>
          <Link href="/pricing" className="btn btn-secondary btn-lg">
            View Pricing
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p className={styles.footerText}>
            &copy; 2026 HeliumTrader. Built on Sui.
          </p>
          <div className={styles.footerLinks}>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
              GitHub
            </a>
            <a href="https://sui.io" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
              Sui Network
            </a>
            <Link href="/pricing" className={styles.footerLink}>Pricing</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
