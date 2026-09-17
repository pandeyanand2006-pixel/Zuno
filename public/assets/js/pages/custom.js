import { h, money, skeletonGrid, emptyState, errorState } from '../ui.js';
import { api } from '../api.js';
import { ProductCard } from '../components.js';

const SORTS = [
  { v: 'popular', l: 'Popularity' },
  { v: 'newest', l: 'Newest' },
  { v: 'price_low', l: 'Price: Low to High' },
  { v: 'price_high', l: 'Price: High to Low' },
];
const SIZES = ['XS','S','M','L','XL','XXL','XXXL'];
const COLORS = [
  { key:'black', bg:'#0a0a0a' }, { key:'white', bg:'#fff', border:'#e5e5e5' }, { key:'red', bg:'#dc2626' }, { key:'blue', bg:'#1e40af' }, { key:'green', bg:'#16a34a' }, { key:'yellow', bg:'#facc15' }, { key:'beige', bg:'#e8e6e1' }, { key:'grey', bg:'#a3a3a3' }, { key:'navy', bg:'#1e293b' }, { key:'olive', bg:'#556b2f' },
];
const FITS = ['regular','oversized','relaxed'];
const GENDERS = ['men','women','unisex'];

function qparse(){ const h=location.hash.split('?')[1]||''; const o={}; new URLSearchParams(h).forEach((v,k)=>o[k]=v); return o; }
function qstring(patch){
  const cur=qparse(); const nxt={...cur, ...patch};
  for(const[k,v] of Object.entries(patch)) if(cur[k]===v) nxt[k]='';
  const clean=Object.entries(nxt).filter(([,v])=>v).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
  return `#/custom${clean?'?'+clean:''}`;
}

