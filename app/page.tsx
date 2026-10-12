import Link from "next/link";

const steps = [
  { number: "01", title: "Edit your page", detail: "Start in app/page.tsx and make this space your own." },
  { number: "02", title: "Add your routes", detail: "Create folders in app to grow your site page by page." },
  { number: "03", title: "Ship your idea", detail: "Build on a clean foundation that is already deployed." },
];

export default function Home() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Next.js Starter home">
          <span className="brand-mark">N</span>
          <span>next<span className="brand-muted">/starter</span></span>
        </Link>
        <a className="header-link" href="https://nextjs.org/docs" target="_blank" rel="noopener noreferrer">
          Documentation <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot" /> YOUR NEXT IDEA STARTS HERE</div>
          <h1 id="hero-title">A fresh start for <em>what&apos;s next.</em></h1>
          <p className="hero-description">A clean Next.js template, ready for your content, components, and ideas. Everything you need to start building is in place.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#getting-started">Explore the starter <span aria-hidden="true">↗</span></a>
            <a className="secondary-button" href="https://nextjs.org/learn" target="_blank" rel="noopener noreferrer">Learn Next.js <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-card art-card-back" />
          <div className="art-card art-card-front">
            <span className="art-card-top"><i /><i /><i /></span>
            <span className="art-line art-line-wide" />
            <span className="art-line art-line-medium" />
            <span className="art-grid"><b /><b /><b /></span>
          </div>
          <span className="art-spark art-spark-one">✳</span>
          <span className="art-spark art-spark-two">✳</span>
        </div>
      </section>

      <section className="getting-started" id="getting-started" aria-labelledby="start-title">
        <div className="section-heading">
          <div><p className="section-label">THE STARTING POINT</p><h2 id="start-title">Make it yours.</h2></div>
          <p>Three simple steps from template to something great.</p>
        </div>
        <div className="steps">
          {steps.map((step) => (
            <article className="step" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer"><span>Built with Next.js</span><span>Made to become anything.</span></footer>
    </main>
  );
}
