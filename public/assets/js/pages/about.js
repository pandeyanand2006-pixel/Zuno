import { h } from '../ui.js';

export function About() {
  return h('div', { class: 'container section' },
    h('div', { style: { maxWidth: '720px', margin: '0 auto' } },
      h('p', { class: 'hero-eyebrow', style: { color: 'var(--ink-500)' } }, 'Our Story'),
      h('h1', { style: { fontFamily: 'var(--font-display)', fontSize: 'var(--fs-4xl)', letterSpacing: '-0.03em', lineHeight: '1', margin: '12px 0 20px' } }, 'ZUNO is', h('br'), 'everyday', h('br'), 'confidence.'),
      h('p', { class: 'muted', style: { fontSize: 'var(--fs-lg)', lineHeight: '1.7' } },
        'We started ZUNO with a simple idea: premium T-shirts should be effortless. No loud logos, no fast-fashion compromise — just heavyweight cotton, perfect fits and printing that lasts.'),
      h('div', { class: 'divider', style: { margin: '32px 0' } }),
      h('h3', {}, 'Made in India, worn everywhere'),
      h('p', { class: 'muted', style: { lineHeight: '1.7', marginTop: '8px' } },
        'Every ZUNO tee is designed in India and made with care. We use 240 GSM heavyweight cotton, garment-dyed for a lived-in feel, and HD screen printing that stays sharp wash after wash. Our Custom Studio lets you create a tee that is completely yours — from text to artwork, front and back.'),
      h('div', { class: 'grid', style: { gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' } },
        h('div', { class: 'card card-pad', style: { background: 'var(--ink-50)' } }, h('h4', {}, 'Premium fabric'), h('p', { class: 'muted text-sm', style: { marginTop: '6px' } }, '240 GSM heavyweight, breathable, made to last.')),
        h('div', { class: 'card card-pad', style: { background: 'var(--ink-50)' } }, h('h4', {}, 'Custom printing'), h('p', { class: 'muted text-sm', style: { marginTop: '6px' } }, 'Your design, printed to order with HD quality.'))),
      h('div', { class: 'row gap-3', style: { marginTop: '32px' } },
        h('a', { class: 'btn btn-primary btn-lg', href: '#/shop' }, 'Shop T-shirts'),
        h('a', { class: 'btn btn-outline btn-lg', href: '#/customize' }, 'Create your own →'))));
}
