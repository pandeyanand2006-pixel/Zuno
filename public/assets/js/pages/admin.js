import { h, money, toast, emptyState, modal, confirmDialog, productImage, resolveImageUrl, imgFallback } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';

// ── helpers ──
function formatDate(s) { try { return new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }); } catch { return s; } }
function formatDateTime(s) { try { return new Date(s).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }); } catch { return s; } }

function statusBadge(status) {
  const m = {
    PAYMENT_PENDING:'pending', PAID:'paid', CONFIRMED:'confirmed',
    PROCESSING:'processing', PRINTING:'processing', QUALITY_CHECK:'processing', PACKED:'processing',
    SHIPPED:'shipped', OUT_FOR_DELIVERY:'shipped', DELIVERED:'delivered', CANCELLED:'cancelled'
  };
  const cls = m[status] || 'pending';
  const label = (status||'').replace(/_/g,' ');
  return h('span', { class: `admin-badge admin-badge-${cls}` }, label);
}
function stockBadge(stock) {
  if (stock===0) return h('span', { class:'admin-badge admin-badge-out' }, 'Out of stock');
  if (stock<=10) return h('span', { class:'admin-badge admin-badge-low' }, 'Low • '+stock);
  return h('span', { class:'admin-badge admin-badge-delivered' }, stock);
}

async function ensureMe() {
  if (!Store.isAuthed()) return null;
  if (Store.getUser()) return Store.getUser();
  try { await Store.loadMe(); return Store.getUser(); } catch { return null; }
}
function isAdmin(user) { return user && user.role === 'ADMIN'; }

function adminShell(activeKey, contentNode) {
  const user = Store.getUser();
  const sidebar = h('aside', { class:'admin-sidebar', id:'adminSidebar' },
    h('div', { class:'admin-sidebar__brand' },
      h('div', { class:'admin-sidebar__brand-logo' }, 'Z'),
      h('div', {},
        h('div', { style:{fontWeight:'800', fontSize:'15px', letterSpacing:'0.08em'} }, 'ZUNO'),
        h('div', { style:{fontSize:'11px', opacity:'0.7', letterSpacing:'0.08em'} }, 'ADMIN'))),
    h('nav', { class:'admin-sidebar__nav' },
      h('a', { class:'admin-sidebar__link'+(activeKey==='overview'?' active':''), href:'#/admin' }, h('span',{class:'ic'},'◧'), 'Dashboard'),
      h('a', { class:'admin-sidebar__link'+(activeKey==='orders'?' active':''), href:'#/admin/orders' }, h('span',{class:'ic'},'≡'), 'Orders'),
      h('a', { class:'admin-sidebar__link'+(activeKey==='products'?' active':''), href:'#/admin/products' }, h('span',{class:'ic'},'▭'), 'Products'),
      h('a', { class:'admin-sidebar__link'+(activeKey==='inventory'?' active':''), href:'#/admin/inventory' }, h('span',{class:'ic'},'▦'), 'Inventory'),
      h('a', { class:'admin-sidebar__link'+(activeKey==='customers'?' active':''), href:'#/admin/customers' }, h('span',{class:'ic'},'◐'), 'Customers'),
      h('a', { class:'admin-sidebar__link'+(activeKey==='profile'?' active':''), href:'#/admin/profile' }, h('span',{class:'ic'},'👤'), 'Profile'),
      h('a', { class:'admin-sidebar__link'+(activeKey==='password'?' active':''), href:'#/admin/password' }, h('span',{class:'ic'},'🔒'), 'Reset Password'),
      h('div', { style:{flex:'1'}}),
      h('a', { class:'admin-sidebar__link', href:'#/', style:{color:'#64748b'} }, h('span',{class:'ic'},'←'), 'Back to Store'),
      h('a', { class:'admin-sidebar__link', href:'#/admin/login', onclick:(e)=>{ e.preventDefault(); Store.setToken(null); Store.setUser(null); location.hash='#/admin/login'; } }, h('span',{class:'ic'},'↪'), 'Logout')
    ),
    h('a', { href:'#/admin/profile', style:{textDecoration:'none'}, onclick:(e)=>{ /* let router handle */ } },
      h('div', { class:'admin-sidebar__footer', style:{cursor:'pointer'} },
        h('div', { style:{fontSize:'12px', fontWeight:'700', color:'#e2e8f0'} }, user ? user.name : 'Admin'),
        h('div', { style:{fontSize:'11px', color:'#64748b', marginTop:'2px'} }, user ? (user.email||user.mobile) : ''),
        h('div', { style:{fontSize:'10px', color:'#1e40af', marginTop:'4px', fontWeight:'700'} }, 'View profile →')
      )
    )
  );

  const overlay = h('div', { class:'admin-overlay', id:'adminOverlay', onclick:()=>{ sidebar.classList.remove('open'); overlay.classList.remove('open'); } });

  const topTitleMap = { overview:'Dashboard', orders:'Orders', products:'Products', inventory:'Inventory', customers:'Customers', profile:'Profile', password:'Reset Password' };
  const searchInput = h('input', { placeholder:'Search orders, products…', onkeydown:(e)=>{ if(e.key==='Enter'){ const v=e.target.value.trim(); if(!v) return; if(activeKey==='orders') location.hash='#/admin/orders?q='+encodeURIComponent(v); else if(activeKey==='products') location.hash='#/admin/products?q='+encodeURIComponent(v); else location.hash='#/admin/orders?q='+encodeURIComponent(v); } } });

  // Admin profile dropdown
  const profileMenu = h('div', { style:{position:'absolute', right:'0', top:'42px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', boxShadow:'0 10px 30px rgba(0,0,0,0.12)', minWidth:'200px', display:'none', zIndex:'50', overflow:'hidden'} },
    h('div', { style:{padding:'12px 14px', borderBottom:'1px solid #f1f5f9'} },
      h('div', { style:{fontWeight:'700', fontSize:'13px', color:'#0f172a'} }, user?user.name:'Admin'),
      h('div', { style:{fontSize:'11px', color:'#64748b'} }, user? (user.email||user.mobile) : ''),
      h('div', { style:{fontSize:'11px', color:'#1e40af', fontWeight:'700', marginTop:'4px'} }, '● ADMIN')
    ),
    h('a', { href:'#/admin/profile', style:{display:'flex', gap:'10px', padding:'10px 14px', fontSize:'13px', color:'#334155', textDecoration:'none'}, onmouseenter:(e)=>e.currentTarget.style.background='#f8fafc', onmouseleave:(e)=>e.currentTarget.style.background='#fff' }, '👤', 'My Profile'),
    h('a', { href:'#/admin/password', style:{display:'flex', gap:'10px', padding:'10px 14px', fontSize:'13px', color:'#334155', textDecoration:'none'}, onmouseenter:(e)=>e.currentTarget.style.background='#f8fafc', onmouseleave:(e)=>e.currentTarget.style.background='#fff' }, '🔒', 'Reset Password'),
    h('a', { href:'#/admin/orders', style:{display:'flex', gap:'10px', padding:'10px 14px', fontSize:'13px', color:'#334155', textDecoration:'none'}, onmouseenter:(e)=>e.currentTarget.style.background='#f8fafc', onmouseleave:(e)=>e.currentTarget.style.background='#fff' }, '📦', 'Orders'),
    h('div', { style:{borderTop:'1px solid #f1f5f9', marginTop:'4px'} }),
    h('a', { href:'#/admin/login', style:{display:'flex', gap:'10px', padding:'10px 14px', fontSize:'13px', color:'#dc2626', textDecoration:'none'}, onclick:(e)=>{ e.preventDefault(); Store.setToken(null); Store.setUser(null); location.hash='#/admin/login'; }, onmouseenter:(e)=>e.currentTarget.style.background='#fef2f2', onmouseleave:(e)=>e.currentTarget.style.background='#fff' }, '↪', 'Logout')
  );
  let menuOpen = false;
  const profileBtn = h('button', { style:{display:'flex', gap:'8px', alignItems:'center', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'999px', padding:'4px 10px 4px 4px', cursor:'pointer'}, onclick:(e)=>{ menuOpen=!menuOpen; profileMenu.style.display=menuOpen?'block':'none'; e.stopPropagation(); } },
    h('span', { style:{width:'28px', height:'28px', borderRadius:'50%', background:'#1e40af', color:'#fff', display:'grid', placeItems:'center', fontSize:'11px', fontWeight:'700'} }, (user?.name||'A').slice(0,2).toUpperCase()),
    h('span', { style:{fontSize:'12px', color:'#334155', fontWeight:'600'} }, user?user.name.split(' ')[0]:'Admin'),
    h('span', { style:{fontSize:'10px', color:'#64748b'} }, '▾')
  );
  // close on outside click
  setTimeout(()=> document.addEventListener('click', ()=>{ if(menuOpen){ menuOpen=false; profileMenu.style.display='none'; } }, { once: true }), 100);

  const topbar = h('div', { class:'admin-topbar' },
    h('button', { class:'admin-mobile-toggle', onclick:()=>{ sidebar.classList.toggle('open'); overlay.classList.toggle('open'); } }, '☰'),
    h('div', { class:'admin-topbar__title' }, topTitleMap[activeKey]||'Admin'),
    h('div', { class:'admin-topbar__search' }, h('span',{class:'s-ic'},'⌕'), searchInput),
    h('div', { style:{marginLeft:'auto', position:'relative'} }, profileBtn, profileMenu)
  );

  return h('div', { class:'admin-shell' }, sidebar, overlay, h('div', { class:'admin-main' }, topbar, h('div', { class:'admin-content' }, contentNode)));
}

// ── Guard ──
async function guardOrRedirect() {
  const u = await ensureMe();
  if (!u) { location.hash = '#/admin/login'; return null; }
  if (!isAdmin(u)) {
    return h('div', { class:'admin-login-wrap' },
      h('div', { class:'admin-login-card', style:{textAlign:'center'} },
        h('div', { style:{fontSize:'40px', marginBottom:'12px'} }, '⛔'),
        h('h2', {}, 'Access Denied'),
        h('p', { class:'muted', style:{marginTop:'8px'} }, 'This dashboard is for administrators only. Your account does not have permission.'),
        h('a', { class:'admin-btn admin-btn-primary', href:'#/', style:{marginTop:'16px', display:'inline-flex'} }, 'Back to Store'),
        h('button', { class:'admin-btn admin-btn-ghost', style:{marginTop:'8px'}, onclick:()=>{ Store.setToken(null); Store.setUser(null); location.hash='#/admin/login'; } }, 'Sign in as Admin')
      ));
  }
  return u;
}

