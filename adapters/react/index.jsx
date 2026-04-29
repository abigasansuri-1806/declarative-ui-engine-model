import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import FormEngine from "./FormEngine";

// ─────────────────────────────────────────────
// index.jsx
// Entry point for the React adapter.
// Responsibilities:
//   - Load aut.json and i18n.json
//   - Show loading/error states
//   - Mount FormEngine once AUT is ready
//   - Apply base CSS styles
// ─────────────────────────────────────────────

// ── APP SHELL ─────────────────────────────────

function App() {
  const [aut,      setAut]      = useState(null);
  const [i18n,     setI18n]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    async function loadAUT() {
      try {
        // Load both AUT and i18n in parallel
        const [autRes, i18nRes] = await Promise.all([
          fetch("/aut.json"),
          fetch("/i18n.json"),
        ]);

        if (!autRes.ok)  throw new Error(`Failed to load AUT: ${autRes.status}`);
        if (!i18nRes.ok) throw new Error(`Failed to load i18n: ${i18nRes.status}`);

        const autData  = await autRes.json();
        const i18nData = await i18nRes.json();

        setAut(autData);
        setI18n(i18nData);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    loadAUT();
  }, []);

  if (loading) {
    return (
      <div className="app-shell app-shell--loading">
        <div className="loading-spinner" />
        <p>Loading form...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell app-shell--error">
        <h2>Failed to load form</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__domain">{aut.domain}</span>
        </div>
        <h1 className="app-header__title">{aut.formId.replace(/-/g, " ")}</h1>
      </header>

      <main className="app-main">
        <FormEngine aut={aut} i18nLayer={i18n} />
      </main>
    </div>
  );
}

// ── MOUNT ─────────────────────────────────────

const container = document.getElementById("root");
const root      = createRoot(container);
root.render(<App />);
