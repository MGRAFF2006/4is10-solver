// Runs before the page body exists. In-page links such as "Skip to solver" replace the
// address fragment, so remember a shared puzzle in case one is followed before index.js starts.
document.documentElement.dataset.openingFragment = location.hash;