// ── Admin Login ──
export async function AdminLogin() {
  const u = await ensureMe();
  if (u && isAdmin(u)) { location.hash = '#/admin'; return h('div', { class:'admin-login-wrap' }, h('div', {}, 'Redirecting…')); }

  const root = h('div', { class:'admin-login-wrap' });
  const card = h('div', { class:'admin-login-card' });

  const idF = h('input', { class:'admin-input', placeholder:'Admin email or mobile', style:{width:'100%'} });
  const pwF = h('input', { class:'admin-input', type:'password', placeholder:'Password', style:{width:'100%'} });
  const err = h('div', { style:{color:'#dc2626', fontSize:'13px', minHeight:'18px'} });
  const btn = h('button', { class:'admin-btn admin-btn-primary', style:{width:'100%', justifyContent:'center', padding:'12px', fontSize:'14px'} }, 'Sign in to Admin');

  btn.onclick = async () => {
    err.textContent = '';
    const identifier = idF.value.trim();
    const password = pwF.value;
    if (!identifier || !password) { err.textContent = 'Enter email/mobile and password'; return; }
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const { token, user } = await api.post('/auth/login', { identifier, password }, { auth:false });
      if (user.role !== 'ADMIN') {
        err.textContent = 'Not an admin account. Use admin@zuno.app / Admin@1234';
        btn.disabled=false; btn.textContent='Sign in to Admin';
        return;
      }
      Store.setToken(token); Store.setUser(user);
      toast('Welcome, Admin','success');
      location.hash = '#/admin';
    } catch (e) { err.textContent = e.message; btn.disabled=false; btn.textContent='Sign in to Admin'; }
  };

  card.append(
    h('div', { class:'admin-login-brand' }, h('div',{class:'logo'},'Z'), h('div',{style:{fontWeight:'800'}},'ZUNO ADMIN')),
    h('h2', { style:{textAlign:'center', marginBottom:'4px'} }, 'Admin Sign In'),
    h('p', { class:'muted', style:{textAlign:'center', fontSize:'13px', marginBottom:'16px'} }, 'Use your administrator credentials to access the dashboard'),
    h('div', { style:{display:'flex', flexDirection:'column', gap:'12px'} }, 
      h('div', {}, h('label', { style:{fontSize:'12px', fontWeight:'700', color:'#334155'} }, 'Email or Mobile'), idF),
      h('div', {}, h('label', { style:{fontSize:'12px', fontWeight:'700', color:'#334155'} }, 'Password'), pwF,
        h('div', { style:{textAlign:'right', marginTop:'6px'} }, h('a', { href:'#/admin/forgot-password', style:{fontSize:'12px', color:'#1e40af', fontWeight:'600', textDecoration:'none'} }, 'Forgot Password?'))),
      err, btn),
    h('div', { style:{marginTop:'16px', background:'#f8fafc', border:'1px dashed #cbd5e1', borderRadius:'10px', padding:'12px'} },
      h('div', { style:{fontSize:'12px', fontWeight:'700'} }, 'Demo Admin'),
      h('div', { style:{fontSize:'12px', color:'#64748b', marginTop:'4px', lineHeight:'1.5'} },
        'Email: admin@zuno.app', h('br'),
        'Mobile: 9999999999', h('br'),
        'Password: Admin@1234'),
      h('button', { class:'admin-btn admin-btn-ghost', style:{marginTop:'8px', fontSize:'12px'}, onclick:()=>{ idF.value='admin@zuno.app'; pwF.value='Admin@1234'; } }, 'Fill demo →')
    ),
    h('div', { style:{textAlign:'center', marginTop:'16px'} }, h('a', { href:'#/', style:{fontSize:'13px', color:'#64748b'} }, '← Back to storefront'))
  );
  root.append(card);
  // auto fill on Enter
  [idF,pwF].forEach(el=>el.addEventListener('keydown', (e)=>{ if(e.key==='Enter') btn.click(); }));
  return root;
}

// ── Overview ──
async function loadOverview() {
  const guard = await guardOrRedirect();
  if (!guard || guard.tagName) return guard; // guard returned emptyState element
  // Actually guardOrRedirect returns user or element; need to handle
  if (guard && guard.nodeType) return adminShell('overview', guard);
  try {
    const d = await api.get('/admin/dashboard');
    const stats = h('div', { class:'admin-cards' },
      statCard('₹','Revenue', money(d.revenue), d.todayRevenue? `Today ${money(d.todayRevenue)}` : 'All time'),
      statCard('≡','Total Orders', String(d.totalOrders), `${d.todayOrders} today`),
      statCard('●','Pending', String(d.pending), 'Payment pending'),
      statCard('✓','Confirmed', String(d.confirmed), 'Confirmed by admin'),
      statCard('→','Shipped', String(d.shipped), 'In transit'),
      statCard('✔','Delivered', String(d.delivered), d.cancelled? `${d.cancelled} cancelled` : 'Completed'),
      statCard('▭','Products', String(d.totalProducts), `${d.lowStock} low stock`),
      statCard('▦','AOV', money(d.averageOrderValue), 'Avg order value'),
    );
    const recent = d.recentOrders || [];
    const recentTable = recent.length ? h('div', { class:'admin-card' },
      h('div', { class:'admin-card__head' }, h('div',{class:'admin-card__title'},'Recent Orders'), h('a',{href:'#/admin/orders', class:'admin-btn admin-btn-ghost'},'View all')),
      h('div', { class:'admin-table-wrap' }, h('table', { class:'admin-table' },
        h('thead', {}, h('tr', {}, h('th',{},'Order'), h('th',{},'Customer'), h('th',{},'Total'), h('th',{},'Status'), h('th',{},'Date'))),
        ...recent.map(o=> h('tr', {},
          h('td', {}, h('a',{href:'#/admin/orders', style:{fontWeight:'700', color:'#0f172a'}}, o.order_number)),
          h('td', {}, o.customer_name||'Guest', h('div',{style:{fontSize:'11px', color:'#94a3b8'}}, o.customer_mobile||o.customer_email||'')),
          h('td', {}, h('span',{style:{fontWeight:'700'}}, money(o.total))),
          h('td', {}, statusBadge(o.status)),
          h('td', {}, formatDate(o.created_at))
        ))
      ))
    ) : h('div', { class:'admin-card', style:{padding:'20px'} }, emptyState({ title:'No orders yet', desc:'Orders will appear here once customers checkout.' }));

    const low = d.lowStockProducts||[];
    const lowTable = h('div', { class:'admin-card' },
      h('div', { class:'admin-card__head' }, h('div',{class:'admin-card__title'}, `Low Stock (${d.lowStock})`), h('a',{href:'#/admin/inventory?filter=low', class:'admin-btn admin-btn-ghost'},'Manage')),
      low.length ? h('div', { class:'admin-table-wrap' }, h('table', { class:'admin-table' },
        h('thead',{}, h('tr',{}, h('th',{},'Product'), h('th',{},'Stock'), h('th',{},'Price'))),
        ...low.map(p=> h('tr', {},
          h('td', {}, h('span',{style:{fontWeight:'600'}}, p.name)),
          h('td', {}, stockBadge(p.stock)),
          h('td', {}, money(p.price))
        ))
      )) : h('div', { style:{padding:'20px', textAlign:'center', color:'#64748b'} }, 'No low-stock products 🎉')
    );

    const weekly = d.weekly||[];
    const weeklyCard = h('div', { class:'admin-card' },
      h('div', { class:'admin-card__head' }, h('div',{class:'admin-card__title'},'Last 7 Days')),
      h('div', { style:{padding:'16px'} },
        weekly.length ? h('div', { style:{display:'flex', gap:'8px', alignItems:'end', height:'80px'} },
          ...weekly.map(w=>{
            const max = Math.max(...weekly.map(x=>x.revenue),1);
            const hgt = Math.max(8, Math.round((w.revenue/max)*70));
            return h('div', { style:{flex:'1', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px'} },
              h('div', { style:{width:'100%', height:hgt+'px', background:'#1e40af', borderRadius:'6px 6px 0 0'} }),
              h('div', { style:{fontSize:'10px', color:'#64748b'} }, w.day.slice(5)),
              h('div', { style:{fontSize:'10px', fontWeight:'700'} }, w.orders)
            );
          })
        ) : h('div', { style:{color:'#94a3b8', textAlign:'center'} }, 'No data')
      )
    );

    const content = h('div', { style:{display:'flex', flexDirection:'column', gap:'16px'} }, stats, h('div', { style:{display:'grid', gridTemplateColumns:'1fr 360px', gap:'16px'} }, recentTable, h('div', { style:{display:'flex', flexDirection:'column', gap:'16px'} }, lowTable, weeklyCard)));
    // responsive stacked on mobile handled via CSS grid collapse? force single column via JS if narrow
    if (window.innerWidth<900) content.querySelector('div').style.gridTemplateColumns='1fr';
    return adminShell('overview', content);
  } catch (e) {
    return adminShell('overview', h('div', { class:'admin-card', style:{padding:'20px'} }, h('h3',{},'Failed to load'), h('p',{class:'muted'}, e.message), h('button',{class:'admin-btn admin-btn-primary', onclick:()=>location.reload()},'Retry')));
  }
}
function statCard(icon, label, value, sub){
  const bg = { Revenue:'#dcfce7', 'Total Orders':'#dbeafe', Pending:'#fef3c7', Confirmed:'#e0e7ff', Shipped:'#e0f2fe', Delivered:'#dcfce7', Products:'#f3e8ff', AOV:'#f1f5f9'}[label]||'#f1f5f9';
  return h('div', { class:'admin-stat' },
    h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center'} },
      h('div', { class:'admin-stat__icon', style:{background:bg} }, icon),
      h('span', { style:{fontSize:'10px', background:'#f1f5f9', padding:'4px 8px', borderRadius:'999px', fontWeight:'700', color:'#0f172a'} }, 'Live')
    ),
    h('div', { class:'admin-stat__value' }, value),
    h('div', { class:'admin-stat__label' }, label),
    sub? h('div', { class:'admin-stat__sub' }, sub): null
  );
}

// ── Orders ──
async function loadOrders(queryParams) {
  const guard = await guardOrRedirect();
  if (guard && guard.nodeType) return adminShell('orders', guard);
  if (!guard) return h('div',{},'Redirecting…'); // should have redirected

  const q = queryParams.q || '';
  const status = queryParams.status || '';
  const sort = queryParams.sort || 'newest';
  const page = Number(queryParams.page)||1;
  const limit = 20;

  const container = h('div', { style:{display:'flex', flexDirection:'column', gap:'16px'} });
  // helper to get full address from new backend fields
  function getAddr(o){
    if (o.addr_full) return o.addr_full;
    const parts = [o.addr_house_no, o.addr_line1, o.addr_line2, o.addr_landmark, o.addr_area, [o.addr_city, o.addr_state, o.addr_pincode].filter(Boolean).join(', ')].filter(Boolean);
    return parts.join(', ') || (o.addr_line1 ? o.addr_line1 + (o.addr_city? ', '+o.addr_city:'') : '');
  }

  const searchInput = h('input', { class:'admin-input', placeholder:'Search order #, customer, mobile…', value:q, style:{width:'100%', paddingLeft:'32px'} });
  searchInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ const v=e.target.value.trim(); const u=new URLSearchParams(location.hash.split('?')[1]||''); if(v) u.set('q',v); else u.delete('q'); u.delete('page'); location.hash='#/admin/orders'+(u.toString()?'?'+u.toString():''); } });
  let searchDebounce = null;
  searchInput.addEventListener('input', ()=>{ clearTimeout(searchDebounce); searchDebounce=setTimeout(()=>{ const v=searchInput.value.trim(); const u=new URLSearchParams(location.hash.split('?')[1]||''); if(v) u.set('q',v); else u.delete('q'); u.delete('page'); const target='#/admin/orders'+(u.toString()?'?'+u.toString():''); if(location.hash!==target) location.hash=target; }, 450); });

  const controls = h('div', { class:'admin-search-row' },
    h('div', { style:{position:'relative', flex:'1', maxWidth:'320px'} },
      h('span', { style:{position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'} }, '⌕'),
      searchInput
    ),
    h('select', { class:'admin-select', value:status, onchange:(e)=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); if(e.target.value) u.set('status',e.target.value); else u.delete('status'); u.delete('page'); location.hash='#/admin/orders'+(u.toString()?'?'+u.toString():''); } },
      h('option',{value:''},'All statuses'),
      ...['PAYMENT_PENDING','PAID','CONFIRMED','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s=> h('option',{value:s, selected:s===status}, s.replace(/_/g,' ')))
    ),
    h('select', { class:'admin-select', onchange:(e)=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); u.set('sort',e.target.value); location.hash='#/admin/orders'+'?'+u.toString(); } },
      h('option',{value:'newest', selected:sort==='newest'},'Newest'),
      h('option',{value:'oldest', selected:sort==='oldest'},'Oldest'),
      h('option',{value:'total_high', selected:sort==='total_high'},'Total high'),
      h('option',{value:'total_low', selected:sort==='total_low'},'Total low')
    ),
    h('button', { class:'admin-btn admin-btn-ghost', onclick:()=>{ location.hash='#/admin/orders'; } }, 'Clear')
  );

  const listWrap = h('div', { class:'admin-card' });
  listWrap.append(h('div', { style:{padding:'20px', textAlign:'center', color:'#64748b'} }, 'Loading orders…'));

  async function fetchAndRender(){
    try{
      const params = { page, limit, sort };
      if(q) params.q=q;
      if(status) params.status=status;
      const start = performance.now();
      const { orders, total } = await api.get('/admin/orders', params);
      listWrap.innerHTML='';
      if(!orders.length){
        listWrap.append(h('div', { class:'admin-empty' }, h('div', {style:{fontSize:'36px'}},'📭'), h('h3',{},'No orders'), h('p',{},'Try adjusting search or filters')));
        return;
      }
      const table = h('table', { class:'admin-table' },
        h('thead',{}, h('tr',{}, h('th',{},'Order / Customer'), h('th',{},'Total'), h('th',{},'Status'), h('th',{},'Date'), h('th',{},'Action'))),
        ...orders.map(o=> {
          const fullAddr = getAddr(o);
          const shortAddr = fullAddr.length>60 ? fullAddr.slice(0,60)+'…' : fullAddr;
          return h('tr', {},
          h('td',{},
            h('div', { style:{fontWeight:'700', color:'#0f172a'} }, o.order_number),
            h('div', { style:{fontSize:'12px', color:'#0f172a', fontWeight:'600'} }, o.customer_name||'Guest'),
            h('div', { style:{fontSize:'11px', color:'#64748b'} }, o.customer_mobile? '📱 '+o.customer_mobile : (o.customer_email||'')),
            fullAddr ? h('div', { style:{fontSize:'11px', color:'#334155', marginTop:'4px', lineHeight:'1.4', maxWidth:'280px', wordBreak:'break-word'}, title:fullAddr },
              '📍 '+shortAddr,
              h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'2px 6px', fontSize:'10px', marginLeft:'6px'}, onclick:(e)=>{ e.stopPropagation(); const txt = `${o.customer_name||''} | ${o.customer_mobile||o.customer_email||''} | ${fullAddr}`; navigator.clipboard?.writeText(txt).then(()=>toast('Address copied','success')).catch(()=>toast(fullAddr,'info')); } }, 'copy')
            ) : h('div', { style:{fontSize:'11px', color:'#94a3b8', marginTop:'4px'} }, 'No address')
          ),
          h('td', {},
            h('div', { style:{fontWeight:'700'} }, money(o.total)),
            o.payment_status? h('div', { style:{fontSize:'11px', color:o.payment_status==='captured'?'#16a34a':'#64748b'} }, (o.payment_method||'')+' '+o.payment_status) : null
          ),
          h('td', {}, statusBadge(o.status)),
          h('td', {}, h('div', { style:{fontSize:'12px'} }, formatDate(o.created_at))),
          h('td', {},
            h('div', { style:{display:'flex', gap:'6px', alignItems:'center'} },
              h('button', { class:'admin-btn admin-btn-primary', style:{padding:'6px 12px', fontSize:'12px', background:'#1e40af', color:'#fff'}, onclick:(e)=>{ e.currentTarget.textContent='…'; e.currentTarget.disabled=true; location.hash = '#/admin/orders/' + o.id; } }, 'View'),
              h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'6px 8px', fontSize:'11px'}, onclick:(ev)=>{ const btn=ev.currentTarget; const old=btn.textContent; btn.textContent='…'; btn.disabled=true; openOrderDetail(o.id).finally(()=>{ btn.textContent=old; btn.disabled=false; }); }, title:'Quick view' }, '👁️'),
              h('select', { class:'admin-select', style:{padding:'6px 8px', minWidth:'130px'}, value:o.status, onchange: async (e)=>{
                const ns=e.target.value;
                if(ns===o.status) return;
                const prevStatus = o.status;
                e.target.disabled = true;
                const row = e.target.closest('tr');
                const badgeCell = row ? row.querySelector('td:nth-child(3)') : null;
                const origBadge = badgeCell ? badgeCell.innerHTML : '';
                // optimistic UI
                if(badgeCell){ badgeCell.innerHTML=''; badgeCell.append(statusBadge(ns)); }
                try{ await api.post('/admin/orders/'+o.id+'/status', {status:ns}); toast('Status → '+ns,'success'); o.status = ns; e.target.value = ns; // reflect selected
                  // force option selected attributes to reflect only this value
                  [...e.target.options].forEach(opt=> opt.selected = (opt.value===ns));
                }catch(err){ toast(err.message,'error'); e.target.value=prevStatus; if(badgeCell) badgeCell.innerHTML=origBadge; [...e.target.options].forEach(opt=> opt.selected = (opt.value===prevStatus)); }
                e.target.disabled = false;
              } },
                ...['PAYMENT_PENDING','PAID','CONFIRMED','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s=> h('option',{value:s, selected:s===o.status}, s.replace(/_/g,' ')))
              )
            )
          )
        )})
      );
      const totalPages = Math.max(1, Math.ceil(total/limit));
      const pagination = h('div', { class:'admin-pagination' },
        h('button', { class:'admin-btn admin-btn-ghost', disabled:page<=1, onclick:()=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); u.set('page',String(page-1)); location.hash='#/admin/orders?'+u.toString(); } }, '‹ Prev'),
        h('span', { style:{fontSize:'13px', color:'#334155'} }, `Page ${page} of ${totalPages} • ${total} orders`),
        h('button', { class:'admin-btn admin-btn-ghost', disabled:page>=totalPages, onclick:()=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); u.set('page',String(page+1)); location.hash='#/admin/orders?'+u.toString(); } }, 'Next ›')
      );
      listWrap.append(h('div', { class:'admin-table-wrap' }, table), pagination);
    }catch(e){
      listWrap.innerHTML='';
      listWrap.append(h('div', { style:{padding:'20px', color:'#dc2626'} }, 'Failed: '+e.message));
    }
  }
  fetchAndRender();
  container.append(controls, listWrap);
  return adminShell('orders', container);
}