export async function CustomListing(){
  const q = qparse();
  const grid = h('div', { class:'grid grid-products' });
  const countEl = h('div', { class:'muted', style:{fontSize:'13px'} }, 'Loading…');
  const countNum = h('span', { style:{fontWeight:'700', color:'#0f172a'} }, '');
  const sortSel = h('select', { class:'input', style:{maxWidth:'200px', borderRadius:'999px', background:'#fff', border:'1px solid #dde3ef', padding:'10px 14px'}, onchange:()=>{
    const cur=qparse(); cur.sort=sortSel.value; const s=Object.entries(cur).filter(([,v])=>v).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&'); location.hash='#/custom'+(s?'?'+s:'');
  }}, ...SORTS.map(s=> h('option', { value:s.v, selected:(q.sort||'popular')===s.v }, s.l)));

  // Sidebar filters — only attributes that exist in DB
  const activeGender=q.gender||'', activeSize=q.size||'', activeColor=q.color||'', activeFit=q.fit||'';
  const sidebar = h('aside', { class:'sidebar', style:{position:'static', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px'} });
  sidebar.append(
    h('div', { style:{fontWeight:'800', fontSize:'13px', letterSpacing:'0.06em', textTransform:'uppercase', color:'#0f172a', marginBottom:'12px'} }, 'Filters'),
    h('a', { href:'#/custom', class:'btn btn-ghost btn-sm', style:{marginBottom:'12px', border:'1px solid #e2e8f0'} }, 'Clear All')
  );
  // Gender
  sidebar.append(h('div', { class:'filter-group', style:{marginTop:'12px'} }, h('div', { class:'filter-title' }, 'Gender')));
  GENDERS.forEach(g=>{
    const active=activeGender===g;
    sidebar.append(h('a', { href:qstring({gender:g}), class:'filter-link'+(active?' active':''), style:{textTransform:'capitalize'} }, g));
  });
  // Sizes
  sidebar.append(h('div', { style:{marginTop:'14px', fontWeight:'700', fontSize:'12px', letterSpacing:'0.06em', textTransform:'uppercase', color:'#0f172a'} }, 'Sizes'));
  const sizeRow=h('div', { style:{display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'6px'} });
  SIZES.forEach(s=> sizeRow.append(h('a', { href:qstring({size:s}), class:'chip'+(activeSize===s?' active':''), style:{padding:'6px 10px', fontSize:'12px'} }, s)));
  sidebar.append(sizeRow);
  // Colors
  sidebar.append(h('div', { style:{marginTop:'14px', fontWeight:'700', fontSize:'12px', letterSpacing:'0.06em'} }, 'Color'));
  const colRow=h('div', { style:{display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'6px'} });
  COLORS.forEach(c=>{
    const active=activeColor===c.key;
    colRow.append(h('a', { href:qstring({color:c.key}), title:c.key, style:{width:'28px', height:'28px', borderRadius:'50%', background:c.bg, border: active? '2px solid #0f172a' : (c.border?'1px solid '+c.border:'1px solid transparent'), display:'block', boxShadow: active?'0 0 0 2px #fff,0 0 0 4px #0f172a':''} }));
  });
  sidebar.append(colRow);
  // Fit
  sidebar.append(h('div', { style:{marginTop:'14px', fontWeight:'700', fontSize:'12px', letterSpacing:'0.06em'} }, 'Fit'));
  FITS.forEach(f=>{
    const active=activeFit===f;
    sidebar.append(h('a', { href:qstring({fit:f}), class:'filter-link'+(active?' active':''), style:{textTransform:'capitalize'} }, f));
  });

  // Info section placeholder below grid — SEO
  const info = h('section', { style:{marginTop:'32px', padding:'20px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px'} },
    h('h3', { style:{fontSize:'16px', fontWeight:'800', color:'#0f172a'} }, 'Custom T-Shirts — How It Works'),
    h('p', { class:'muted', style:{fontSize:'13px', marginTop:'6px', lineHeight:'1.6'} }, 'Create your own T-shirt in 3 steps: Pick Color & Size → Finalise Design (add text, upload artwork) → Preview. Your design is printed on premium 240 GSM cotton and fulfilled via Printrove. Prices and stock are managed live by ZUNO admin.'),
    h('div', { style:{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px', marginTop:'12px'} },
      h('div', { style:{background:'#fff', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0'} }, h('div',{style:{fontWeight:'700', fontSize:'12px'}},'1. Pick Color & Size'), h('div',{style:{fontSize:'11px', color:'#64748b'}},'Choose from admin-enabled colors & sizes with live stock')),
      h('div', { style:{background:'#fff', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0'} }, h('div',{style:{fontWeight:'700', fontSize:'12px'}},'2. Finalise Design'), h('div',{style:{fontSize:'11px', color:'#64748b'}},'Add text, upload PNG/JPG/WebP, drag/resize/rotate, flip front/back')),
      h('div', { style:{background:'#fff', padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0'} }, h('div',{style:{fontWeight:'700', fontSize:'12px'}},'3. Preview & Bag'), h('div',{style:{fontSize:'11px', color:'#64748b'}},'See final front/back before Add to Bag → checkout'))
    )
  );

  const header = h('div', { class:'shop-header', style:{display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', flexWrap:'wrap', marginBottom:'16px'} },
    h('div', {},
      h('h1', { style:{fontFamily:'var(--font-display)', fontSize:'28px', lineHeight:'1.1', margin:'0', color:'#0f172a'} }, 'Customized T-Shirts'),
      h('div', { style:{display:'flex', gap:'8px', alignItems:'center', marginTop:'4px'} }, countEl, countNum)
    ),
    h('div', { style:{display:'flex', alignItems:'center', gap:'10px'} }, h('span', { class:'muted text-sm desktop-only' }, 'Sort'), sortSel)
  );

  const wrap = h('div', { class:'container section' },
    header,
    h('div', { class:'split', style:{gridTemplateColumns:'260px 1fr'} }, sidebar, h('div', {}, grid, info))
  );

  async function load(){
    grid.innerHTML=''; const sk=skeletonGrid(8); grid.append(...[...sk.children]);
    const params={ module:'shop', customizable:'1', limit:32, sort: q.sort||'popular' };
    if(q.gender) params.gender=q.gender;
    if(q.size) params.size=q.size;
    if(q.color) params.color=q.color;
    if(q.fit) params.fit=q.fit;
    try{
      const { items, total } = await api.get('/products', params);
      grid.innerHTML='';
      countEl.textContent = `${total} Products`;
      countNum.textContent = total ? `• ${total} customizable` : '';
      if(!items.length) grid.append(emptyState({ icon:'✦', title:'No custom products yet', desc:'Admin can create Custom T-Shirts in Admin → Custom T-Shirts → + Add Custom T-Shirt', action: h('a', { class:'btn btn-primary', href:'#/admin/custom' }, 'Go to Admin') }));
      else {
        // Custom card: brand, name, price/mrp/off, customizable badge
        grid.append(...items.map(p=>{
          const card = ProductCard(p);
          // Ensure card links to custom detail flow, not normal product
          const a = card; // ProductCard returns <a href="#/product/slug">
          // Hijack href to custom flow: #/custom/:slug
          try{ a.setAttribute('href', '#/custom/'+p.slug); }catch{}
          // Add customizable badge if not already
          if(p.customizable){
            const thumb=a.querySelector('.product-thumb');
            if(thumb && !thumb.querySelector('.custom-badge')){
              const badge=h('span', { class:'product-badge', style:{background:'#f59e0b', top:'10px', left:'10px', right:'auto'} }, 'CUSTOM');
              thumb.prepend(badge);
            }
          }
          return a;
        }));
      }
    }catch(e){
      grid.innerHTML=''; grid.append(errorState(e.message, load));
    }
  }
  load();
  return wrap;
}
