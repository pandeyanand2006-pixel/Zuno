import { h, money, toast, emptyState, modal, confirmDialog } from '../ui.js';
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
      h('div', { style:{flex:'1'}}),
      h('a', { class:'admin-sidebar__link', href:'#/', style:{color:'#64748b'} }, h('span',{class:'ic'},'←'), 'Back to Store'),
      h('a', { class:'admin-sidebar__link', href:'#/admin/login', onclick:(e)=>{ e.preventDefault(); Store.setToken(null); Store.setUser(null); location.hash='#/admin/login'; } }, h('span',{class:'ic'},'↪'), 'Logout')
    ),
    h('div', { class:'admin-sidebar__footer' },
      h('div', { style:{fontSize:'12px', fontWeight:'700', color:'#e2e8f0'} }, user ? user.name : 'Admin'),
      h('div', { style:{fontSize:'11px', color:'#64748b', marginTop:'2px'} }, user ? (user.email||user.mobile) : ''))
  );

  const overlay = h('div', { class:'admin-overlay', id:'adminOverlay', onclick:()=>{ sidebar.classList.remove('open'); overlay.classList.remove('open'); } });

  const topTitleMap = { overview:'Dashboard', orders:'Orders', products:'Products', inventory:'Inventory', customers:'Customers' };
  const searchInput = h('input', { placeholder:'Search orders, products…', onkeydown:(e)=>{ if(e.key==='Enter'){ const v=e.target.value.trim(); if(!v) return; if(activeKey==='orders') location.hash='#/admin/orders?q='+encodeURIComponent(v); else if(activeKey==='products') location.hash='#/admin/products?q='+encodeURIComponent(v); else location.hash='#/admin/orders?q='+encodeURIComponent(v); } } });

  const topbar = h('div', { class:'admin-topbar' },
    h('button', { class:'admin-mobile-toggle', onclick:()=>{ sidebar.classList.toggle('open'); overlay.classList.toggle('open'); } }, '☰'),
    h('div', { class:'admin-topbar__title' }, topTitleMap[activeKey]||'Admin'),
    h('div', { class:'admin-topbar__search' }, h('span',{class:'s-ic'},'⌕'), searchInput),
    h('div', { style:{marginLeft:'auto', display:'flex', gap:'8px', alignItems:'center'} },
      h('span', { style:{fontSize:'12px', color:'#64748b'} }, user?user.name:''),
      h('span', { style:{width:'32px', height:'32px', borderRadius:'50%', background:'#1e40af', color:'#fff', display:'grid', placeItems:'center', fontSize:'12px', fontWeight:'700'} }, (user?.name||'A').slice(0,2).toUpperCase())
    )
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
      h('div', {}, h('label', { style:{fontSize:'12px', fontWeight:'700', color:'#334155'} }, 'Password'), pwF),
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
  const controls = h('div', { class:'admin-search-row' },
    h('div', { style:{position:'relative', flex:'1', maxWidth:'320px'} },
      h('span', { style:{position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'} }, '⌕'),
      h('input', { class:'admin-input', placeholder:'Search order #, customer, mobile…', value:q, style:{width:'100%', paddingLeft:'32px'}, onkeydown:(e)=>{ if(e.key==='Enter'){ const v=e.target.value.trim(); const u=new URLSearchParams(location.hash.split('?')[1]||''); if(v) u.set('q',v); else u.delete('q'); u.delete('page'); location.hash='#/admin/orders'+(u.toString()?'?'+u.toString():''); } } })
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
      const { orders, total } = await api.get('/admin/orders', params);
      listWrap.innerHTML='';
      if(!orders.length){
        listWrap.append(h('div', { class:'admin-empty' }, h('div', {style:{fontSize:'36px'}},'📭'), h('h3',{},'No orders'), h('p',{},'Try adjusting search or filters')));
        return;
      }
      const table = h('table', { class:'admin-table' },
        h('thead',{}, h('tr',{}, h('th',{},'Order / Customer'), h('th',{},'Total'), h('th',{},'Status'), h('th',{},'Date'), h('th',{},'Action'))),
        ...orders.map(o=> h('tr', {},
          h('td',{},
            h('div', { style:{fontWeight:'700', color:'#0f172a'} }, o.order_number),
            h('div', { style:{fontSize:'12px', color:'#0f172a', fontWeight:'600'} }, o.customer_name||'Guest'),
            h('div', { style:{fontSize:'11px', color:'#64748b'} }, o.customer_mobile? '📱 '+o.customer_mobile : (o.customer_email||'')),
            o.addr_line1? h('div', { style:{fontSize:'11px', color:'#334155', marginTop:'4px'} }, '📍 '+o.addr_line1+ (o.addr_city? ', '+o.addr_city:'') ) : null
          ),
          h('td', {},
            h('div', { style:{fontWeight:'700'} }, money(o.total)),
            o.payment_status? h('div', { style:{fontSize:'11px', color:o.payment_status==='captured'?'#16a34a':'#64748b'} }, (o.payment_method||'')+' '+o.payment_status) : null
          ),
          h('td', {}, statusBadge(o.status)),
          h('td', {}, h('div', { style:{fontSize:'12px'} }, formatDate(o.created_at))),
          h('td', {},
            h('div', { style:{display:'flex', gap:'6px'} },
              h('button', { class:'admin-btn admin-btn-ghost', style:{padding:'6px 10px'}, onclick:()=> openOrderDetail(o.id) }, 'View'),
              h('select', { class:'admin-select', style:{padding:'6px 8px'}, value:o.status, onchange: async (e)=>{
                const ns=e.target.value;
                if(ns===o.status) return;
                try{ await api.post('/admin/orders/'+o.id+'/status', {status:ns}); toast('Status → '+ns,'success'); fetchAndRender(); }catch(err){ toast(err.message,'error'); e.target.value=o.status; }
              } },
                ...['PAYMENT_PENDING','PAID','CONFIRMED','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s=> h('option',{value:s, selected:s===o.status}, s.replace(/_/g,' ')))
              )
            )
          )
        ))
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
    const content = h('div', { style:{maxHeight:'80vh', overflowY:'auto', paddingRight:'4px'} },
      h('h2', { style:{margin:'0 0 8px'} }, order.order_number),
      h('div', { style:{display:'flex', gap:'8px', flexWrap:'wrap'} }, statusBadge(order.status), order.coupon_code? h('span',{class:'admin-badge admin-badge-pending'}, 'Coupon '+order.coupon_code):null, payment? h('span',{class: payment.verified?'admin-badge admin-badge-delivered':'admin-badge admin-badge-pending'}, payment.verified?'✓ Paid':'Payment '+payment.status):null),
      h('div', { style:{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginTop:'16px'} },
        h('div', { style:{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'14px'} },
          h('div', { style:{fontSize:'11px', fontWeight:'700', letterSpacing:'.06em', color:'#64748b'} }, 'CUSTOMER'),
          h('div', { style:{fontWeight:'700', marginTop:'6px'} }, customer.name||'—'),
          h('div', { style:{fontSize:'13px', color:'#334155'} }, customer.mobile||''),
          h('div', { style:{fontSize:'12px', color:'#64748b'} }, customer.email||'')
        ),
        h('div', { style:{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'14px'} },
          h('div', { style:{fontSize:'11px', fontWeight:'700', letterSpacing:'.06em', color:'#64748b'} }, 'SHIPPING ADDRESS'),
          address.line1? h('div', {}, h('div',{style:{fontWeight:'600'}}, address.line1), address.line2? h('div',{},address.line2):null, h('div',{}, `${address.city||''} ${address.state||''} ${address.pincode||''}`)) : h('div',{style:{color:'#94a3b8'}},'No address'),
          payment? h('div', { style:{marginTop:'8px', fontSize:'12px'} }, h('span',{style:{fontWeight:'700'}},'Payment: '), `${payment.method||''} ${payment.status} ${money(payment.amount||order.total)}`) : null
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
        h('button', { class:'admin-btn admin-btn-primary', onclick:()=>{ const txt=`${customer.name} | ${customer.mobile} | ${address.line1||''}, ${address.city||''} ${address.pincode||''} | ${order.order_number}`; navigator.clipboard?.writeText(txt); toast('Copied delivery details','success'); } }, '📋 Copy delivery'),
        h('button', { class:'admin-btn admin-btn-ghost', onclick:()=>window.print() }, '🖨️ Print')
      ),
      h('div', { style:{marginTop:'16px'} },
        h('div', { style:{fontWeight:'600', marginBottom:'8px'} }, 'Update Status'),
        h('div', { style:{display:'flex', gap:'8px', alignItems:'center'} },
          h('select', { class:'admin-select', id:'statusSel' },
            ...['PAYMENT_PENDING','PAID','CONFIRMED','PRINTING','QUALITY_CHECK','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'].map(s=> h('option',{value:s, selected:s===order.status}, s.replace(/_/g,' ')))
          ),
          h('button', { class:'admin-btn admin-btn-primary', onclick: async ()=> {
            const sel=document.getElementById('statusSel');
            try{ await api.post('/admin/orders/'+order.id+'/status', {status:sel.value}); toast('Status updated to '+sel.value,'success'); order.status=sel.value; }catch(e){ toast(e.message,'error'); }
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
    modal(content);
  }catch(e){ toast(e.message,'error'); }
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
              h('img', { src:(p.images&&p.images[0])||'', alt:p.name, style:{width:'40px', height:'40px', borderRadius:'8px', objectFit:'cover', background:'#f1f5f9'}, onerror:(e)=>{ e.target.style.display='none'; } }),
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
    const name = h('input', { class:'admin-input', placeholder:'ZUNO Essential Tee', value:existing?.name||'' });
    const price = h('input', { class:'admin-input', type:'number', placeholder:'Price in paise (129900 = ₹1299)', value:existing?.price||'' });
    const mrp = h('input', { class:'admin-input', type:'number', placeholder:'MRP paise', value:existing?.mrp||'' });
    const stock = h('input', { class:'admin-input', type:'number', placeholder:'Stock', value:existing?.stock??'' });
    const desc = h('textarea', { class:'admin-input', placeholder:'Description', style:{minHeight:'70px'} }, existing?.description||'');
    const colors = h('input', { class:'admin-input', placeholder:'Colors comma-separated (black,white,beige)', value:(existing?.colors||[]).join(', ') });
    const sizes = h('input', { class:'admin-input', placeholder:'Sizes (S,M,L,XL)', value:(existing?.sizes||[]).join(', ') });
    const images = h('input', { class:'admin-input', placeholder:'Image URLs comma-separated', value:(existing?.images||[]).join(', ') });
    const catSel = h('select', { class:'admin-select' });
    const fabric = h('input', { class:'admin-input', placeholder:'Fabric (100% Cotton)', value:existing?.fabric||'' });
    const collection = h('input', { class:'admin-input', placeholder:'Collection (Essentials)', value:existing?.collection||'' });
    const fit = h('input', { class:'admin-input', placeholder:'Fit (regular, oversized)', value:existing?.fit||'' });
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
    const errEl = h('div', { style:{color:'#dc2626', fontSize:'13px', minHeight:'18px'} });

    const form = h('div', { style:{maxHeight:'80vh', overflowY:'auto'} },
      h('h3',{}, isEdit?'Edit Product':'Add Product'),
      h('div', { class:'admin-form-grid', style:{marginTop:'12px'} },
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Name *'), name),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Category *'), catSel),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Price (paise) *'), price),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'MRP (paise) *'), mrp),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Stock *'), stock),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Fabric'), fabric),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Fit'), fit),
        h('div', {}, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Collection'), collection)
      ),
      h('div', { style:{marginTop:'12px'} }, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Description'), desc),
      h('div', { style:{marginTop:'12px'} }, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Colors'), colors),
      h('div', { style:{marginTop:'8px'} }, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Sizes'), sizes),
      h('div', { style:{marginTop:'8px'} }, h('label',{style:{fontSize:'11px', fontWeight:'700'}},'Images (URLs)'), images),
      errEl,
      h('div', { style:{marginTop:'12px'} }, saveBtn)
    );

    const m = modal(form);
    saveBtn.onclick = async ()=>{
      errEl.textContent='';
      const payload = {};
      if(!isEdit){
        if(!name.value.trim()){ errEl.textContent='Name required'; return; }
        if(!catSel.value){ errEl.textContent='Category required'; return; }
        payload.name=name.value.trim();
        payload.categoryId=Number(catSel.value);
        payload.price=Number(price.value);
        payload.mrp=Number(mrp.value);
        payload.stock=Number(stock.value);
        if(!payload.price||!payload.mrp||payload.stock<0){ errEl.textContent='Check price/mrp/stock'; return; }
        payload.description=desc.value.trim();
        payload.colors=colors.value.split(',').map(s=>s.trim()).filter(Boolean);
        payload.sizes=sizes.value.split(',').map(s=>s.trim()).filter(Boolean);
        payload.images=images.value.split(',').map(s=>s.trim()).filter(Boolean);
        payload.fabric=fabric.value.trim()||undefined;
        payload.collection=collection.value.trim()||undefined;
        payload.fit=fit.value.trim()||undefined;
        try{ saveBtn.disabled=true; saveBtn.textContent='Creating…'; await api.post('/admin/products', payload); toast('Product created','success'); m.close(); const u=new URLSearchParams(); location.hash='#/admin/products'; setTimeout(()=> location.reload(),300); }catch(e){ errEl.textContent=e.message; saveBtn.disabled=false; saveBtn.textContent='Create Product'; }
      } else {
        payload.name=name.value.trim()||undefined;
        payload.category_id=catSel.value?Number(catSel.value):undefined;
        payload.price=price.value?Number(price.value):undefined;
        payload.mrp=mrp.value?Number(mrp.value):undefined;
        payload.stock=stock.value!==''?Number(stock.value):undefined;
        payload.description=desc.value.trim()||undefined;
        payload.colors=colors.value? colors.value.split(',').map(s=>s.trim()).filter(Boolean):undefined;
        payload.sizes=sizes.value? sizes.value.split(',').map(s=>s.trim()).filter(Boolean):undefined;
        payload.images=images.value? images.value.split(',').map(s=>s.trim()).filter(Boolean):undefined;
        payload.fabric=fabric.value.trim()||undefined;
        payload.collection=collection.value.trim()||undefined;
        payload.fit=fit.value.trim()||undefined;
        // filter undefined
        Object.keys(payload).forEach(k=> payload[k]===undefined && delete payload[k]);
        try{ saveBtn.disabled=true; saveBtn.textContent='Saving…'; await api.put('/admin/products/'+existing.id, payload); toast('Updated','success'); m.close(); render(); }catch(e){ errEl.textContent=e.message; saveBtn.disabled=false; saveBtn.textContent='Update Product'; }
      }
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
                h('img', { src:(p.images&&p.images[0])||'', style:{width:'36px', height:'36px', borderRadius:'8px', background:'#f1f5f9', objectFit:'cover'}, onerror:(e)=>e.target.style.display='none'} ),
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