async function openOrderDetail(orderId){
  try{
    const { order } = await api.get('/admin/orders/'+orderId);
    const items = order.items||[];
    const customer = order.customer||{};
    const address = order.address||{};
    const payment = order.payment||null;
    const history = order.history||[];
    // Build full address display — covers all fields
    const addrLines = [];
    if (address.house_no) addrLines.push(`House/Building: ${address.house_no}`);
    if (address.line1) addrLines.push(address.line1);
    if (address.street) addrLines.push(address.street);
    if (address.line2) addrLines.push(address.line2);
    if (address.area) addrLines.push(`Area: ${address.area}`);
    if (address.landmark) addrLines.push(`Landmark: ${address.landmark}`);
    const cityLine = [address.city, address.state, address.pincode].filter(Boolean).join(', ');
    if (cityLine) addrLines.push(cityLine);
    if (address.latitude && address.longitude) addrLines.push(`📍 ${Number(address.latitude).toFixed(5)}, ${Number(address.longitude).toFixed(5)}`);
    const fullAddrText = addrLines.join(', ');

    let modalCtrl = null;
    const curBadgeWrap = h('span', { id:'quickStatusBadge' }, statusBadge(order.status));
    const quickSelect = h('select', { class:'admin-select', id:'statusSel' },
      ...['PAYMENT_PENDING','PAID','CONFIRMED','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s=> h('option',{value:s, selected:s===order.status}, s.replace(/_/g,' ')))
    );
    const content = h('div', { style:{maxHeight:'85vh', overflowY:'auto', paddingRight:'8px', color:'#0f172a', background:'#fff', borderRadius:'12px'} },
      h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'} },
        h('h2', { style:{margin:'0', color:'#0f172a', fontSize:'18px'} }, order.order_number),
        h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'6px 10px'}, onclick:()=>{ modalCtrl && modalCtrl.close(); } }, '✕')
      ),
      h('div', { style:{display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center'} }, curBadgeWrap, order.coupon_code? h('span',{class:'admin-badge admin-badge-pending'}, 'Coupon '+order.coupon_code):null, h('span',{class: order.payment_method==='cod'?'admin-badge admin-badge-confirmed':'admin-badge admin-badge-pending'}, order.payment_method==='cod' ? '💵 COD' : (payment? (payment.verified?'✓ Paid':'Payment '+payment.status) : order.payment_status || 'Online')), h('span',{class:'admin-badge', style:{background:'#f1f5f9', color:'#334155'}}, `Total ${money(order.total)}`)),
      h('div', { style:{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginTop:'16px'} },
        h('div', { style:{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'14px'} },
          h('div', { style:{fontSize:'11px', fontWeight:'700', letterSpacing:'.06em', color:'#64748b'} }, 'CUSTOMER DETAILS'),
          h('div', { style:{fontWeight:'700', marginTop:'8px', color:'#0f172a'} }, customer.name||'—'),
          h('div', { style:{fontSize:'13px', color:'#0f172a', marginTop:'4px'} }, customer.mobile ? `📱 ${customer.mobile}` : ''),
          h('div', { style:{fontSize:'12px', color:'#334155', marginTop:'2px'} }, customer.email ? `✉️ ${customer.email}` : ''),
          h('div', { style:{fontSize:'11px', color:'#64748b', marginTop:'8px'} }, `Customer ID: ${customer.id || '—'}`),
          h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'4px 8px', fontSize:'11px', marginTop:'8px'}, onclick:()=>{ navigator.clipboard?.writeText(`${customer.name||''} ${customer.mobile||''} ${customer.email||''}`); toast('Customer copied','success'); } }, '📋 Copy customer')
        ),
        h('div', { style:{background:'#fff', border:'2px solid #1e40af', borderRadius:'12px', padding:'14px'} },
          h('div', { style:{fontSize:'11px', fontWeight:'700', letterSpacing:'.06em', color:'#1e40af'} }, 'FULL SHIPPING ADDRESS'),
          addrLines.length ? h('div', { style:{marginTop:'8px', lineHeight:'1.6', color:'#0f172a', fontSize:'13px', background:'#f8fafc', padding:'10px', borderRadius:'8px', border:'1px solid #e2e8f0'} },
            ...addrLines.map(l => h('div', { style:{fontWeight: l.startsWith('House') || l.startsWith('Landmark') || l.startsWith('Area') ? '600' : '400'} }, l)),
            (address.latitude && address.longitude) ? h('a', { href:`https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`, target:'_blank', style:{display:'inline-block', marginTop:'6px', fontSize:'11px', color:'#1e40af', fontWeight:'700'} }, '📍 Open in Google Maps') : null
          ) : h('div',{style:{color:'#94a3b8', marginTop:'8px'}},'No address — contact customer'),
          h('div', { style:{marginTop:'12px', padding:'8px', background: order.payment_method==='cod' ? '#fef3c7' : '#dbeafe', borderRadius:'8px', fontSize:'12px', color:'#0f172a'} },
            h('span',{style:{fontWeight:'700'}},'Payment: '), `${order.payment_method==='cod' ? 'Cash on Delivery (COD)' : (payment?.method || order.payment_method || 'Online')} • ${order.payment_status || payment?.status || order.status} • ${money(order.total)}`
          ),
          h('div', { style:{marginTop:'10px', display:'flex', gap:'6px', flexWrap:'wrap'} },
            h('button', { class:'admin-btn admin-btn-primary', style:{padding:'6px 10px', fontSize:'11px'}, onclick:()=>{ navigator.clipboard?.writeText(fullAddrText + ` | ${customer.name||''} ${customer.mobile||''}`); toast('Full address copied','success'); } }, '📋 Copy Full Address')
          )
        )
      ),
      h('div', { style:{marginTop:'16px'} },
        h('div', { style:{fontWeight:'700', marginBottom:'8px'} }, 'Items'),
        ...items.map(it=>{
          const variant = it.variant||{};
          const isCustom = !!it.customization_data;
          const cust = it.customization||null;
          return h('div', { style:{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'14px', marginBottom:'10px', borderLeft: isCustom?'4px solid #f59e0b':'4px solid #1e40af'} },
            h('div', { style:{fontWeight:'700'} }, it.name + (isCustom?' ✦ Custom':'')),
            variant.color||variant.size? h('div', { style:{fontSize:'12px', color:'#334155', marginTop:'4px'} }, `Color ${variant.color||'—'} • Size ${variant.size||'—'}${variant.fit?' • Fit '+variant.fit:''}`) : null,
            cust? h('div', { style:{background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'8px', padding:'10px', marginTop:'8px', fontSize:'12px'} },
              h('div',{style:{fontWeight:'700', color:'#9a3412'}},'🎨 Custom Design'),
              h('div',{style:{marginTop:'6px'}}, `Front: ${cust.front?.elements?.length||0} elements • Back: ${cust.back?.elements?.length||0} elements`),
              ...((cust.front?.elements||[]).slice(0,2).map(e=> e.type==='text'? h('div',{style:{background:'#fff', padding:'6px', borderRadius:'6px', marginTop:'4px'}}, `"${e.value}"`):null))
            ):null,
            h('div', { style:{display:'flex', justifyContent:'space-between', marginTop:'8px', fontSize:'13px'} }, h('span',{}, `Qty ${it.quantity} × ${money(it.price)}`), h('span',{style:{fontWeight:'800'}}, money(it.price*it.quantity)))
          );
        }),
        h('div', { style:{display:'flex', justifyContent:'space-between', paddingTop:'12px', borderTop:'2px solid #f1f5f9', fontWeight:'700'} }, h('span',{style:{color:'#64748b'}}, `Subtotal ${money(order.subtotal)} • Tax ${money(order.tax)}`), h('span',{style:{fontSize:'18px'}}, money(order.total)))
      ),
      h('div', { style:{marginTop:'16px', display:'flex', gap:'8px', flexWrap:'wrap'} },
        h('button', { class:'admin-btn admin-btn-primary', onclick:()=>{ const txt=`${customer.name} | ${customer.mobile} | ${fullAddrText} | ${order.order_number}`; navigator.clipboard?.writeText(txt); toast('Copied delivery details','success'); } }, '📋 Copy delivery'),
        h('button', { class:'admin-btn admin-btn-ghost', onclick:()=>window.print() }, '🖨️ Print'),
        h('button', { class:'admin-btn admin-btn-ghost', onclick:()=>{ location.hash='#/admin/orders/'+order.id; modalCtrl && modalCtrl.close(); } }, '↗ Open full page')
      ),
      h('div', { style:{marginTop:'16px'} },
        h('div', { style:{fontWeight:'600', marginBottom:'8px'} }, 'Update Status (instant)'),
        h('div', { style:{display:'flex', gap:'8px', alignItems:'center'} },
          quickSelect,
          h('button', { class:'admin-btn admin-btn-primary', onclick: async (e)=> {
            const btn=e.currentTarget; const sel=quickSelect; const ns=sel.value; if(ns===order.status) { toast('Already '+ns,'info'); return; } const prev=order.status; btn.disabled=true; btn.textContent='…'; curBadgeWrap.innerHTML=''; curBadgeWrap.append(statusBadge(ns));
            try{ await api.post('/admin/orders/'+order.id+'/status', {status:ns}); toast('Status → '+ns,'success'); order.status=ns; // reflect only selected
            }catch(err){ toast(err.message,'error'); curBadgeWrap.innerHTML=''; curBadgeWrap.append(statusBadge(prev)); sel.value=prev; }
            btn.disabled=false; btn.textContent='Update';
          } }, 'Update'),
          h('button', { class:'admin-btn admin-btn-ghost', onclick: async ()=>{
            const note=prompt('Add admin note:');
            if(!note) return;
            try{ await api.post('/admin/orders/'+order.id+'/notes', {note}); toast('Note added','success'); }catch(e){ toast(e.message,'error'); }
          } }, 'Add note')
        ),
        history.length? h('div', { style:{marginTop:'12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'12px'} },
          h('div', { style:{fontWeight:'700', fontSize:'13px', marginBottom:'6px'} }, 'History'),
          ...history.slice(-10).map(h=> h('div', { style:{fontSize:'12px', padding:'6px 0', borderBottom:'1px solid #f1f5f9'} }, `${h.to_status} • ${formatDateTime(h.created_at)}${h.note?' • '+h.note:''}${h.changed_by_name?' — by '+h.changed_by_name:''}`))
        ):null
      )
    );
    modalCtrl = modal(content);
  }catch(e){ toast(e.message,'error'); }
}

