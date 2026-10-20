# Incontournables du Vietnam

Page : https://authentik-vietnam.web.app/incontournables-vietnam/

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page (contenu fixe : top 10, régions, envies, alternatives, itinéraires, FAQ) |
| `assets/css/incontournables.css` | Styles de la page (charger après `/assets/site/site.css`, avant `/assets/site/typo.css`) |
| `assets/js/incontournables.js` | Carte, filtres, onglets des régions, sommaire collant |
| `assets/img/` | Photos de la page (`-480.webp`, `-<largeur>.webp`, `-<largeur>.jpg`) et image de partage |
| `data/places.json` | Lieux de la carte, **créé automatiquement** depuis le Google Sheet : ne pas modifier à la main |
| `data/article-images.json` | Vignettes des articles authentikvietnam.com (cache, automatique) |
| `data/carte-vietnam.json` | Fond de carte (Natural Earth), Hoàng Sa et Trường Sa rattachés au Vietnam |
| `scripts/update-places.mjs` | Lit le Google Sheet publié et met à jour la carte |

## La carte se met à jour toute seule

1. On modifie le Google Sheet (onglet des lieux, mêmes colonnes que le modèle).
2. Chaque jour à 05:37 (heure du Vietnam), l'action GitHub « Carte – incontournables du Vietnam » lit l'onglet publié en CSV,
   écrit `data/places.json` et la liste des lieux dans `index.html`, puis le site est publié à 05:47.
3. Pour publier tout de suite : GitHub › Actions › « Carte – incontournables du Vietnam » › **Run workflow**.

Colonnes utilisées : `id`, `status`, `featured`, `name_fr`, `region`, `province`, `destination`, `lat`, `lng`, `category`, `tags`,
`short_desc_fr`, `image_url`, `article_url`, `tour_url`. La colonne `notes_internal` n'est jamais publiée.

- Lignes affichées : `published` et, pour l'instant, aussi `draft` (variable `PLACES_SHOW_DRAFT` = `0` pour n'afficher que `published`).
- Lignes `archived`, sans coordonnées ou avec des coordonnées hors du Vietnam : ignorées (signalées dans le journal de l'action).
- Photo de la fiche : `image_url` ; sinon la vignette de l'article `article_url`.
- `featured` = TRUE : étoile sur la carte, fiche en tête de liste (« Coup de cœur »).
- Le **top 10** est écrit dans la page (`index.html` et `assets/js/incontournables.js`, tableau `TOP10`), pas dans le Sheet.

Changer d'onglet publié : copier l'adresse CSV (Fichier › Partager › Publier sur le web › onglet › CSV) dans la variable
`PLACES_CSV_URL` (Settings › Secrets and variables › Actions › Variables), ou dans `DEFAULT_CSV` du script.

Test en local : `PLACES_CSV_FILE=chemin/vers/fichier.csv node incontournables-vietnam/scripts/update-places.mjs`

## Hướng dẫn nhanh (tiếng Việt)

- Sửa dữ liệu trong Google Sheet → sáng hôm sau (5:37) bản đồ tự cập nhật. Muốn lên ngay: GitHub › Actions › « Carte – incontournables du Vietnam » › Run workflow.
- Hiện đang hiện cả dòng `draft`. Khi đã kiểm xong dữ liệu, tạo biến `PLACES_SHOW_DRAFT` = `0` để chỉ hiện dòng `published`.
- Top 10 nằm trong code của trang, không lấy từ Sheet.
