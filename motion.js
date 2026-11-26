// Faz os blocos aparecerem suavemente ao entrar na tela.
// Sem JS ou com "reduzir movimento" ativado, tudo fica visível normalmente.
(function () {
  var root = document.documentElement;
  if (
    !("IntersectionObserver" in window) ||
    (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)
  )
    return;

  root.classList.add("motion-ready");

  var SELECTOR = [
    ".hero-copy > *",
    ".moment-panel",
    ".care-section > .kicker",
    ".care-section > h2",
    ".care-section > p",
    ".patient-invitation > div",
    ".person",
    ".steps__head",
    ".step-card",
    ".why__intro",
    ".why__item",
    ".contact__inner > *",
    ".cta__card",
    ".history__title",
    ".history__text p",
    ".spec-hero > *",
    ".spec-section > h2",
    ".spec-section > p",
    ".spec-list li",
    ".spec-step",
    ".spec-faq__item",
    ".spec-notice > *",
    ".spec-warning > *",
    ".spec-related li",
    ".patient-tile",
    ".pro-panel-card",
    ".admin-card",
    ".settings-card",
    ".auth__card",
  ].join(",");

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        // Também libera o que ficou acima da tela (ex.: abriu num #link mais abaixo).
        var passed = entry.boundingClientRect.bottom < 0;
        if (!entry.isIntersecting && !passed) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );

  function prepare(el) {
    if (el.dataset.reveal) return;
    el.dataset.reveal = "1";
    var siblings = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
    el.style.setProperty("--reveal-delay", Math.min(siblings, 5) * 90 + "ms");
    el.classList.add("reveal");
    observer.observe(el);
  }

  function scan(scope) {
    if (scope.matches && scope.matches(SELECTOR)) prepare(scope);
    if (scope.querySelectorAll) scope.querySelectorAll(SELECTOR).forEach(prepare);
  }

  function start() {
    scan(document.body);
    // Conteúdo criado depois (lista de profissionais, painel do admin...) também aparece suave.
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) scan(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
