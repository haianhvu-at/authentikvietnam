/* Authentik Vietnam · éléments communs (menu mobile, bouton haut de page, année)
   Fichier partagé : /assets/site/site.js — sans JS, les liens restent utilisables. */
(function () {
  "use strict";
  var doc = document;

  /* ---------- menu mobile ---------- */
  var burger = doc.querySelector(".av-burger");
  var menu = doc.getElementById("av-mobile");
  function setOpen(open) {
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    menu.hidden = !open;
  }
  if (burger && menu) {
    burger.addEventListener("click", function () {
      setOpen(burger.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
    window.addEventListener("resize", function () { if (window.innerWidth > 760) setOpen(false); });
  }

  /* ---------- bouton « haut de page » ---------- */
  var topBtn = doc.querySelector(".av-fab--top");
  if (topBtn) {
    var onScroll = function () { topBtn.classList.toggle("is-hidden", window.scrollY < 600); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    topBtn.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- année du copyright ---------- */
  var year = doc.querySelector(".av-year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- compteur de vues (pied de page) ----------
     Un seul compteur pour tout le site (toutes pages confondues), service gratuit hitscounter.dev :
     +1 à chaque page affichée. Si le service ne répond pas, le compteur reste masqué.
     Les statistiques détaillées restent dans Google Analytics 4. */
  var views = doc.querySelector(".av-views");
  if (views && window.fetch && /authentik-vietnam\.web\.app$/.test(location.hostname)) {
    fetch("https://hitscounter.dev/api/hit?url=" + encodeURIComponent("https://authentik-vietnam.web.app") + "&output=json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var n = d && Number(d.total_hits);
        if (!n) return;
        views.querySelector(".av-views__n").textContent = n.toLocaleString("fr-FR");
        views.hidden = false;
      })
      .catch(function () {});
  }
})();
