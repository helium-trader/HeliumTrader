"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import styles from "./pricing.module.css";

const plans = [
  {
    name: "Free",
    tagline: "Perfect to get started",
    price: { monthly: 0, yearly: 0 },
    cta: "Get Started",
    ctaHref: "/register",
    highlight: false,
    features: [
      "4 algorithmic strategies",
      "Backtesting simulation",
      "10 simulations per day",
      "Basic performance metrics",
      "Community support",
    ],
    missing: [
      "Live paper trading",
      "AI-powered reports",
      "Unlimited simulations",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    tagline: "For serious traders",
    price: { monthly: 29, yearly: 19 },
    cta: "Start Free Trial",
    ctaHref: "/register",
    highlight: true,
    badge: "Most Popular",
    features: [
      "4 algorithmic strategies",
      "Backtesting simulation",
      "Unlimited simulations",
      "Advanced performance metrics",
      "Live on-chain paper trading",
      "AI-powered reports (daily)",
      "Strategy parameter history",
      "Priority email support",
    ],
    missing: [],
  },
  {
    name: "Institutional",
    tagline: "Built for teams & funds",
    price: { monthly: 99, yearly: 79 },
    cta: "Contact Sales",
    ctaHref: "/login",
    highlight: false,
    features: [
      "Everything in Pro",
      "Multi-wallet support",
      "Custom strategy builder",
      "API access",
      "Team collaboration tools",
      "Dedicated account manager",
      "SLA & uptime guarantee",
      "Custom AI report cadence",
    ],
    missing: [],
  },
];

const faqs = [
  {
    q: "Is there a free trial?",
    a: "Yes — the Pro plan comes with a 14-day free trial. No credit card required. You can explore all features and cancel at any time.",
  },
  {
    q: "Can I cancel or downgrade at any time?",
    a: "Absolutely. You can cancel or change your plan at any time from your account settings. If you cancel, you keep access until the end of your billing period.",
  },
  {
    q: "What is on-chain paper trading?",
    a: "Paper trading on Sui DeepBook lets you execute simulated trades against real-time order book data — without risking real funds. All activity is transparent and verifiable on-chain.",
  },
  {
    q: "How are AI reports generated?",
    a: "Our AI analyzes your strategy performance, win rates, drawdown, and market conditions to produce plain-language summaries with optimization suggestions.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, USDC on Sui, and invoicing for Institutional plans.",
  },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <Navbar />
      <main className={styles.page}>

        {/* Header */}
        <section className={styles.header}>
          <p className={styles.eyebrow}>Pricing</p>
          <h1 className={styles.title}>Simple, transparent pricing</h1>
          <p className={styles.subtitle}>
            Start for free. Upgrade when you need more. No hidden fees.
          </p>

          <div className={styles.toggle}>
            <span className={`${styles.toggleLabel} ${!yearly ? styles.toggleLabelActive : ""}`}>
              Monthly
            </span>
            <button
              className={styles.toggleSwitch}
              onClick={() => setYearly(!yearly)}
              role="switch"
              aria-checked={yearly}
              aria-label="Toggle yearly billing"
            >
              <span
                className={styles.toggleThumb}
                style={{ transform: `translateY(-50%) translateX(${yearly ? "20px" : "2px"})` }}
              />
            </button>
            <span className={`${styles.toggleLabel} ${yearly ? styles.toggleLabelActive : ""}`}>
              Yearly
            </span>
            <span className={styles.saveBadge}>Save up to 34%</span>
          </div>
        </section>

        {/* Plans */}
        <section className={styles.plansGrid}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`${styles.planCard} ${plan.highlight ? styles.planCardHighlight : ""}`}
            >
              {plan.badge && (
                <div className={styles.planBadge}>{plan.badge}</div>
              )}

              <div className={styles.planHeader}>
                <h2 className={styles.planName}>{plan.name}</h2>
                <p className={styles.planTagline}>{plan.tagline}</p>
              </div>

              <div className={styles.planPrice}>
                {plan.price.monthly > 0 && (
                  <span className={styles.priceCurrency}>$</span>
                )}
                <span className={styles.priceAmount}>
                  {plan.price.monthly === 0
                    ? "Free"
                    : yearly
                    ? plan.price.yearly
                    : plan.price.monthly}
                </span>
                {plan.price.monthly > 0 && (
                  <span className={styles.pricePer}>/ mo</span>
                )}
              </div>
              {yearly && plan.price.monthly > 0 && (
                <p className={styles.priceBilled}>
                  Billed annually (${plan.price.yearly * 12}/yr)
                </p>
              )}

              <Link
                href={plan.ctaHref}
                className={`btn ${plan.highlight ? "btn-primary" : "btn-secondary"} ${styles.planCta}`}
              >
                {plan.cta}
              </Link>

              <ul className={styles.featureList}>
                {plan.features.map((f) => (
                  <li key={f} className={styles.featureItem}>
                    <span className={styles.featureCheck} aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
                {plan.missing.map((f) => (
                  <li key={f} className={`${styles.featureItem} ${styles.featureItemMissing}`}>
                    <span className={styles.featureMinus} aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* FAQ */}
        <section className={styles.faqSection}>
          <h2 className={styles.faqTitle}>Frequently asked questions</h2>
          <div className={styles.faqList}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={styles.faqItem}
              >
                <button
                  className={styles.faqQuestion}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  {faq.q}
                  <span
                    className={styles.faqChevron}
                    style={{ transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)" }}
                    aria-hidden="true"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                {openFaq === i && (
                  <p className={styles.faqAnswer}>{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className={styles.bottomCta}>
          <h2 className={styles.bottomCtaTitle}>Still have questions?</h2>
          <p className={styles.bottomCtaText}>
            Reach out and we&apos;ll help you find the right plan.
          </p>
          <Link href="/register" className="btn btn-primary">
            Start for free
          </Link>
        </section>
      </main>
    </>
  );
}
