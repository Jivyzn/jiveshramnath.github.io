# Jivesh Ramnath Portfolio

A static, dependency-light portfolio built for GitHub Pages and the custom domain `jiveshramnath.co.za`.

## Pages
- `index.html` — portfolio landing page
- `projects.html` — filterable project archive
- `vireo.html` — JØ7 Vireo case study with an interactive canvas simulation
- `achievements.html` — awards, education and leadership
- `research.html` — research direction and methods

## Local preview

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## Deploy
Replace the corresponding files in the GitHub repository and keep `CNAME` in the repository root.


## Entity and search configuration

The site uses one permanent identity URI across all pages:

`https://jiveshramnath.co.za/#person`

The homepage is marked as a `ProfilePage` whose `mainEntity` is that `Person`. Project, research and achievement pages reference the same ID. The proof page also links to independent sources that name Jivesh Ramnath and JØ7 Vireo.

After deployment:

1. Validate the homepage with Google Rich Results Test and Schema.org Validator.
2. Submit `https://jiveshramnath.co.za/sitemap.xml` in Google Search Console.
3. Request indexing for the homepage, proof page and Vireo page.
4. Keep the same full name, portrait, domain and profile URLs on GitHub and LinkedIn.

Structured data improves disambiguation but does not guarantee a Knowledge Panel.
