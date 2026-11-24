// Runs before the page body exists. In-page links such as "Skip to solver" replace the
// address fragment, possibly before index.js has started, so keep the latest shared
// puzzle fragment seen until then. The keys match applyHash() in index.js.
{
  const remember = () => {
    const params = new URLSearchParams(location.hash.slice(1));
    if (["digits", "ops", "parens", "mode"].some(key => params.has(key))) {
      document.documentElement.dataset.puzzleFragment = location.hash;
    }
  };
  remember();
  addEventListener("hashchange", remember);
}

// If the solver script or one of its modules cannot load, the controls stay inert;
// say so instead of "Loading…" forever. Script errors do not bubble, so listen while capturing.
addEventListener("error", event => {
  if (!(event.target instanceof HTMLScriptElement)) return;
  const status = document.querySelector("#result-status");
  if (status) status.textContent = "Couldn’t load";
  const expression = document.querySelector("#expression");
  if (expression) expression.textContent = "The solver didn’t load. Check your connection and reload the page.";
}, true);
