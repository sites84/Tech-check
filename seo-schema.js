/* Tech Check — structured data additions: WebSite, Organization, BreadcrumbList, FAQPage */
(function () {
  const SITE = 'https://sites84.github.io/Tech-check/';
  const BRAND = 'Tech Check';

  function addSchema(data) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  const path = window.location.pathname;
  const isHome = /\/Tech-check\/?$/.test(path);

  if (isHome) {
    addSchema({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: BRAND,
      url: SITE,
      description: 'Tecnologia, entretenimento e tudo o que está movimentando o mundo digital.'
    });
    addSchema({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: BRAND,
      url: SITE,
      logo: SITE + 'favicon.png'
    });
  }

  // Breadcrumbs: use the existing visible category/title information when available.
  const crumbs = [{ '@type': 'ListItem', position: 1, name: BRAND, item: SITE }];
  const category = document.querySelector('[data-category], .article-category, .category-label');
  const title = document.querySelector('h1');
  if (category && category.textContent.trim()) {
    const name = category.textContent.trim();
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name });
  }
  if (title && title.textContent.trim() && !isHome) {
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: title.textContent.trim(), item: window.location.href });
  }
  if (crumbs.length > 1) {
    addSchema({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs });
  }

  // FAQPage is generated only when the page actually contains an FAQ section.
  const faqItems = [];
  document.querySelectorAll('[data-faq-question]').forEach(q => {
    const answer = q.parentElement && q.parentElement.querySelector('[data-faq-answer]');
    if (answer && q.textContent.trim() && answer.textContent.trim()) {
      faqItems.push({
        '@type': 'Question',
        name: q.textContent.trim(),
        acceptedAnswer: { '@type': 'Answer', text: answer.textContent.trim() }
      });
    }
  });
  if (faqItems.length) {
    addSchema({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems });
  }
})();
