import Link from "next/link";
import Navbar from "@/components/Navbar";
import styles from "./page.module.css";

const features = [
  {
    icon: "⚡",
    title: "Parameter-Tuned Strategies",
    description:
      "Fine-tune SMA Crossover, RSI, Bollinger Bands, and MACD strategies with interactive sliders. Find the perfect configuration for any market condition.",
  },
  {
    icon: "📊",
    title: "Backtesting Simulation",
    description:
      "Run your strategies against historical crypto data. See equity curves, win rates, Sharpe ratios, and maximum drawdown before risking a single token.",
  },
  {
    icon: "🔗",
    title: "On-Chain Paper Trading",
    description:
      "Paper trade on Sui's DeepBook with virtual balances. Test your strategies against real-time order book data — transparently and on-chain.",
  },
  {
    icon: "🤖",
    title: "AI-Powered Reports",
    description:
      "Get intelligent analysis of your trading performance. AI identifies patterns, suggests parameter tweaks, and generates daily summary reports.",
  },
  {
    icon: "💾",
    title: "Decentralized Storage",
    description:
      "Trading reports and strategy configs stored on Walrus — permanent, verifiable, and censorship-resistant. Your data, your control.",
  },
  {
    icon: "🌍",
    title: "Democratized Trading",
    description:
      "Institutional-grade algorithmic trading tools, accessible to everyone. No black boxes, no gatekeeping — just transparent, on-chain strategies.",
  },
];

const steps = [
  {
    title: "Choose Strategy",
    description:
      "Select from pre-built algorithmic strategies like SMA Crossover, RSI, or MACD.",
  },
  {
    title: "Tune Parameters",
    description:
      "Adjust periods, thresholds, stop-loss, and take-profit levels with intuitive controls.",
  },
  {
    title: "Simulate & Test",
    description:
      "Backtest against historical data or paper trade live. See real-time performance metrics.",
  },
  {
    title: "Get AI Insights",
    description:
      "Receive AI-generated reports with performance analysis and optimization suggestions.",
  },
];

export default function Home() {
  return (
    <>
      <Navbar />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <div className={styles.heroGlow} />
          <div className={styles.heroGlowSecondary} />
          <div className={styles.gridOverlay} />
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Built on Sui &middot; Powered by AI
          </div>

          <h1 className={styles.heroTitle}>
            Algorithmic Crypto Trading,{" "}
            <span className={styles.heroTitleAccent}>Democratized.</span>
          </h1>

          <p className={styles.heroDescription}>
            Parameter-tuned trading strategies with backtesting simulation,
            on-chain paper trading via Sui DeepBook, and AI-powered performance
            reports — all transparent, accessible, and free.
          </p>

          <div className={styles.heroActions}>
            <Link href="/dashboard" className="btn btn-primary btn-lg">
              <span>🚀</span> Launch Dashboard
            </Link>
            <Link href="/simulate" className="btn btn-secondary btn-lg">
              <span>📈</span> Try Simulation
            </Link>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={`${styles.heroStatValue} profit`}>4</span>
              <span className={styles.heroStatLabel}>Strategies</span>
            </div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>∞</span>
              <span className={styles.heroStatLabel}>Configurations</span>
            </div>
            <div className={styles.heroStat}>
              <span className={`${styles.heroStatValue} profit`}>0</span>
              <span className={styles.heroStatLabel}>Risk to Start</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features} id="features">
        <div className={styles.featuresDivider} />
        <div className={styles.featuresHeader}>
          <p className={styles.featuresLabel}>Features</p>
          <h2 className={styles.featuresTitle}>
            Everything You Need to Trade Smarter
          </h2>
          <p className={styles.featuresSubtitle}>
            From strategy selection to AI insights — a complete algorithmic
            trading toolkit built for everyone.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((feature, i) => (
            <div className={styles.featureCard} key={i}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDescription}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howItWorks}>
        <div className={styles.featuresHeader}>
          <p className={styles.featuresLabel}>How It Works</p>
          <h2 className={styles.featuresTitle}>
            From Zero to Trading in Minutes
          </h2>
          <p className={styles.featuresSubtitle}>
            No coding required. No complex setups. Just pick, tune, test, and
            learn.
          </p>
        </div>

        <div className={styles.stepsGrid}>
          {steps.map((step, i) => (
            <div className={styles.step} key={i}>
              {i < steps.length - 1 && (
                <div className={styles.stepConnector} />
              )}
              <div className={styles.stepNumber}>{i + 1}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <div className={styles.ctaGlow} />
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            Ready to Trade <span className="gradient-text">Smarter</span>?
          </h2>
          <p className={styles.ctaDescription}>
            Start backtesting strategies for free. No wallet required for
            simulation mode.
          </p>
          <div className={styles.heroActions} style={{ justifyContent: "center" }}>
            <Link href="/simulate" className="btn btn-primary btn-lg">
              Start Simulating Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p className={styles.footerText}>
            © 2026 HeliumTrader. Built on Sui. Powered by AI.
          </p>
          <div className={styles.footerLinks}>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              GitHub
            </a>
            <a
              href="https://sui.io"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              Sui Network
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
