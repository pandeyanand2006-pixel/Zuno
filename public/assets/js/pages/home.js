import { h, skeletonGrid, emptyState, errorState } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

export async function Home() {
  const main = h('div', {});

  // ── HERO CAROUSEL — full-width auto-scaling, absolute overlay (Denim) ──
  const slides = [
    {
      eyebrow: 'ZUNO DENIM — NEW SEASON',
      titleA: 'WEAR YOUR', titleB: 'ATTITUDE.',
      sub: 'Heavyweight cotton, perfect fit — made for everyday confidence.',
      img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1600&h=800&fit=crop',
      ctaPrimary: { label: 'SHOP T-SHIRTS', href: '#/shop' },
      ctaGhost: { label: 'CREATE YOUR T-SHIRT', href: '#/customize' },
    },
    {
      eyebrow: 'THE DENIM WASH EDIT',
      titleA: 'FADED TO', titleB: 'PERFECTION.',
      sub: 'Soft washed indigo, cargo utility and street-ready sneaker drops.',
      img: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1600&h=800&fit=crop',
      ctaPrimary: { label: 'SHOP NEW DROPS', href: '#/shop?sort=newest' },
      ctaGhost: { label: 'VIEW LOOKBOOK', href: '#/shop?collection=Street%20Form' },
    },
    {
      eyebrow: 'ZUNO CUSTOM STUDIO',
      titleA: 'MAKE IT', titleB: 'YOURS.',
      sub: 'Add text, upload artwork — preview live on premium 240 GSM tees.',
      img: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1600&h=800&fit=crop',
      ctaPrimary: { label: 'START DESIGNING', href: '#/customize' },
      ctaGhost: { label: 'EXPLORE SHOP', href: '#/shop?category=oversized' },
    },
  ];

  let current = 0;
  let timer = null;

  const track = h('div', { class: 'hero-carousel__track', style: { transform: 'translateX(0%)' } },
    ...slides.map((s, idx) => h('div', { class: 'hero-carousel__slide', 'aria-hidden': idx === 0 ? 'false' : 'true' },
      h('img', { src: s.img, alt: s.titleA + ' ' + s.titleB, loading: idx === 0 ? 'eager' : 'lazy' }),
      h('div', { class: 'hero-carousel__overlay', 'aria-hidden': 'true' }),
      h('div', { class: 'hero-carousel__content' },
        h('p', { class: 'hero-carousel__eyebrow' }, s.eyebrow),
        h('h1', { class: 'hero-carousel__title' }, s.titleA, h('br'), s.titleB),
        h('p', { class: 'hero-carousel__sub' }, s.sub),
        h('div', { class: 'hero-carousel__cta' },
          h('a', { href: s.ctaPrimary.href, class: 'btn btn-primary btn-lg', style: { background: 'var(--primary-denim)', color: 'var(--pure-white)', borderRadius: '999px', padding: '14px 28px', letterSpacing: '0.04em', fontWeight: '700', transition: 'background 0.2s ease-in', textDecoration: 'none' }, onmouseenter: (e) => e.target.style.background='var(--secondary-wash)', onmouseleave: (e)=> e.target.style.background='var(--primary-denim)' }, s.ctaPrimary.label),
          h('a', { href: s.ctaGhost.href, style: { background: 'transparent', color: 'var(--pure-white)', border: '1px solid rgba(255,255,255,0.8)', padding: '14px 28px', borderRadius: '999px', fontWeight: '700', textDecoration: 'none' } }, s.ctaGhost.label)
        )
      )
    ))
  );

  const dotsWrap = h('div', { class: 'hero-carousel__dots', role: 'tablist', 'aria-label': 'Carousel' },
    ...slides.map((_, i) => h('button', {
      class: i === 0 ? 'hero-carousel__dot hero-carousel__dot--active' : 'hero-carousel__dot hero-carousel__dot--idle',
      'aria-label': 'Go to slide ' + (i + 1),
      'aria-selected': i === 0 ? 'true' : 'false',
      role: 'tab',
      onclick: () => goTo(i)
    }))
  );

  const prevBtn = h('button', { class: 'hero-carousel__arrow hero-carousel__arrow--prev', 'aria-label': 'Previous banner', onclick: () => goTo(current - 1) }, '‹');
  const nextBtn = h('button', { class: 'hero-carousel__arrow hero-carousel__arrow--next', 'aria-label': 'Next banner', onclick: () => goTo(current + 1) }, '›');

  const hero = h('section', { class: 'hero-carousel', 'aria-roledescription': 'carousel', 'aria-label': 'Featured collections' }, track, dotsWrap, prevBtn, nextBtn);

  function update() {
    track.style.transform = 'translateX(-' + (current * 100) + '%)';
    track.querySelectorAll('.hero-carousel__slide').forEach((el, i) => el.setAttribute('aria-hidden', i === current ? 'false' : 'true'));
    dotsWrap.querySelectorAll('button').forEach((d, i) => {
      const active = i === current;
      d.className = active ? 'hero-carousel__dot hero-carousel__dot--active' : 'hero-carousel__dot hero-carousel__dot--idle';
      d.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
  function goTo(idx) {
    current = (idx + slides.length) % slides.length;
    update();
    restart();
  }
  function restart() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => { current = (current + 1) % slides.length; update(); }, 4200);
  }
  hero.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
  hero.addEventListener('mouseleave', restart);
  hero.addEventListener('focusin', () => { if (timer) clearInterval(timer); });
  hero.addEventListener('focusout', restart);
  // Touch swipe
  let sx = 0;
  hero.addEventListener('touchstart', (e) => sx = e.touches[0].clientX, { passive: true });
  hero.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) goTo(current + (dx < 0 ? 1 : -1));
  });
  restart();

  // ── CATEGORY CIRCLES — only real backend categories ──
  const categories = [
    { label: 'Oversized', img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=200&h=200&fit=crop', q: 'oversized' },
    { label: 'Graphic', img: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=200&h=200&fit=crop', q: 'graphic' },
    { label: 'Plain', img: 'https://images.unsplash.com/photo-1618354691321-e851c56960d1?w=200&h=200&fit=crop', q: 'plain' },
    { label: 'Polo', img: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=200&h=200&fit=crop', q: 'polo' },
    { label: 'Premium Cotton', img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&h=200&fit=crop', q: 'premium-cotton' },
    { label: 'Essentials', img: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=200&h=200&fit=crop', q: '', collection: 'Essentials' },
    { label: 'Street Form', img: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=200&h=200&fit=crop', q: '', collection: 'Street Form' },
    { label: 'Custom Studio', img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop', q: '', href: '#/customize' },
  ];
  const catRow = h('div', { class: 'cat-bubbles', 'aria-label': 'Shop by category', onwheel: (e) => { if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) { e.currentTarget.scrollLeft += e.deltaY; e.preventDefault(); } } },
    ...categories.map(c => {
      const href = c.href || (c.collection ? '#/shop?collection=' + encodeURIComponent(c.collection) : c.q ? '#/shop?category=' + encodeURIComponent(c.q) : '#/shop');
      return h('a', { href, class: 'cat-bubble', 'aria-label': c.label },
        h('div', { class: 'cat-bubble__circle', 'aria-hidden': 'true' }, h('img', { src: c.img, alt: c.label, loading: 'lazy' })),
        h('span', { class: 'cat-bubble__label' }, c.label));
    }));

  // ── PRODUCT FEED GRID — 4-col desktop → 2-col mobile (no rigid px) ──
  const feedSection = h('section', { class: 'feed-section' },
    h('div', { class: 'feed-header' },
      h('h2', {}, 'New Drops'),
      h('a', { href: '#/shop?sort=newest', style: { fontSize: '13px', fontWeight: '700', color: 'var(--primary-denim)', textDecoration: 'none' } }, 'View all →')));
  const productGrid = h('div', { class: 'grid grid-products' });
  feedSection.append(productGrid);
  productGrid.append(skeletonGrid(8));

  // ── CUSTOM STUDIO TEASER ──
  const studio = h('section', { style: { background: 'var(--dark-charcoal)', color: 'var(--pure-white)', padding: '48px 20px', margin: '32px 0' } },
    h('div', { style: { maxWidth: '1320px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' } },
      h('div', {},
        h('p', { style: { fontSize: '12px', letterSpacing: '0.16em', opacity: '0.7', fontWeight: '700' } }, 'ZUNO CUSTOM STUDIO'),
        h('h2', { style: { fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: '0.9', marginTop: '8px' } }, 'MAKE IT', h('br'), 'YOURS.'),
        h('p', { style: { opacity: '0.7', marginTop: '12px', maxWidth: '36ch' } }, 'Create a T-shirt that is completely yours. Add text, upload artwork — see it live.'),
        h('a', { href: '#/customize', style: { display: 'inline-block', marginTop: '20px', background: 'var(--pure-white)', color: 'var(--dark-charcoal)', padding: '14px 28px', borderRadius: '999px', fontWeight: '700', textDecoration: 'none', transition: 'background 0.2s ease-in' }, onmouseenter:(e)=>e.target.style.background='var(--light-indigo)', onmouseleave:(e)=>e.target.style.background='var(--pure-white)' }, 'START DESIGNING →')),
      h('div', { style: { display: 'flex', justifyContent: 'center' } },
        h('div', { style: { width: '280px', height: '360px', background: 'var(--pure-white)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--dark-charcoal)' } },
          h('div', { style: { fontSize: '12px', letterSpacing: '0.12em', opacity: '0.5', border: '1px dashed #c9d2e3', padding: '6px 12px', borderRadius: '999px' } }, 'YOUR DESIGN HERE'),
          h('div', { style: { fontSize: '48px', marginTop: '12px' } }, '✦')))));

  // ── TRUST ──
  const trust = h('section', { style: { maxWidth: '1320px', margin: '32px auto', padding: '0 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center', borderTop: '1px solid var(--light-indigo)', borderBottom: '1px solid var(--light-indigo)', paddingTop: '20px', paddingBottom: '20px' } },
    h('div', {}, h('div', { style: { width:'42px', height:'42px', borderRadius:'50%', background:'var(--light-indigo)', display:'grid', placeItems:'center', margin:'0 auto' } }, '✓'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Premium fabric'), h('div', { style: { fontSize: '12px', color: 'var(--ink-500)' } }, '240 GSM heavyweight')),
    h('div', {}, h('div', { style: { width:'42px', height:'42px', borderRadius:'50%', background:'var(--light-indigo)', display:'grid', placeItems:'center', margin:'0 auto' } }, '↺'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Easy returns'), h('div', { style: { fontSize: '12px', color: 'var(--ink-500)' } }, '7-day hassle-free')),
    h('div', {}, h('div', { style: { width:'42px', height:'42px', borderRadius:'50%', background:'var(--light-indigo)', display:'grid', placeItems:'center', margin:'0 auto' } }, '◧'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Secure payments'), h('div', { style: { fontSize: '12px', color: 'var(--ink-500)' } }, 'Razorpay protected')),
    h('div', {}, h('div', { style: { width:'42px', height:'42px', borderRadius:'50%', background:'var(--light-indigo)', display:'grid', placeItems:'center', margin:'0 auto' } }, '◐'), h('div', { style: { fontWeight: '700', fontSize: '13px', marginTop: '8px' } }, 'Made in India'), h('div', { style: { fontSize: '12px', color: 'var(--ink-500)' } }, 'Designed with care')));

  main.append(hero, catRow, feedSection, studio, trust);

  // ── DATA ──
  (async () => {
    try {
      const { items } = await api.get('/products', { module: 'shop', limit: 8, sort: 'newest' });
      productGrid.innerHTML = '';
      if (items.length) productGrid.append(...items.map(ProductCard));
      else productGrid.append(emptyState({ title: 'New drops coming soon' }));
    } catch (e) {
      productGrid.innerHTML = '';
      productGrid.append(errorState(e.message, () => location.reload()));
    }
  })();

  // Cleanup timer when navigating away
  const cleanup = () => { if (timer) clearInterval(timer); };
  // Attach to page via router cleanup signal
  main._cleanup = cleanup;

  return main;
}
