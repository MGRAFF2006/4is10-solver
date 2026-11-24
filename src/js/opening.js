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
