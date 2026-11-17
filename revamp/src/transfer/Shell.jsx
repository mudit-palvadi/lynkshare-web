export function Shell({ eyebrow, title, children }) {
  return (
    <main className="shell">
      <header className="masthead">
        <a className="wordmark" href="/">
          LynkShare
        </a>
      </header>
      <section className="panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