export async function AdminOrderDetail(ctx){
  const guard = await guardOrRedirect();
  if (guard && guard.nodeType) return adminShell('orders', guard);
  if (!guard) return h('div',{},'Redirecting…');
  const orderId = ctx.params.id;
  try{
    const { order } = await api.get('/admin/orders/'+orderId);
    const items = order.items||[];
    const customer = order.customer||{};
    const address = order.address||{};
    const payment = order.payment||null;
    const history = order.history||[];
    const addrLines = [];
    if (address.house_no) addrLines.push(`House/Building: ${address.house_no}`);
    if (address.line1) addrLines.push(address.line1);
    if (address.street) addrLines.push(address.street);
    if (address.line2) addrLines.push(address.line2);
    if (address.area) addrLines.push(`Area: ${address.area}`);
    if (address.landmark) addrLines.push(`Landmark: ${address.landmark}`);
    const cityLine = [address.city, address.state, address.pincode].filter(Boolean).join(', ');
    if (cityLine) addrLines.push(cityLine);
    if (address.latitude && address.longitude) addrLines.push(`📍 ${Number(address.latitude).toFixed(5)}, ${Number(address.longitude).toFixed(5)}`);
    const fullAddr = addrLines.join(', ');

    const badgeWrap = h('span', {}, statusBadge(order.status));
    const detailSelect = h('select', { class:'admin-select', id:'detailStatusSel', style:{minWidth:'180px'} },
      ...['PAYMENT_PENDING','PAID','CONFIRMED','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s=> h('option',{value:s, selected:s===order.status}, s.replace(/_/g,' ')))
    );

    const content = h('div', { style:{display:'flex', flexDirection:'column', gap:'16px'} },
      h('div', { style:{display:'flex', gap:'12px', alignItems:'center'} },
        h('a', { href:'#/admin/orders', class:'admin-btn admin-btn-ghost' }, '← Back to Orders'),
        h('span', { style:{fontSize:'12px', color:'#64748b'} }, `Order ${order.order_number}`)
      ),
      h('div', { class:'admin-card', style:{padding:'20px'} },
        h('div', { style:{display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:'12px'} },
          h('div', {},
            h('h2', { style:{margin:'0', color:'#0f172a'} }, order.order_number),
            h('div', { style:{marginTop:'6px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center'} }, badgeWrap, h('span',{class:'admin-badge', style:{background: order.payment_method==='cod'?'#fef3c7':'#dbeafe', color:'#0f172a'}}, order.payment_method==='cod' ? '💵 COD' : 'Online'), h('span',{style:{fontSize:'12px', color:'#64748b'}}, formatDateTime(order.created_at)))
          ),
          h('div', { style:{textAlign:'right'} },
            h('div', { style:{fontSize:'22px', fontWeight:'800', color:'#0f172a'} }, money(order.total)),
            h('div', { style:{fontSize:'12px', color:'#64748b'} }, `${order.payment_status || payment?.status || order.status} • ${money(order.subtotal)} + Tax ${money(order.tax)}`)
          )
        ),
        h('div', { style:{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginTop:'16px'} },
          h('div', { style:{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px'} },
            h('div', { style:{fontSize:'11px', fontWeight:'700', letterSpacing:'.06em', color:'#64748b'} }, 'CUSTOMER — FULL DETAILS'),
            h('div', { style:{fontWeight:'700', marginTop:'8px', color:'#0f172a', fontSize:'14px'} }, customer.name||'—'),
            h('div', { style:{fontSize:'13px', color:'#0f172a', marginTop:'6px'} }, customer.mobile?`📱 ${customer.mobile}`:''),
            h('div', { style:{fontSize:'12px', color:'#334155', marginTop:'4px'} }, customer.email?`✉️ ${customer.email}`:''),
            h('div', { style:{fontSize:'11px', color:'#64748b', marginTop:'8px'} }, `ID: ${customer.id||'—'}`),
            h('div', { style:{fontSize:'11px', color:'#64748b', marginTop:'4px'} }, `Joined: ${customer.created_at? formatDate(customer.created_at): '—'}`),
            h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'4px 8px', fontSize:'11px', marginTop:'10px'}, onclick:()=>{ navigator.clipboard?.writeText(`${customer.name||''} | ${customer.mobile||''} | ${customer.email||''} | ID ${customer.id||''}`); toast('Customer copied','success'); } }, '📋 Copy Customer')
          ),
          h('div', { style:{background:'#fff', border:'2px solid #1e40af', borderRadius:'12px', padding:'16px'} },
            h('div', { style:{fontSize:'11px', fontWeight:'700', letterSpacing:'.06em', color:'#1e40af'} }, 'FULL SHIPPING ADDRESS'),
            addrLines.length ? h('div', { style:{marginTop:'10px', lineHeight:'1.7', color:'#0f172a', fontSize:'13px', background:'#f8fafc', padding:'12px', borderRadius:'8px', border:'1px solid #e2e8f0'} },
              ...addrLines.map(l=> {
                const isBold = l.startsWith('House')||l.startsWith('Landmark')||l.startsWith('Area');
                return h('div', { style:{fontWeight: isBold ? '700' : '400', color:'#0f172a'} }, l);
              }),
              (address.latitude && address.longitude) ? h('a', { href:`https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`, target:'_blank', style:{display:'inline-block', marginTop:'8px', fontSize:'12px', color:'#1e40af', fontWeight:'700'} }, '📍 Open in Google Maps') : null
            ) : h('div',{style:{color:'#94a3b8', marginTop:'8px'}},'No address — ask customer to add address at checkout'),
            h('div', { style:{marginTop:'12px', display:'flex', gap:'8px', flexWrap:'wrap'} },
              h('button', { class:'admin-btn admin-btn-primary', style:{padding:'8px 12px', fontSize:'12px'}, onclick:()=>{ const txt = fullAddr + ` | ${customer.name||''} ${customer.mobile||''}`; navigator.clipboard?.writeText(txt); toast('Full address copied','success'); } }, '📋 Copy Full Address'),
              h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'8px 12px', fontSize:'12px'}, onclick:()=> window.print() }, '🖨️ Print')
            )
          )
        ),
        h('div', { style:{marginTop:'20px'} },
          h('h3', { style:{color:'#0f172a', marginBottom:'12px'} }, `Items (${items.length})`),
          ...items.map(it=>{
            const variant = it.variant||{};
            const isCustom = !!it.customization_data;
            const cust = it.customization||null;
            return h('div', { style:{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px', marginBottom:'12px', borderLeft: isCustom?'4px solid #f59e0b':'4px solid #1e40af'} },
              h('div', { style:{display:'flex', justifyContent:'space-between', gap:'12px'} },
                h('div', { style:{fontWeight:'700', color:'#0f172a'} }, it.name + (isCustom?' ✦ Custom':'')),
                h('div', { style:{fontWeight:'800', color:'#0f172a'} }, money(it.price*it.quantity))
              ),
              variant.color||variant.size? h('div', { style:{fontSize:'12px', color:'#334155', marginTop:'6px', background:'#f1f5f9', padding:'6px 10px', borderRadius:'6px', display:'inline-block'} }, `Color ${variant.color||'—'} • Size ${variant.size||'—'}${variant.fit?' • Fit '+variant.fit:''}`) : null,
              cust? h('div', { style:{background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'8px', padding:'12px', marginTop:'10px'} },
                h('div',{style:{fontWeight:'700', color:'#9a3412', fontSize:'12px'}},'🎨 Custom Design'),
                h('div',{style:{marginTop:'6px', fontSize:'12px', color:'#0f172a'}}, `Front: ${cust.front?.elements?.length||0} • Back: ${cust.back?.elements?.length||0}`),
                ...((cust.front?.elements||[]).slice(0,3).map(e=> e.type==='text'? h('div',{style:{background:'#fff', padding:'8px', borderRadius:'6px', marginTop:'6px', border:'1px solid #e2e8f0', color:'#0f172a'}}, `"${e.value}"`): h('div',{style:{background:'#fff', padding:'6px', borderRadius:'6px', marginTop:'6px'}}, `🖼️ Image`)))
              ):null,
              h('div', { style:{display:'flex', justifyContent:'space-between', marginTop:'10px', fontSize:'13px', color:'#334155'} }, h('span',{}, `Qty ${it.quantity} × ${money(it.price)}`), h('span',{style:{fontWeight:'700', color:'#0f172a'}}, money(it.price*it.quantity)))
            );
          }),
          h('div', { style:{display:'flex', justifyContent:'space-between', padding:'16px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'10px', marginTop:'12px', fontWeight:'700'} },
            h('span',{style:{color:'#64748b'}}, `Subtotal ${money(order.subtotal)} • Discount ${order.discount? money(order.discount): '₹0'} • Tax ${money(order.tax)}`),
            h('span',{style:{fontSize:'20px', color:'#0f172a'}}, money(order.total))
          )
        ),
        h('div', { style:{marginTop:'16px', padding:'16px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px'} },
          h('div', { style:{fontWeight:'700', color:'#0f172a', marginBottom:'10px'} }, 'Update Status — instant reflect'),
          h('div', { style:{display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center'} },
            detailSelect,
            h('button', { class:'admin-btn admin-btn-primary', onclick: async (e)=>{
              const btn=e.currentTarget; const sel=detailSelect; const ns=sel.value; if(ns===order.status){ toast('Already '+ns,'info'); return; } const prev=order.status; btn.disabled=true; const oldText=btn.textContent; btn.textContent='…'; badgeWrap.innerHTML=''; badgeWrap.append(statusBadge(ns));
              try{ await api.post('/admin/orders/'+order.id+'/status', {status:ns}); toast('Status → '+ns,'success'); order.status=ns; sel.value=ns; [...sel.options].forEach(o=> o.selected=o.value===ns);
              }catch(err){ toast(err.message,'error'); badgeWrap.innerHTML=''; badgeWrap.append(statusBadge(prev)); sel.value=prev; [...sel.options].forEach(o=> o.selected=o.value===prev); }
              btn.disabled=false; btn.textContent=oldText;
            } }, 'Update'),
            h('button', { class:'admin-btn admin-btn-ghost', onclick: async ()=>{
              const note=prompt('Add admin note:');
              if(!note) return;
              try{ await api.post('/admin/orders/'+order.id+'/notes', {note}); toast('Note added','success'); }catch(e){ toast(e.message,'error'); }
            } }, 'Add Note')
          ),
          history.length? h('div', { style:{marginTop:'16px'} },
            h('div', { style:{fontWeight:'700', fontSize:'13px', color:'#0f172a', marginBottom:'8px'} }, 'History'),
            h('div', { style:{maxHeight:'160px', overflowY:'auto', border:'1px solid #e2e8f0', borderRadius:'8px', padding:'8px', background:'#f8fafc'} },
              ...history.map(his=> h('div', { style:{fontSize:'12px', padding:'8px', borderBottom:'1px solid #e2e8f0', color:'#0f172a'} }, `${his.to_status} • ${formatDateTime(his.created_at)}${his.note?' • '+his.note:''}${his.changed_by_name?' — by '+his.changed_by_name:''}`))
            )
          ):null
        )
      )
    );
    return adminShell('orders', content);
  }catch(e){
    return adminShell('orders', h('div', { class:'admin-card', style:{padding:'20px', color:'#dc2626'} }, h('h3',{},'Failed to load order'), h('p',{}, e.message), h('a',{href:'#/admin/orders', class:'admin-btn admin-btn-primary'}, 'Back to Orders')));
  }
}

// ── Products ──
async function loadProducts(qp){
  const guard = await guardOrRedirect();
  if (guard && guard.nodeType) return adminShell('products', guard);
  if (!guard) return h('div',{},'Redirecting…');

  const q = qp.q||'';
  const sort = qp.sort||'newest';
  const page = Number(qp.page)||1;
  const limit = 20;
  const container = h('div', { style:{display:'flex', flexDirection:'column', gap:'16px'} });
  const controls = h('div', { class:'admin-search-row' },
    h('input', { class:'admin-input', placeholder:'Search products…', value:q, style:{flex:'1', maxWidth:'320px'}, onkeydown:(e)=>{ if(e.key==='Enter'){ const u=new URLSearchParams(location.hash.split('?')[1]||''); const v=e.target.value.trim(); if(v) u.set('q',v); else u.delete('q'); u.delete('page'); location.hash='#/admin/products'+(u.toString()?'?'+u.toString():''); } } }),
    h('select', { class:'admin-select', onchange:(e)=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); u.set('sort',e.target.value); location.hash='#/admin/products?'+u.toString(); } },
      h('option',{value:'newest', selected:sort==='newest'},'Newest'),
      h('option',{value:'price_low', selected:sort==='price_low'},'Price low'),
      h('option',{value:'price_high', selected:sort==='price_high'},'Price high'),
      h('option',{value:'stock_low', selected:sort==='stock_low'},'Stock low'),
      h('option',{value:'name', selected:sort==='name'},'Name')
    ),
    h('button', { class:'admin-btn admin-btn-primary', onclick:()=> showProductModal() }, '+ Add Product')
  );
  const listWrap = h('div', { class:'admin-card' }, h('div',{style:{padding:'20px', textAlign:'center', color:'#64748b'}},'Loading…'));
  async function render(){
    try{
      const params={ page, limit, sort };
      if(q) params.q=q;
      const { products, total } = await api.get('/admin/products', params);
      listWrap.innerHTML='';
      if(!products.length){ listWrap.append(h('div',{class:'admin-empty'}, h('h3',{},'No products'), h('p',{},'Add your first product'))); return; }
      const table = h('table', { class:'admin-table' },
        h('thead',{}, h('tr',{}, h('th',{},'Product'), h('th',{},'Category'), h('th',{},'Price'), h('th',{},'Stock'), h('th',{},'Status'), h('th',{},''))),
        ...products.map(p=> h('tr',{},
          h('td',{},
            h('div', { style:{display:'flex', gap:'10px', alignItems:'center'} },
              h('img', { src:(p.images&&p.images[0])?resolveImageUrl(p.images[0]):productImage({name:p.name}), alt:p.name, style:{width:'40px', height:'40px', borderRadius:'8px', objectFit:'cover', background:'#f1f5f9'}, onerror:(e)=>imgFallback(e.currentTarget, {name:p.name}) }),
              h('div',{},
                h('div',{style:{fontWeight:'700', fontSize:'13px'}}, p.name),
                h('div',{style:{fontSize:'11px', color:'#64748b'}}, (p.collection||'') + (p.colors?.length?' • '+p.colors.join(', '):''))
              )
            )
          ),
          h('td',{}, p.category_name||'—'),
          h('td',{}, h('div',{style:{fontWeight:'700'}}, money(p.price)), p.mrp>p.price? h('div',{style:{fontSize:'11px', color:'#64748b', textDecoration:'line-through'}}, money(p.mrp)):''),
          h('td',{}, stockBadge(p.stock)),
          h('td',{}, p.active? h('span',{class:'admin-badge admin-badge-delivered'},'Active') : h('span',{class:'admin-badge admin-badge-cancelled'},'Archived')),
          h('td',{},
            h('div', { style:{display:'flex', gap:'6px'} },
              h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'6px 8px', fontSize:'12px'}, onclick:()=> showProductModal(p) }, 'Edit'),
              p.active? h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'6px 8px', fontSize:'12px', color:'#dc2626'}, onclick: async ()=>{
                const ok= await confirmDialog({ title:'Archive product', message:`Deactivate ${p.name}?`, confirmText:'Archive', danger:true });
                if(!ok) return;
                await api.del('/admin/products/'+p.id); toast('Archived','success'); render();
              } }, 'Archive') : h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'6px 8px', fontSize:'12px', color:'#16a34a'}, onclick: async ()=>{ await api.post('/admin/products/'+p.id+'/restore'); toast('Restored','success'); render(); } }, 'Restore')
            )
          )
        ))
      );
      const totalPages=Math.max(1, Math.ceil(total/limit));
      const pagination=h('div',{class:'admin-pagination'},
        h('button',{class:'admin-btn admin-btn-ghost', disabled:page<=1, onclick:()=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); u.set('page',String(page-1)); location.hash='#/admin/products?'+u.toString(); }},'‹ Prev'),
        h('span',{style:{fontSize:'13px'}}, `Page ${page} of ${totalPages} • ${total} products`),
        h('button',{class:'admin-btn admin-btn-ghost', disabled:page>=totalPages, onclick:()=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); u.set('page',String(page+1)); location.hash='#/admin/products?'+u.toString(); }},'Next ›')
      );
      listWrap.append(h('div',{class:'admin-table-wrap'}, table), pagination);
    }catch(e){ listWrap.innerHTML=''; listWrap.append(h('div',{style:{padding:'20px', color:'#dc2626'}}, e.message)); }
  }
  render();
  container.append(controls, listWrap);
  return adminShell('products', container);

  function showProductModal(existing){
    const isEdit = !!existing;
    const toRupees = (paise) => (paise != null && paise !== '') ? String((Number(paise)/100).toString()) : '';
    const name = h('input', { class:'admin-input', placeholder:'ZUNO Essential Tee', value:existing?.name||'' });
    const price = h('input', { class:'admin-input', type:'number', step:'0.01', min:'0', placeholder:'e.g. 1299', value: toRupees(existing?.price) });
    const mrp = h('input', { class:'admin-input', type:'number', step:'0.01', min:'0', placeholder:'e.g. 1799', value: toRupees(existing?.mrp) });
    const stock = h('input', { class:'admin-input', type:'number', placeholder:'Stock', value:existing?.stock??'' });
    const desc = h('textarea', { class:'admin-input', placeholder:'Description', style:{minHeight:'70px'} }, existing?.description||'');
    const colors = h('input', { class:'admin-input', placeholder:'Colors comma-separated (black,white,beige)', value:(existing?.colors||[]).join(', ') });
    const sizes = h('input', { class:'admin-input', placeholder:'Sizes (S,M,L,XL)', value:(existing?.sizes||[]).join(', ') });
    const catSel = h('select', { class:'admin-select' });
    const fabric = h('input', { class:'admin-input', placeholder:'Fabric (100% Cotton)', value:existing?.fabric||'' });
    const collection = h('input', { class:'admin-input', placeholder:'Collection (Essentials)', value:existing?.collection||'' });
    const fit = h('input', { class:'admin-input', placeholder:'Fit (regular, oversized)', value:existing?.fit||'' });

    // Image upload — 1 to 10, preview (min 1 required)
    const imageInput = h('input', { type:'file', accept:'image/*', multiple:true, style:{display:'none'} });
    const imagePreview = h('div', { style:{display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'8px'} });
    let selectedImages = []; // File objects
    let existingImages = existing?.images ? [...existing.images] : [];
    // Video upload
    const videoInput = h('input', { type:'file', accept:'video/*', style:{display:'none'} });
    let selectedVideo = null;
    const videoPreview = h('div', { style:{marginTop:'8px'} });
    if (existing?.video_url) videoPreview.append(h('div', { style:{fontSize:'12px', color:'#334155'} }, `Existing video: `, h('a', { href: existing.video_url, target:'_blank', style:{color:'#1e40af'} }, 'View'), h('span', { style:{marginLeft:'8px', fontSize:'11px', color:'#64748b'} }, '(replace by uploading new)')));

    function refreshImagePreview(){
      imagePreview.innerHTML='';
      // Existing images
      existingImages.forEach((src, idx)=>{
        const wrap = h('div', { style:{position:'relative', width:'70px', height:'70px', borderRadius:'8px', overflow:'hidden', border:'1px solid #e2e8f0'} },
          h('img', { src:resolveImageUrl(src), style:{width:'100%', height:'100%', objectFit:'cover'}, onerror:(e)=>imgFallback(e.currentTarget, {name:'product'}) }),
          h('button', { style:{position:'absolute', top:'2px', right:'2px', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', cursor:'pointer'}, onclick:()=>{ existingImages.splice(idx,1); refreshImagePreview(); } }, '×')
        );
        imagePreview.append(wrap);
      });
      // Selected new files
      selectedImages.forEach((file, idx)=>{
        const url = URL.createObjectURL(file);
        const wrap = h('div', { style:{position:'relative', width:'70px', height:'70px', borderRadius:'8px', overflow:'hidden', border:'1px solid #e2e8f0'} },
          h('img', { src:url, style:{width:'100%', height:'100%', objectFit:'cover'} }),
          h('button', { style:{position:'absolute', top:'2px', right:'2px', background:'rgba(0,0,0,0.6)', color:'#fff', border:'none', borderRadius:'50%', width:'18px', height:'18px', fontSize:'10px', cursor:'pointer'}, onclick:()=>{ selectedImages.splice(idx,1); refreshImagePreview(); } }, '×'),
          h('div', { style:{position:'absolute', bottom:'0', left:'0', right:'0', background:'rgba(30,64,175,0.85)', color:'#fff', fontSize:'8px', textAlign:'center', padding:'1px'} }, 'NEW')
        );
        imagePreview.append(wrap);
      });
      const total = existingImages.length + selectedImages.length;
      const countInfo = imagePreview.parentNode ? imagePreview.parentNode.querySelector('[data-count]') : null;
      if (countInfo) countInfo.textContent = `${total} / 10 images (min 1 required)`;
      if (countInfo) countInfo.style.color = total >= 1 ? '#16a34a' : '#dc2626';
    }

    imageInput.onchange = (e)=>{
      const files = Array.from(e.target.files||[]);
      if (existingImages.length + selectedImages.length + files.length > 10) { toast('Max 10 images', 'error'); return; }
      selectedImages = selectedImages.concat(files);
      refreshImagePreview();
    };
    videoInput.onchange = (e)=>{
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 50*1024*1024) { toast('Video must be <50MB', 'error'); return; }
      selectedVideo = f;
      videoPreview.innerHTML='';
      videoPreview.append(h('div', { style:{padding:'8px', background:'#f1f5f9', borderRadius:'8px', fontSize:'12px'} }, `Selected video: ${f.name} (${(f.size/1024/1024).toFixed(1)} MB) `, h('button', { style:{marginLeft:'8px', fontSize:'11px'}, onclick:()=>{ selectedVideo=null; videoInput.value=''; videoPreview.innerHTML=''; } }, 'Remove')));
    };

    // load categories
    api.get('/categories', { module:'shop' }).then(({categories})=>{
      catSel.append(h('option',{value:''},'Select category'));
      categories.forEach(c=>{
        if(!c.parent_id){
          const opt=h('option',{value:c.id}, c.name);
          if(existing && String(existing.category_id)===String(c.id)) opt.selected=true;
          catSel.append(opt);
          (c.children||[]).forEach(ch=>{
            const o2=h('option',{value:ch.id}, '— '+ch.name);
            if(existing && String(existing.category_id)===String(ch.id)) o2.selected=true;
            catSel.append(o2);
          });
        }
      });
    });

    const saveBtn = h('button', { class:'admin-btn admin-btn-primary', style:{width:'100%', justifyContent:'center', padding:'12px'} }, isEdit?'Update Product':'Create Product');
    const errEl = h('div', { style:{color:'#dc2626', fontSize:'13px', minHeight:'18px', marginTop:'8px'} });

    const priceHint = h('div', { style:{fontSize:'11px', color:'#16a34a', marginTop:'4px', minHeight:'14px'} }, '');
    const mrpHint = h('div', { style:{fontSize:'11px', color:'#64748b', marginTop:'4px', minHeight:'14px'} }, '');
    const updatePriceHints = () => {
      const p = parseFloat(price.value);
      const m = parseFloat(mrp.value);
      if (!isNaN(p) && p > 0) {
        priceHint.textContent = `→ ₹${p.toLocaleString('en-IN')} = ${Math.round(p*100)} paise`;
        if (!isNaN(m) && m > 0 && m < p) { mrpHint.textContent = '⚠ MRP should be ≥ Price'; mrpHint.style.color='#dc2626'; } else { mrpHint.textContent=''; }
        if (!isNaN(m) && m > p) {
          const off = Math.round(((m-p)/m)*100);
          priceHint.textContent += ` • ${off}% OFF`;
        }
      } else priceHint.textContent = '';
      if (!isNaN(m) && m > 0) mrpHint.textContent = mrpHint.textContent || `→ ₹${m.toLocaleString('en-IN')}`;
    };
    price.addEventListener('input', updatePriceHints);
    mrp.addEventListener('input', updatePriceHints);
    setTimeout(updatePriceHints, 120);

    const form = h('div', { style:{maxHeight:'85vh', overflowY:'auto', paddingRight:'4px'} },
      h('div', { style:{background:'linear-gradient(135deg,#0f172a,#1e293b)', color:'#fff', padding:'16px', borderRadius:'12px', marginBottom:'14px'} },
        h('h3',{style:{margin:'0', color:'#fff'}}, isEdit?'✏️ Edit Product':'✨ Add New Product'),
        h('p',{style:{margin:'6px 0 0', color:'#94a3b8', fontSize:'12px'}}, isEdit?'Update details — changes go live instantly in the shop.':'Create a premium ZUNO product — images go live instantly.')
      ),
      h('div', { class:'admin-form-grid', style:{marginTop:'12px'} },
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700', letterSpacing:'0.04em', textTransform:'uppercase', color:'#1e40af'}},'Product Name *'), name),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700', letterSpacing:'0.04em', textTransform:'uppercase', color:'#1e40af'}},'Category *'), catSel),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700', letterSpacing:'0.04em', textTransform:'uppercase'}},'Price (₹) *'), price, priceHint),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700', letterSpacing:'0.04em', textTransform:'uppercase'}},'MRP (₹) *'), mrp, mrpHint),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Stock *'), stock),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Fabric'), fabric),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Fit'), fit),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Collection'), collection)
      ),
      h('div', { style:{marginTop:'12px'} }, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Description'), desc),
      h('div', { style:{marginTop:'12px'} }, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Colors'), colors),
      h('div', { style:{marginTop:'8px'} }, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Sizes'), sizes),
      h('div', { style:{marginTop:'12px', padding:'12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'10px'} },
        h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center'} },
          h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Product Images * (1–10)'),
          h('span', { 'data-count': true, style:{fontSize:'11px', color:'#64748b', fontWeight:'700'} }, `${existingImages.length} / 10 images (min 1 required)`)
        ),
        h('p', { style:{fontSize:'11px', color:'#64748b', marginTop:'4px'} }, 'Add 1–10 images: front, back, side views. JPG/PNG/WebP, max 5MB each. At least 1 image required. Images are visible instantly on the ZUNO store.'),
        h('div', { style:{display:'flex', gap:'8px', marginTop:'8px'} },
          h('button', { class:'admin-btn admin-btn-ghost', type:'button', onclick:()=> imageInput.click() }, '📷 Choose Images'),
          h('button', { class:'admin-btn admin-btn-ghost', type:'button', onclick:()=>{ selectedImages=[]; existingImages = existing?.images ? [...existing.images] : []; refreshImagePreview(); } }, 'Reset')
        ),
        imageInput,
        imagePreview
      ),
      h('div', { style:{marginTop:'12px', padding:'12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'10px'} },
        h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Product Video (optional)'),
        h('p', { style:{fontSize:'11px', color:'#64748b', marginTop:'4px'} }, 'Upload 1 video: 360° view or model walk. MP4/WebM, max 50MB.'),
        h('div', { style:{display:'flex', gap:'8px', marginTop:'8px'} },
          h('button', { class:'admin-btn admin-btn-ghost', type:'button', onclick:()=> videoInput.click() }, '🎥 Choose Video'),
          existing?.video_url ? h('a', { href: existing.video_url, target:'_blank', class:'admin-btn admin-btn-ghost', style:{fontSize:'12px'} }, 'View existing') : null
        ),
        videoInput,
        videoPreview
      ),
      errEl,
      h('div', { style:{marginTop:'12px'} }, saveBtn)
    );
    // Initial preview
    setTimeout(refreshImagePreview, 50);

    const m = modal(form);
    // single handler: rupees → paise conversion + min 1 image
    saveBtn.onclick = async ()=>{
      errEl.textContent='';
      if(!name.value.trim()){ errEl.textContent='Name required'; return; }
      if(!catSel.value){ errEl.textContent='Category required'; return; }
      const priceRupees = parseFloat(price.value);
      const mrpRupees = parseFloat(mrp.value);
      const sVal = Number(stock.value);
      if(isNaN(priceRupees) || priceRupees <= 0){ errEl.textContent='Enter valid Price in rupees (e.g. 1299)'; return; }
      if(isNaN(mrpRupees) || mrpRupees <= 0){ errEl.textContent='Enter valid MRP in rupees (e.g. 1799)'; return; }
      if(mrpRupees < priceRupees){ errEl.textContent='MRP must be ≥ Price'; return; }
      if(isNaN(sVal) || sVal < 0){ errEl.textContent='Enter valid Stock'; return; }
      const pVal = Math.round(priceRupees * 100);
      const mVal = Math.round(mrpRupees * 100);
      const totalImages = existingImages.length + selectedImages.length;
      if (!isEdit && totalImages < 1) { errEl.textContent='At least 1 image required'; toast('Upload at least 1 image', 'error'); return; }
      if (isEdit && totalImages < 1) { errEl.textContent='At least 1 image required — add an image or keep existing'; toast('At least 1 image required', 'error'); return; }
      if (totalImages > 10) { errEl.textContent='Maximum 10 images allowed'; return; }

      const fd = new FormData();
      fd.append('name', name.value.trim());
      fd.append('categoryId', catSel.value);
      fd.append('price', String(pVal));
      fd.append('mrp', String(mVal));
      fd.append('stock', String(sVal));
      fd.append('description', desc.value.trim());
      fd.append('colors', colors.value);
      fd.append('sizes', sizes.value);
      fd.append('fabric', fabric.value.trim());
      fd.append('collection', collection.value.trim());
      fd.append('fit', fit.value.trim());
      if (existingImages.length) fd.append('imageUrls', JSON.stringify(existingImages));
      selectedImages.forEach(f => fd.append('images', f));
      if (selectedVideo) fd.append('video', selectedVideo);
      else if (existing?.video_url) fd.append('videoUrl', existing.video_url);
      try{
        saveBtn.disabled=true; saveBtn.textContent= isEdit?'Saving…':'Creating…';
        if(!isEdit){
          await api.post('/admin/products', fd);
          try { api.clearCache && api.clearCache(); } catch {}
          toast('Product created — now visible in shop','success'); m.close(); location.hash='#/admin/products'; setTimeout(()=> location.reload(),400);
        } else {
          // Use raw fetch for PUT with FormData to avoid JSON header
          const token = Store.getToken();
          const API = (localStorage.getItem('ZUNO_API_BASE') || window.ZUNO_API_BASE || '').replace(/\/$/,'') + ((localStorage.getItem('ZUNO_API_BASE')||window.ZUNO_API_BASE||'').replace(/\/$/,'').endsWith('/api')?'':'/api') || '/api';
          const base = API || '/api';
          const res = await fetch(base + '/admin/products/'+existing.id, { method:'PUT', headers: token ? { 'Authorization':'Bearer '+token } : {}, body: fd });
          let data=null; try{ data=await res.json(); }catch{}
          if(!res.ok || data.success===false) throw new Error(data?.message || 'Update failed');
          try { api.clearCache && api.clearCache(); } catch {}
          toast('Updated — changes visible in shop','success'); m.close(); render();
        }
      }catch(e){ errEl.textContent=e.message; saveBtn.disabled=false; saveBtn.textContent= isEdit?'Update Product':'Create Product'; }
    };
  }
}

// ── Inventory ──
async function loadInventory(qp){
  const guard = await guardOrRedirect();
  if (guard && guard.nodeType) return adminShell('inventory', guard);
  if (!guard) return h('div',{},'Redirecting…');
  const q = qp.q||'';
  const filter = qp.filter||'';
  const page = Number(qp.page)||1;
  const limit = 20;
  const sort = qp.sort||'stock_low';

  const summaryRow = h('div', { class:'admin-cards' });
  const tableWrap = h('div', { class:'admin-card' }, h('div',{style:{padding:'20px', textAlign:'center', color:'#64748b'}},'Loading…'));
  const controls = h('div', { class:'admin-search-row' },
    h('input', { class:'admin-input', placeholder:'Search product…', value:q, style:{flex:'1', maxWidth:'300px'}, onkeydown:(e)=>{ if(e.key==='Enter'){ const u=new URLSearchParams(location.hash.split('?')[1]||''); const v=e.target.value.trim(); if(v) u.set('q',v); else u.delete('q'); u.delete('page'); location.hash='#/admin/inventory'+(u.toString()?'?'+u.toString():''); } } }),
    h('select', { class:'admin-select', value:filter, onchange:(e)=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); if(e.target.value) u.set('filter',e.target.value); else u.delete('filter'); u.delete('page'); location.hash='#/admin/inventory'+(u.toString()?'?'+u.toString():''); } },
      h('option',{value:'', selected:!filter},'All stock'),
      h('option',{value:'low', selected:filter==='low'},'Low (≤10)'),
      h('option',{value:'out', selected:filter==='out'},'Out of stock'),
      h('option',{value:'in', selected:filter==='in'},'In stock')
    ),
    h('select', { class:'admin-select', value:sort, onchange:(e)=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); u.set('sort',e.target.value); location.hash='#/admin/inventory?'+u.toString(); } },
      h('option',{value:'stock_low', selected:sort==='stock_low'},'Stock low→high'),
      h('option',{value:'stock_high', selected:sort==='stock_high'},'Stock high→low'),
      h('option',{value:'name', selected:sort==='name'},'Name')
    )
  );

  async function render(){
    try{
      const params={ page, limit, sort };
      if(q) params.q=q;
      if(filter) params.filter=filter;
      const { inventory, total, summary } = await api.get('/admin/inventory', params);
      summaryRow.innerHTML='';
      summaryRow.append(
        statCard('▦','In Stock', String(summary.inStock), 'stock >10'),
        statCard('⚠','Low Stock', String(summary.low), '≤10 items'),
        statCard('✕','Out of Stock', String(summary.out), 'needs restock'),
        statCard('▭','Total', String(summary.total), 'active products')
      );
      tableWrap.innerHTML='';
      if(!inventory.length){ tableWrap.append(h('div',{class:'admin-empty'}, h('h3',{},'No products'), h('p',{},'No inventory matches filter'))); return; }
      const table = h('table', { class:'admin-table' },
        h('thead',{}, h('tr',{}, h('th',{},'Product'), h('th',{},'Category'), h('th',{},'Price'), h('th',{},'Stock'), h('th',{},'Update'))),
        ...inventory.map(p=>{
          const stockInput = h('input', { class:'admin-input', type:'number', value:String(p.stock), style:{width:'90px'} });
          const saveBtn = h('button', { class:'admin-btn admin-btn-primary', style:{padding:'7px 10px', fontSize:'12px'} }, 'Save');
          saveBtn.onclick = async ()=>{
            const v = Number(stockInput.value);
            if(Number.isNaN(v)||v<0){ toast('Invalid stock','error'); return; }
            saveBtn.disabled=true; saveBtn.textContent='…';
            try{ await api.raw('PATCH','/admin/inventory/'+p.id, { body:{stock:v} }); toast('Stock updated','success'); p.stock=v; render(); }catch(e){ toast(e.message,'error'); saveBtn.disabled=false; saveBtn.textContent='Save'; }
          };
          return h('tr',{},
            h('td',{},
              h('div', { style:{display:'flex', gap:'10px', alignItems:'center'} },
                h('img', { src:(p.images&&p.images[0])?resolveImageUrl(p.images[0]):productImage({name:p.name}), style:{width:'36px', height:'36px', borderRadius:'8px', background:'#f1f5f9', objectFit:'cover'}, onerror:(e)=>imgFallback(e.currentTarget, {name:p.name})} ),
                h('div',{}, h('div',{style:{fontWeight:'700', fontSize:'13px'}}, p.name), h('div',{style:{fontSize:'11px', color:'#64748b'}}, (p.colors||[]).slice(0,3).join(', ')||''))
              )
            ),
            h('td',{}, p.category_name||'—'),
            h('td',{}, money(p.price)),
            h('td',{}, stockBadge(p.stock)),
            h('td',{}, h('div', { style:{display:'flex', gap:'6px', alignItems:'center'} }, stockInput, saveBtn))
          );
        })
      );
      const totalPages=Math.max(1, Math.ceil(total/limit));
      const pagination=h('div',{class:'admin-pagination'},
        h('button',{class:'admin-btn admin-btn-ghost', disabled:page<=1, onclick:()=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); u.set('page',String(page-1)); location.hash='#/admin/inventory?'+u.toString(); }},'‹ Prev'),
        h('span',{style:{fontSize:'13px'}}, `Page ${page} of ${totalPages} • ${total} items`),
        h('button',{class:'admin-btn admin-btn-ghost', disabled:page>=totalPages, onclick:()=>{ const u=new URLSearchParams(location.hash.split('?')[1]||''); u.set('page',String(page+1)); location.hash='#/admin/inventory?'+u.toString(); }},'Next ›')
      );
      tableWrap.append(h('div',{class:'admin-table-wrap'}, table), pagination);
    }catch(e){ tableWrap.innerHTML=''; tableWrap.append(h('div',{style:{padding:'20px', color:'#dc2626'}}, e.message)); }
  }
  render();
  return adminShell('inventory', h('div', { style:{display:'flex', flexDirection:'column', gap:'16px'} }, summaryRow, controls, tableWrap));
}

// ── Customers ──
async function loadCustomers(){
  const guard = await guardOrRedirect();
  if (guard && guard.nodeType) return adminShell('customers', guard);
  if (!guard) return h('div',{},'Redirecting…');
  const wrap = h('div', { class:'admin-card' }, h('div',{style:{padding:'20px', textAlign:'center'}},'Loading…'));
  (async ()=>{
    try{
      const { users } = await api.get('/admin/users');
      wrap.innerHTML='';
      const table=h('table',{class:'admin-table'},
        h('thead',{}, h('tr',{}, h('th',{},'Customer'), h('th',{},'Contact'), h('th',{},'Role'), h('th',{},'Status'), h('th',{},'Joined'))),
        ...users.map(u=> h('tr',{},
          h('td',{}, h('div',{style:{fontWeight:'700'}}, u.name), h('div',{style:{fontSize:'11px', color:'#64748b'}}, 'ID '+u.id)),
          h('td',{}, h('div',{}, u.email||'—'), h('div',{style:{fontSize:'11px', color:'#64748b'}}, u.mobile||'')),
          h('td',{}, u.role_id===2? h('span',{class:'admin-badge admin-badge-confirmed'},'ADMIN'): h('span',{class:'admin-badge admin-badge-paid'},'USER')),
          h('td',{}, u.status==='active'? h('span',{class:'admin-badge admin-badge-delivered'},'active'): h('span',{class:'admin-badge admin-badge-cancelled'}, u.status)),
          h('td',{}, formatDate(u.created_at))
        ))
      );
      wrap.append(h('div',{class:'admin-card__head'}, h('div',{class:'admin-card__title'}, `Customers (${users.length})`)), h('div',{class:'admin-table-wrap'}, table));
    }catch(e){ wrap.innerHTML=''; wrap.append(h('div',{style:{padding:'20px', color:'#dc2626'}}, e.message)); }
  })();
  return adminShell('customers', wrap);
}

// ── Admin Profile ──
async function loadAdminProfile(){
  const guard = await guardOrRedirect();
  if (guard && guard.nodeType) return adminShell('profile', guard);
  if (!guard) return h('div',{},'Redirecting…');
  const user = Store.getUser();
  const nameI = h('input', { class:'admin-input', value:user.name||'', style:{width:'100%'} });
  const emailI = h('input', { class:'admin-input', value:user.email||'', style:{width:'100%'} });
  const mobileI = h('input', { class:'admin-input', value:user.mobile||'', style:{width:'100%'} });
  const msg = h('div', { style:{fontSize:'13px', minHeight:'18px', marginTop:'8px'} });
  const saveBtn = h('button', { class:'admin-btn admin-btn-primary', style:{padding:'10px 18px'} }, 'Save Changes');
  saveBtn.onclick = async ()=>{
    msg.textContent=''; msg.style.color='#64748b';
    const name = nameI.value.trim(); const email = emailI.value.trim(); const mobile = mobileI.value.trim();
    if (!name || name.length<2){ msg.textContent='Name must be at least 2 characters'; msg.style.color='#dc2626'; return; }
    saveBtn.disabled=true; saveBtn.textContent='Saving…';
    try{
      const { user: updated } = await api.put('/users/profile', { name, email: email||undefined, mobile: mobile||undefined });
      Store.setUser(updated);
      toast('Profile updated','success');
      msg.textContent='✓ Profile updated successfully'; msg.style.color='#16a34a';
      setTimeout(()=> location.hash='#/admin', 600);
    }catch(e){ msg.textContent=e.message; msg.style.color='#dc2626'; toast(e.message,'error'); }
    saveBtn.disabled=false; saveBtn.textContent='Save Changes';
  };
  const content = h('div', { style:{maxWidth:'560px'} },
    h('div', { class:'admin-card', style:{padding:'24px'} },
      h('div', { style:{display:'flex', gap:'16px', alignItems:'center', marginBottom:'20px'} },
        h('div', { style:{width:'64px', height:'64px', borderRadius:'50%', background:'#1e40af', color:'#fff', display:'grid', placeItems:'center', fontSize:'22px', fontWeight:'800'} }, (user.name||'A').slice(0,2).toUpperCase()),
        h('div', {},
          h('div', { style:{fontWeight:'800', fontSize:'16px', color:'#0f172a'} }, user.name),
          h('div', { style:{fontSize:'12px', color:'#64748b'} }, user.email||user.mobile),
          h('span', { class:'admin-badge admin-badge-confirmed', style:{marginTop:'6px'} }, user.role||'ADMIN')
        )
      ),
      h('div', { style:{display:'flex', flexDirection:'column', gap:'14px'} },
        h('div', {}, h('label', { style:{fontSize:'12px', fontWeight:'700', color:'#334155'} }, 'Full Name'), nameI),
        h('div', {}, h('label', { style:{fontSize:'12px', fontWeight:'700', color:'#334155'} }, 'Email (official)'), emailI, h('div',{style:{fontSize:'11px', color:'#64748b', marginTop:'4px'}}, 'Use your official email like zunoworld3121@gmail.com')),
        h('div', {}, h('label', { style:{fontSize:'12px', fontWeight:'700', color:'#334155'} }, 'Mobile'), mobileI),
        msg,
        h('div', { style:{display:'flex', gap:'10px', marginTop:'8px'} }, saveBtn, h('a', { href:'#/admin', class:'admin-btn admin-btn-ghost' }, 'Cancel'), h('a', { href:'#/admin/password', class:'admin-btn admin-btn-ghost' }, 'Change Password →'))
      ),
      h('div', { style:{marginTop:'20px', padding:'12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'10px', fontSize:'12px', color:'#64748b'} },
        h('div',{style:{fontWeight:'700', color:'#0f172a'}}, 'Account Info'),
        h('div',{style:{marginTop:'6px'}}, `ID: ${user.id} • Status: ${user.status} • Role: ${user.role}`),
        h('div',{style:{marginTop:'4px'}}, `Created: ${formatDate(user.created_at||user.createdAt||new Date())}`)
      )
    )
  );
  return adminShell('profile', content);
}
async function loadAdminPassword(){
  const guard = await guardOrRedirect();
  if (guard && guard.nodeType) return adminShell('password', guard);
  if (!guard) return h('div',{},'Redirecting…');
  const curI = h('input', { class:'admin-input', type:'password', placeholder:'Current password', style:{width:'100%'} });
  const newI = h('input', { class:'admin-input', type:'password', placeholder:'New password (min 8 chars)', style:{width:'100%'} });
  const confI = h('input', { class:'admin-input', type:'password', placeholder:'Confirm new password', style:{width:'100%'} });
  const msg = h('div', { style:{fontSize:'13px', minHeight:'18px', marginTop:'8px'} });
  const btn = h('button', { class:'admin-btn admin-btn-primary', style:{padding:'10px 18px', width:'100%', justifyContent:'center'} }, 'Update Password');
  btn.onclick = async ()=>{
    msg.textContent=''; msg.style.color='#64748b';
    const cur = curI.value; const nw = newI.value; const cf = confI.value;
    if (!cur || !nw || !cf){ msg.textContent='Fill all fields'; msg.style.color='#dc2626'; return; }
    if (nw.length<8){ msg.textContent='New password must be at least 8 characters'; msg.style.color='#dc2626'; return; }
    if (nw!==cf){ msg.textContent='New passwords do not match'; msg.style.color='#dc2626'; return; }
    btn.disabled=true; btn.textContent='Updating…';
    try{
      await api.post('/users/change-password', { currentPassword: cur, newPassword: nw });
      toast('Password updated — please login again','success');
      msg.textContent='✓ Password updated! Please login again with new password.'; msg.style.color='#16a34a';
      curI.value=''; newI.value=''; confI.value='';
      setTimeout(()=>{ Store.setToken(null); Store.setUser(null); location.hash='#/admin/login'; }, 1200);
    }catch(e){ msg.textContent=e.message; msg.style.color='#dc2626'; toast(e.message,'error'); }
    btn.disabled=false; btn.textContent='Update Password';
  };
  const content = h('div', { style:{maxWidth:'520px'} },
    h('div', { class:'admin-card', style:{padding:'24px'} },
      h('h2', { style:{margin:'0 0 6px', color:'#0f172a'} }, 'Reset Password'),
      h('p', { class:'muted', style:{fontSize:'13px', marginBottom:'16px'} }, 'Change your admin password. Use a strong password with 8+ characters.'),
      h('div', { style:{display:'flex', flexDirection:'column', gap:'12px'} },
        h('div', {}, h('label',{style:{fontSize:'12px', fontWeight:'700', color:'#334155'}}, 'Current Password'), curI),
        h('div', {}, h('label',{style:{fontSize:'12px', fontWeight:'700', color:'#334155'}}, 'New Password'), newI),
        h('div', {}, h('label',{style:{fontSize:'12px', fontWeight:'700', color:'#334155'}}, 'Confirm New Password'), confI),
        msg, btn,
        h('a', { href:'#/admin/profile', class:'admin-btn admin-btn-ghost', style:{justifyContent:'center'} }, '← Back to Profile')
      )
    )
  );
  return adminShell('password', content);
}

// ── Admin Forgot Password ──
export function AdminForgotPassword() {
  const root = h('div', { class:'admin-login-wrap' });
  const card = h('div', { class:'admin-login-card' });
  const emailI = h('input', { class:'admin-input', type:'email', placeholder:'admin@zuno.app', style:{width:'100%'} });
  const msg = h('div', { style:{fontSize:'13px', minHeight:'18px', marginTop:'8px'} });
  const btn = h('button', { class:'admin-btn admin-btn-primary', style:{width:'100%', justifyContent:'center', padding:'12px', fontSize:'14px'} }, 'Send Reset Link');

  const previewBox = h('div', { style:{display:'none', marginTop:'10px', padding:'12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', fontSize:'12px', lineHeight:'1.5'} });
  btn.onclick = async () => {
    msg.textContent=''; msg.style.color='#64748b'; previewBox.style.display='none'; previewBox.innerHTML='';
    const email = emailI.value.trim();
    if (!email) { msg.textContent='Email is required'; msg.style.color='#dc2626'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent='Enter a valid email address'; msg.style.color='#dc2626'; return; }
    btn.disabled=true; btn.textContent='Sending…';
    try {
      const data = await api.post('/admin/forgot-password', { email }, { auth:false });
      msg.textContent = data?.message || 'If an admin account exists with this email, a password reset link has been sent.';
      msg.style.color='#16a34a';
      toast(msg.textContent,'success');
      // Dev helper: if previewUrl returned (non-prod), show clickable link for instant testing when inbox delayed
      const preview = data && data.previewUrl;
      if (preview) {
        previewBox.style.display='block';
        previewBox.append(
          h('div', { style:{fontWeight:'700', color:'#166534', marginBottom:'6px'} }, 'Dev preview link (use if mail delayed):'),
          h('a', { href: preview.startsWith('http') ? preview : preview, style:{wordBreak:'break-all', color:'#1e40af', fontWeight:'600', fontSize:'11px'} }, preview),
          h('div', { style:{color:'#64748b', fontSize:'11px', marginTop:'6px'} }, 'This link expires in 30 min and is one-time use. Check Spam/Promotions if inbox empty.')
        );
      }
    } catch(e){ msg.textContent=e.message; msg.style.color='#dc2626'; toast(e.message,'error'); }
    btn.disabled=false; btn.textContent='Send Reset Link';
  };

  card.append(
    h('div', { class:'admin-login-brand' }, h('div',{class:'logo'},'Z'), h('div',{style:{fontWeight:'800'}},'ZUNO ADMIN')),
    h('h2', { style:{textAlign:'center', marginBottom:'4px'} }, 'Forgot your password?'),
    h('p', { class:'muted', style:{textAlign:'center', fontSize:'13px', marginBottom:'16px', lineHeight:'1.5'} }, "Enter your admin email address and we'll send you a secure password reset link."),
    h('div', { style:{display:'flex', flexDirection:'column', gap:'12px'} },
      h('div', {}, h('label', { style:{fontSize:'12px', fontWeight:'700', color:'#334155'} }, 'Admin Email'), emailI),
      msg, btn, previewBox,
      h('div', { style:{textAlign:'center', marginTop:'4px'} }, h('a', { href:'#/admin/login', style:{fontSize:'13px', color:'#64748b'} }, '← Back to Login'))
    )
  );
  root.append(card);
  emailI.addEventListener('keydown', (e)=>{ if(e.key==='Enter') btn.click(); });
  return root;
}

// ── Admin Reset Password ──
export function AdminResetPassword() {
  // Token from hash query ?token=xxx
  const hashQ = location.hash.split('?')[1]||'';
  const params = new URLSearchParams(hashQ);
  let token = params.get('token') || '';
  // Also support ?token in location.search for direct /admin/reset-password?token=xxx
  if (!token) {
    try { token = new URLSearchParams(location.search).get('token') || ''; } catch {}
  }

  const root = h('div', { class:'admin-login-wrap' });
  const card = h('div', { class:'admin-login-card' });

  if (!token) {
    card.append(
      h('div', { class:'admin-login-brand' }, h('div',{class:'logo'},'Z'), h('div',{style:{fontWeight:'800'}},'ZUNO ADMIN')),
      h('h2', { style:{textAlign:'center', marginBottom:'8px', color:'#dc2626'} }, 'Invalid Reset Link'),
      h('p', { class:'muted', style:{textAlign:'center', fontSize:'13px', marginBottom:'16px'} }, 'This password reset link is invalid.'),
      h('div', { style:{textAlign:'center'} }, h('a', { href:'#/admin/forgot-password', class:'admin-btn admin-btn-primary', style:{justifyContent:'center'} }, 'Request a new reset link')),
      h('div', { style:{textAlign:'center', marginTop:'12px'} }, h('a', { href:'#/admin/login', style:{fontSize:'13px', color:'#64748b'} }, '← Back to Admin Login'))
    );
    root.append(card);
    return root;
  }

  const pwI = h('input', { class:'admin-input', type:'password', placeholder:'At least 8 chars, 1 upper, 1 lower, 1 number', style:{width:'100%'} });
  const confI = h('input', { class:'admin-input', type:'password', placeholder:'Confirm new password', style:{width:'100%'} });
  const showToggle = h('label', { style:{display:'flex', gap:'6px', alignItems:'center', fontSize:'12px', color:'#64748b', cursor:'pointer'} },
    h('input', { type:'checkbox', onchange:(e)=>{ pwI.type = e.target.checked ? 'text' : 'password'; confI.type = e.target.checked ? 'text' : 'password'; } }), ' Show passwords');
  const msg = h('div', { style:{fontSize:'13px', minHeight:'18px', marginTop:'8px'} });
  const btn = h('button', { class:'admin-btn admin-btn-primary', style:{width:'100%', justifyContent:'center', padding:'12px', fontSize:'14px'} }, 'Reset Password');
  const hint = h('div', { style:{fontSize:'11px', color:'#64748b', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'8px', padding:'10px', lineHeight:'1.5'} },
    h('div',{style:{fontWeight:'700', color:'#334155'}}, 'Password requirements:'),
    h('div',{}, '• Minimum 8 characters • At least one uppercase • One lowercase • One number'));

  const successView = h('div', { style:{display:'none', textAlign:'center'} },
    h('div', { style:{fontSize:'40px', marginBottom:'8px'} }, '✅'),
    h('h3', { style:{color:'#16a34a', marginBottom:'8px'} }, 'Password reset successful.'),
    h('p', { class:'muted', style:{fontSize:'13px', marginBottom:'16px'} }, 'Your password has been reset successfully. You can now log in with your new password.'),
    h('a', { href:'#/admin/login', class:'admin-btn admin-btn-primary', style:{justifyContent:'center'} }, 'Back to Admin Login')
  );

  btn.onclick = async () => {
    msg.textContent=''; msg.style.color='#64748b';
    const pw = pwI.value; const cf = confI.value;
    if (!pw) { msg.textContent='Password is required'; msg.style.color='#dc2626'; return; }
    if (pw.length < 8) { msg.textContent='Password must be at least 8 characters'; msg.style.color='#dc2626'; return; }
    if (!/[A-Z]/.test(pw)) { msg.textContent='Password must contain at least one uppercase letter'; msg.style.color='#dc2626'; return; }
    if (!/[a-z]/.test(pw)) { msg.textContent='Password must contain at least one lowercase letter'; msg.style.color='#dc2626'; return; }
    if (!/[0-9]/.test(pw)) { msg.textContent='Password must contain at least one number'; msg.style.color='#dc2626'; return; }
    if (!cf) { msg.textContent='Confirm password is required'; msg.style.color='#dc2626'; return; }
    if (pw !== cf) { msg.textContent='Passwords must match'; msg.style.color='#dc2626'; return; }
    btn.disabled=true; btn.textContent='Resetting…';
    try {
      const data = await api.post('/admin/reset-password', { token, password: pw }, { auth:false });
      // Hide form, show success
      formWrap.style.display='none';
      successView.style.display='block';
      toast(data?.message || 'Password reset successful','success');
    } catch(e){
      const m = e.message || 'Reset failed';
      if (m.toLowerCase().includes('invalid')) {
        msg.textContent='This password reset link is invalid.'; msg.style.color='#dc2626';
        msg.append(h('div', { style:{marginTop:'8px'} }, h('a', { href:'#/admin/forgot-password', style:{color:'#1e40af', fontWeight:'600'} }, 'Request a new reset link')));
      } else if (m.toLowerCase().includes('expired')) {
        msg.textContent='This password reset link has expired.'; msg.style.color='#dc2626';
        msg.append(h('div', { style:{marginTop:'8px'} }, h('a', { href:'#/admin/forgot-password', style:{color:'#1e40af', fontWeight:'600'} }, 'Request a new reset link')));
      } else {
        msg.textContent=m; msg.style.color='#dc2626';
      }
      toast(m,'error');
    }
    btn.disabled=false; btn.textContent='Reset Password';
  };

  const formWrap = h('div', { style:{display:'flex', flexDirection:'column', gap:'12px'} },
    h('div', {}, h('label', { style:{fontSize:'12px', fontWeight:'700', color:'#334155'} }, 'New Password'), pwI),
    h('div', {}, h('label', { style:{fontSize:'12px', fontWeight:'700', color:'#334155'} }, 'Confirm New Password'), confI),
    showToggle, hint, msg, btn,
    h('div', { style:{textAlign:'center', marginTop:'4px'} }, h('a', { href:'#/admin/login', style:{fontSize:'13px', color:'#64748b'} }, '← Back to Admin Login'))
  );

  card.append(
    h('div', { class:'admin-login-brand' }, h('div',{class:'logo'},'Z'), h('div',{style:{fontWeight:'800'}},'ZUNO ADMIN')),
    h('h2', { style:{textAlign:'center', marginBottom:'4px'} }, 'Set New Password'),
    h('p', { class:'muted', style:{textAlign:'center', fontSize:'13px', marginBottom:'16px'} }, 'Create a strong password for your admin account.'),
    formWrap, successView
  );
  root.append(card);
  return root;
}

// ── Routed entry points ──
export async function Admin() {
  // Compatibility: old #/admin without subroute → overview
  return loadOverview();
}
export async function AdminDashboard() { return loadOverview(); }
export async function AdminOrders(ctx) {
  // if ctx.params.id present -> detail? but we use modal, keep list
  const qp = ctx ? ctx.query : {};
  // parse hash query manually if needed
  const hashQ = location.hash.split('?')[1]||'';
  const parsed={};
  new URLSearchParams(hashQ).forEach((v,k)=> parsed[k]=v);
  return loadOrders(parsed);
}
export async function AdminProducts(ctx){
  const hashQ = location.hash.split('?')[1]||'';
  const parsed={};
  new URLSearchParams(hashQ).forEach((v,k)=> parsed[k]=v);
  return loadProducts(parsed);
}
export async function AdminInventory(ctx){
  const hashQ = location.hash.split('?')[1]||'';
  const parsed={};
  new URLSearchParams(hashQ).forEach((v,k)=> parsed[k]=v);
  return loadInventory(parsed);
}
export async function AdminCustomers(){ return loadCustomers(); }
export async function AdminProfile(){ return loadAdminProfile(); }
export async function AdminPassword(){ return loadAdminPassword(); }
