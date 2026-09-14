import { h, money, toast, emptyState, errorState, productImage, resolveImageUrl, imgFallback, modal } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { ProductCard, refreshCart, showCartDrawer } from '../components.js';

export async function Product({ params }) {
  const root = h('div', { class: 'container section' });
  root.append(h('div', { class: 'skeleton', style: { height: '480px', borderRadius: '16px' } }));
  try {
    const { product } = await api.get('/products/' + params.slug);
    root.innerHTML = '';

    // ── Breadcrumb ──
    const crumb = h('div', { style:{display:'flex', gap:'6px', alignItems:'center', fontSize:'12px', color:'#94a3b8', marginBottom:'16px', flexWrap:'wrap'} },
      h('a',{href:'#/', style:{color:'#cbd5e1', textDecoration:'none'}},'Home'),
      h('span',{style:{color:'#64748b'}},'›'),
      h('a',{href:'#/shop', style:{color:'#cbd5e1', textDecoration:'none'}},'Shop'),
      h('span',{style:{color:'#64748b'}},'›'),
      h('span',{style:{color:'#f1f5f9', fontWeight:'700'}}, product.name.slice(0,32))
    );

    // ── Gallery with thumbnails (1–10 images) + live video ──
    const images = (product.images && product.images.length ? product.images : [null]).slice(0,10);
    const videoSrcRaw = product.video_url || product.videoUrl || null;
    const videoSrc = videoSrcRaw ? resolveImageUrl(videoSrcRaw) : null;
    let activeIdx = 0;
    const mainSrc = images[0] ? resolveImageUrl(images[0]) : productImage(product);
    const mainImg = h('img', { class: 'pdp-img', src: mainSrc, alt: product.name, loading: 'eager', decoding: 'async', style:{width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.35s ease, opacity 0.25s ease'} , onerror: (e) => imgFallback(e.currentTarget, product) });
    // click on image = scroll to NEXT image (right), double-click = zoom modal
    const mainWrap = h('div', { style:{position:'relative', width:'100%', height:'100%', overflow:'hidden', borderRadius:'16px', background:'linear-gradient(135deg,#f1f5f9,#e2e8f0)', cursor:'pointer', userSelect:'none'}, title:'Click: next image →  •  Double-click: zoom' }, mainImg);
    const saveAmt = (product.mrp > product.price) ? (product.mrp - product.price) : 0;
    const badgeRow = h('div', { style:{position:'absolute', top:'12px', left:'12px', display:'flex', gap:'8px', zIndex:'2', pointerEvents:'none'} });
    if (product.discountPercent) badgeRow.append(h('span',{style:{background:'#0a0a0a', color:'#fff', fontSize:'11px', fontWeight:'800', padding:'6px 10px', borderRadius:'999px', letterSpacing:'0.04em'}}, `${product.discountPercent}% OFF`));
    else if (product.newArrival) badgeRow.append(h('span',{style:{background:'#1e40af', color:'#fff', fontSize:'11px', fontWeight:'800', padding:'6px 10px', borderRadius:'999px'}}, 'NEW DROP'));
    if (product.stock <= 10 && product.stock > 0) badgeRow.append(h('span',{style:{background:'#fef3c7', color:'#92400e', fontSize:'11px', fontWeight:'700', padding:'6px 10px', borderRadius:'999px'}}, `Only ${product.stock} left`));
    if (product.stock === 0) badgeRow.append(h('span',{style:{background:'#fee2e2', color:'#991b1b', fontSize:'11px', fontWeight:'700', padding:'6px 10px', borderRadius:'999px'}}, 'Out of stock'));
    mainWrap.append(badgeRow);
    const countPill = h('div',{style:{position:'absolute', bottom:'12px', right:'12px', background:'rgba(15,23,42,0.85)', color:'#fff', fontSize:'11px', fontWeight:'700', padding:'6px 10px', borderRadius:'999px', pointerEvents:'none'}}, images.length>1 ? `1 / ${images.length}` : '1 / 1');
    if (images.length > 1 || videoSrc) mainWrap.append(countPill);
    // arrow controls — visible on hover / always on mobile
    const prevBtn = h('button', { type:'button', 'aria-label':'Previous image', style:{position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.92)', border:'1px solid #e2e8f0', color:'#0f172a', fontSize:'16px', fontWeight:'800', display: images.length>1 ? 'grid' : 'none', placeItems:'center', cursor:'pointer', zIndex:'2', boxShadow:'0 2px 8px rgba(0,0,0,0.12)'} , onclick:(e)=>{ e.stopPropagation(); goPrev(); } }, '‹');
    const nextBtn = h('button', { type:'button', 'aria-label':'Next image', style:{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.92)', border:'1px solid #e2e8f0', color:'#0f172a', fontSize:'16px', fontWeight:'800', display: images.length>1 ? 'grid' : 'none', placeItems:'center', cursor:'pointer', zIndex:'2', boxShadow:'0 2px 8px rgba(0,0,0,0.12)'} , onclick:(e)=>{ e.stopPropagation(); goNext(); } }, '›');
    if (images.length>1) { mainWrap.append(prevBtn, nextBtn); }
    // hint overlay
    const swipeHint = images.length>1 ? h('div',{style:{position:'absolute', bottom:'12px', left:'12px', background:'rgba(255,255,255,0.92)', color:'#334155', fontSize:'10px', fontWeight:'700', padding:'5px 9px', borderRadius:'999px', pointerEvents:'none', border:'1px solid #e2e8f0'}}, 'Click → next • Swipe or use arrows') : null;
    if (swipeHint) mainWrap.append(swipeHint);

    const galleryCard = h('div', { style:{borderRadius:'16px', overflow:'hidden', background:'#fff', border:'1px solid #e2e8f0', boxShadow:'0 8px 24px rgba(15,23,42,0.06)'} },
      h('div', { style:{aspectRatio:'4/5', overflow:'hidden'} }, mainWrap)
    );

    // thumbnails — horizontal scroll, active state, auto-scroll into view
    const thumbRow = h('div', { style:{display:'flex', gap:'8px', marginTop:'12px', overflowX:'auto', paddingBottom:'6px', scrollbarWidth:'thin', scrollBehavior:'smooth', WebkitOverflowScrolling:'touch'} });
    images.forEach((src, idx) => {
      const thumbSrc = src ? resolveImageUrl(src) : productImage(product);
      const t = h('button', { type:'button', 'aria-label': `View image ${idx+1}`, style:{flex:'0 0 64px', width:'64px', height:'78px', borderRadius:'10px', overflow:'hidden', border: idx===0 ? '2px solid #0f172a' : '1px solid #e2e8f0', padding:'0', background:'#fff', cursor:'pointer', position:'relative', scrollSnapAlign:'start'} ,
        onclick: () => setActive(idx)
      },
        h('img',{src: thumbSrc, alt:`${product.name} ${idx+1}`, style:{width:'100%', height:'100%', objectFit:'cover'}, onerror:(e)=>imgFallback(e.currentTarget, {name:product.name}) })
      );
      thumbRow.append(t);
    });
    // video thumb — clicking switches main to video player
    let videoActive = false;
    const videoEl = videoSrc ? h('video', { controls:true, playsinline:true, preload:'metadata', poster: mainSrc, style:{width:'100%', height:'100%', objectFit:'contain', background:'#0f172a', display:'none'}, src: videoSrc }) : null;
    if (videoSrc) {
      // overlay video element inside galleryCard for inline playback
      const vidWrap = h('div', { style:{position:'absolute', inset:'0', display:'none', background:'#0f172a', zIndex:'3'} }, videoEl);
      mainWrap.append(vidWrap);
      const vt = h('button', { type:'button', 'aria-label':'Play video', style:{flex:'0 0 64px', width:'64px', height:'78px', borderRadius:'10px', overflow:'hidden', border:'1px solid #e2e8f0', background:'#0f172a', color:'#fff', display:'grid', placeItems:'center', fontSize:'20px', position:'relative', cursor:'pointer'} ,
        onclick:()=> setActive('video') },
        h('span',{style:{fontSize:'22px'}},'▶'),
        h('span',{style:{position:'absolute', bottom:'4px', left:'50%', transform:'translateX(-50%)', fontSize:'8px', fontWeight:'700', letterSpacing:'0.05em', background:'rgba(255,255,255,0.15)', padding:'2px 6px', borderRadius:'999px'}}, 'VIDEO')
      );
      thumbRow.append(vt);
      // helper to toggle video visibility
      thumbRow._videoWrap = vidWrap;
      thumbRow._videoBtn = vt;
    }
    function goNext(){ if (videoActive) { setActive(0); return; } const nxt = (activeIdx + 1) % images.length; setActive(nxt); }
    function goPrev(){ if (videoActive) { setActive(images.length-1); return; } const prv = (activeIdx - 1 + images.length) % images.length; setActive(prv); }
    function setActive(idx){
      // handle video mode
      if (idx === 'video' && videoSrc) {
        videoActive = true;
        const vw = thumbRow._videoWrap;
        if (vw) { vw.style.display='block'; if (videoEl) { try{ videoEl.currentTime=0; videoEl.play().catch(()=>{});}catch{}} }
        mainImg.style.opacity='0';
        // highlight video thumb
        [...thumbRow.children].forEach(el=>{ el.style.border='1px solid #e2e8f0'; el.style.transform='none'; });
        const vbtn = thumbRow._videoBtn;
        if (vbtn) { vbtn.style.border='2px solid #0f172a'; vbtn.style.transform='scale(0.98)'; }
        countPill.textContent = `▶ Video`;
        // scroll video thumb into view
        try{ thumbRow._videoBtn.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' }); }catch{}
        return;
      }
      // exit video mode if was active
      if (videoActive) {
        videoActive = false;
        const vw = thumbRow._videoWrap;
        if (vw) vw.style.display='none';
        if (videoEl) try{ videoEl.pause(); }catch{}
        mainImg.style.opacity='1';
      }
      activeIdx = Number(idx);
      // cross-fade
      mainImg.style.opacity='0.3';
      const nextSrc = images[activeIdx] ? resolveImageUrl(images[activeIdx]) : productImage(product);
      // preload then swap
      const tmp = new Image();
      tmp.onload = ()=>{ mainImg.src = nextSrc; mainImg.style.opacity='1'; };
      tmp.onerror = ()=>{ mainImg.src = nextSrc; mainImg.style.opacity='1'; imgFallback(mainImg, product); };
      tmp.src = nextSrc;
      [...thumbRow.children].forEach((el,i)=> {
        const isActive = i===activeIdx;
        // skip video button border toggling if video exists — its index is images.length
        if (videoSrc && i === images.length) return;
        el.style.border = isActive ? '2px solid #0f172a' : '1px solid #e2e8f0';
        el.style.transform = isActive ? 'scale(0.98)' : 'none';
      });
      if (videoSrc && thumbRow._videoBtn) { thumbRow._videoBtn.style.border='1px solid #e2e8f0'; thumbRow._videoBtn.style.transform='none'; }
      countPill.textContent = `${activeIdx+1} / ${images.length}` + (videoSrc ? ' + video' : '');
      // scroll active thumb into view (horizontal)
      try{ thumbRow.children[activeIdx]?.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' }); }catch{}
    }
    // clicking main image advances to NEXT (scroll right) — as requested
    mainWrap.addEventListener('click', (e)=>{
      if (e.target === prevBtn || e.target === nextBtn || e.target.closest('button')) return;
      if (videoActive) { setActive(0); return; }
      goNext();
    });
    // double-click zooms — shows modal with full image
    mainWrap.addEventListener('dblclick', (e)=>{
      e.preventDefault();
      if (videoActive && videoEl) return; // don't zoom video
      const src = mainImg.src;
      const zoom = h('div', {style:{display:'flex', flexDirection:'column', alignItems:'center', gap:'12px'}},
        h('img',{src, style:{maxWidth:'100%', maxHeight:'70vh', borderRadius:'12px', objectFit:'contain', background:'#f8fafc'}}),
        h('div',{style:{fontSize:'12px', color:'#64748b'}}, `${activeIdx+1} / ${images.length} — ${product.name} • Double-click image was zoom, single click now advances`),
        h('div',{style:{display:'flex', gap:'8px'}},
          h('button',{class:'btn btn-ghost btn-sm', onclick:()=>{ goPrev(); const im=document.querySelector('.overlay img'); if(im) im.src = mainImg.src; }}, '‹ Prev'),
          h('button',{class:'btn btn-ghost btn-sm', onclick:()=>{ goNext(); const im=document.querySelector('.overlay img'); if(im) im.src = mainImg.src; }}, 'Next ›')
        )
      );
      modal(zoom);
    });
    // swipe / drag to navigate
    let startX = 0, dragging=false;
    mainWrap.addEventListener('touchstart', (e)=>{ startX = e.touches[0].clientX; dragging=true; }, {passive:true});
    mainWrap.addEventListener('touchend', (e)=>{ if(!dragging) return; const dx = e.changedTouches[0].clientX - startX; if (Math.abs(dx) > 40) { if(dx<0) goNext(); else goPrev(); } dragging=false; }, {passive:true});
    let mouseDownX=0, isMouseDrag=false;
    mainWrap.addEventListener('mousedown', (e)=>{ mouseDownX=e.clientX; isMouseDrag=true; });
    mainWrap.addEventListener('mouseup', (e)=>{ if(!isMouseDrag) return; const dx=e.clientX - mouseDownX; if(Math.abs(dx)>50){ if(dx<0) goNext(); else goPrev(); } isMouseDrag=false; });
    // keyboard arrows when gallery focused
    mainWrap.setAttribute('tabindex','0');
    mainWrap.addEventListener('keydown', (e)=>{ if(e.key==='ArrowRight') { e.preventDefault(); goNext(); } if(e.key==='ArrowLeft'){ e.preventDefault(); goPrev(); } });

    // inline video block below thumbnails when video exists — live visible player
    const videoBlock = videoSrc ? h('div', { style:{marginTop:'12px', borderRadius:'16px', overflow:'hidden', background:'#0f172a', border:'1px solid #1e293b', boxShadow:'0 8px 24px rgba(15,23,42,0.12)'} },
      h('div', { style:{padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(135deg,#0f172a,#1e293b)', color:'#e2e8f0'} },
        h('span',{style:{fontSize:'11px', fontWeight:'800', letterSpacing:'0.08em'}}, '▶ PRODUCT VIDEO • LIVE'),
        h('span',{style:{fontSize:'11px', color:'#93c5fd'}}, 'Tap to play')
      ),
      h('video', { controls:true, playsinline:true, preload:'metadata', style:{width:'100%', maxHeight:'360px', display:'block', background:'#000'}, src: videoSrc, poster: mainSrc, onerror:(e)=>{ e.currentTarget.style.display='none'; e.currentTarget.parentNode.append(h('div',{style:{padding:'14px', color:'#94a3b8', fontSize:'13px', textAlign:'center'}}, 'Video unavailable — but gallery images are live.')); } })
    ) : null;

    const gallery = h('div', { style:{display:'flex', flexDirection:'column'} }, galleryCard, thumbRow, videoBlock);

    // ── Variant state ──
    let selColor = (product.colors && product.colors[0]) || null;
    let selSize = null;
    let qty = 1;

    const colorRow = h('div', { class: 'row gap-2 wrap', style: { marginTop: '10px' } });
    const LIGHT_COLORS = new Set(['white','beige','light-blue','light blue','cream','off-white','offwhite','sage','grey','gray','washed-grey','sand']);
    (product.colors || []).forEach(col => {
      const bg = colorToBg(col);
      const isLight = LIGHT_COLORS.has(String(col).toLowerCase()) || bg==='#ffffff' || bg==='#e8e6e1' || bg==='#93c5fd' || bg==='#9caf88';
      const btn = h('button', {
        type: 'button',
        class: 'color-swatch' + (col === selColor ? ' active' : ''),
        style: {
          background: bg,
          width: '40px', height: '40px', borderRadius:'50%',
          border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid rgba(15,23,42,0.12)',
          boxShadow: col.toLowerCase()==='white' ? 'inset 0 0 0 1px #e2e8f0, 0 1px 4px rgba(15,23,42,0.08)' : '0 1px 4px rgba(15,23,42,0.10), inset 0 0 0 1px rgba(255,255,255,0.6)',
          outline: selColor===col ? '2px solid #0f172a' : 'none',
          outlineOffset: '2px',
          cursor:'pointer'
        },
        title: col,
        onclick: () => selectColor(col)
      });
      colorRow.append(btn);
    });
    function colorToBg(c) {
      const map = { black: '#0a0a0a', white: '#ffffff', beige: '#e8e6e1', charcoal: '#2a2a2a', grey: '#94a3b8', gray:'#94a3b8', navy: '#1e293b', olive: '#556b2f', red: '#dc2626', forest: '#14532d', sage: '#b8c7a8', 'light-blue': '#93c5fd', 'washed-black': '#1a1a1a', blue:'#2B4C7E', cream:'#fef3c7', sand:'#e7d6b8', brown:'#78350f', maroon:'#7f1d1d' };
      return map[String(c).toLowerCase().trim()] || c;
    }
    function selectColor(c) {
      selColor = c;
      colorRow.querySelectorAll('.color-swatch').forEach(b => {
        const isActive = b.title === c;
        b.classList.toggle('active', isActive);
        b.style.outline = isActive ? '2px solid #0f172a' : 'none';
        b.style.outlineOffset = '2px';
      });
      const needle = document.getElementById('pdpColorLabel');
      if (needle) needle.textContent = c;
      updateVariantInfo();
    }

    const sizeRow = h('div', { class: 'row gap-2 wrap', style: { marginTop: '10px' } });
    (product.sizes || ['S', 'M', 'L', 'XL']).forEach(s => {
      const btn = h('button', {
        type: 'button',
        class: 'btn btn-sm ' + (s === selSize ? 'btn-primary' : 'btn-ghost'),
        style: { minWidth: '52px', borderWidth:'1.5px', fontWeight:'700', borderColor: s === selSize ? '#0f172a' : '#e2e8f0', background: s===selSize?'#0f172a':'#fff', color:s===selSize?'#fff':'#0f172a' },
        onclick: () => selectSize(s)
      }, s);
      sizeRow.append(btn);
    });
    function selectSize(s) {
      selSize = s;
      sizeRow.querySelectorAll('button').forEach(b => {
        const isActive = b.textContent === s;
        b.className = 'btn btn-sm ' + (isActive ? 'btn-primary' : 'btn-ghost');
        b.style.background = isActive ? '#0f172a' : '#fff';
        b.style.color = isActive ? '#fff' : '#0f172a';
        b.style.borderColor = isActive ? '#0f172a' : '#e2e8f0';
      });
      updateVariantInfo();
    }

    const variantInfo = h('div', { style: { marginTop: '10px', minHeight:'20px', fontSize:'13px', fontWeight:'600', display:'flex', alignItems:'center', gap:'6px'} }, '');

    function updateVariantInfo() {
      if (!selColor || !selSize) {
        variantInfo.textContent = 'Select color and size';
        variantInfo.style.color = '#64748b';
        return;
      }
      const variant = (product.variants || []).find(v => v.color === selColor && v.size === selSize);
      if (variant) {
        if (variant.stock > 0) {
          variantInfo.textContent = `✓ In stock · ${variant.stock} units available`;
          variantInfo.style.color = '#16a34a';
        } else {
          variantInfo.textContent = 'Out of stock in this variant — try another size';
          variantInfo.style.color = '#dc2626';
        }
      } else {
        variantInfo.textContent = '✓ Available — ready to ship';
        variantInfo.style.color = '#16a34a';
      }
    }
    updateVariantInfo();

    // qty stepper — high contrast inside white info card
    const qtyMinus = h('button',{class:'btn btn-ghost', type:'button', style:{width:'40px', minWidth:'40px', padding:'0', background:'#f8fafc', border:'1px solid #e2e8f0', color:'#0f172a', fontWeight:'800'}, onclick:()=>{ qty=Math.max(1, qty-1); qtyInput.value=String(qty); }}, '−');
    const qtyPlus = h('button',{class:'btn btn-ghost', type:'button', style:{width:'40px', minWidth:'40px', padding:'0', background:'#f8fafc', border:'1px solid #e2e8f0', color:'#0f172a', fontWeight:'800'}, onclick:()=>{ qty=Math.min(10, qty+1); qtyInput.value=String(qty); }}, '+');
    const qtyInput = h('input', { type: 'number', min: '1', max: '10', value: '1', style: { width: '64px', textAlign:'center', fontWeight:'800', background:'#fff', color:'#0f172a', border:'1.5px solid #cbd5e1', borderRadius:'10px', padding:'8px' } });
    qtyInput.addEventListener('input', () => { qty = Math.max(1, Math.min(10, Number(qtyInput.value) || 1)); qtyInput.value=String(qty); });

    const sizeGuideBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', style:{border:'1px dashed #cbd5e1', background:'#f8fafc'}, onclick: openSizeGuide }, '📏 Size guide');
    const wishBtn = h('button', {
      class: 'btn btn-ghost' + (Store.isWished(product.id) ? ' active' : ''),
      type: 'button',
      style:{flex:'0 0 48px', width:'48px', height:'48px', borderRadius:'12px', border:'1px solid #e2e8f0', background: Store.isWished(product.id)?'#0f172a':'#fff', color: Store.isWished(product.id)?'#fff':'#0f172a', fontSize:'18px'},
      onclick: async () => { await Store.toggleWish(product.id); const w = Store.isWished(product.id); wishBtn.textContent = w ? '♥' : '♡'; wishBtn.style.background=w?'#0f172a':'#fff'; wishBtn.style.color=w?'#fff':'#0f172a'; }
    }, Store.isWished(product.id) ? '♥' : '♡');

    const addBtn = h('button', { class: 'btn btn-outline', type: 'button', style:{flex:'1', padding:'14px 18px', borderRadius:'12px', border:'1.5px solid #0f172a', background:'#fff', color:'#0f172a', fontWeight:'800', letterSpacing:'0.02em'}, onclick: () => addToBag(false) }, 'Add to bag');
    const buyBtn = h('button', { class: 'btn btn-primary', type: 'button', style:{flex:'1', padding:'14px 18px', borderRadius:'12px', background:'#0f172a', borderColor:'#0f172a', fontWeight:'800', letterSpacing:'0.02em', boxShadow:'0 8px 20px rgba(15,23,42,0.18)'}, onclick: () => addToBag(true) }, 'Buy now');

    async function addToBag(buyNow) {
      if (product.colors?.length && !selColor) { toast('Please select a color', 'warning'); // pulse color section
        try{ colorRow.scrollIntoView({behavior:'smooth', block:'center'}); }catch{}
        return; }
      if (product.sizes?.length && !selSize) { toast('Please select a size', 'warning');
        try{ sizeRow.scrollIntoView({behavior:'smooth', block:'center'}); }catch{}
        return; }
      const variant = selColor && selSize ? { color: selColor, size: selSize } : null;
      const q = Math.max(1, Math.min(10, Number(qtyInput.value) || 1));
      const imageSrc = (product.images && product.images[0]) || null;
      // Buy Now → directly go to checkout DETAILS section (like Proceed to checkout) — highlights address
      if (buyNow) {
        // visual feedback: disable button
        try{ buyBtn.disabled=true; buyBtn.textContent='Adding…'; }catch{}
        if (!Store.isAuthed()) {
          Store.addGuestItem({ productId: product.id, name: product.name, price: product.price, mrp: product.mrp, slug: product.slug, image: imageSrc || productImage(product), module: 'shop', quantity: q, variant, isCustom: false });
          toast('Added to bag — sign in to continue', 'success');
          // go to checkout with buyNow flag so checkout auto-focuses details/proceed area
          location.hash = '#/checkout?module=shop&from=buyNow&scroll=details';
          return;
        }
        try {
          await api.post('/cart/items?module=shop', { productId: product.id, quantity: q, variant });
          await refreshCart();
          toast('Proceeding to checkout — details', 'success');
          location.hash = '#/checkout?module=shop&from=buyNow&scroll=details';
        } catch (e) { toast(e.message, 'error'); try{ buyBtn.disabled=false; buyBtn.textContent='Buy now'; }catch{} }
        return;
      }
      // Add to Bag → show popup drawer with cart preview (no redirect)
      if (!Store.isAuthed()) {
        Store.addGuestItem({ productId: product.id, name: product.name, price: product.price, mrp: product.mrp, slug: product.slug, image: imageSrc || productImage(product), module: 'shop', quantity: q, variant, isCustom: false });
        toast('Added to bag', 'success');
        try { showCartDrawer({ addedProduct: { name: product.name, price: product.price, image: imageSrc, variant } }); } catch {}
        return;
      }
      try {
        await api.post('/cart/items?module=shop', { productId: product.id, quantity: q, variant });
        await refreshCart();
        toast('Added to bag', 'success');
        try { showCartDrawer({ addedProduct: { name: product.name, price: product.price, image: imageSrc, variant } }); } catch {}
      } catch (e) { toast(e.message, 'error'); }
    }

    function openSizeGuide() {
      const rows = [
        ['XS', '34"', '27"'], ['S', '36"', '28"'], ['M', '38"', '29"'], ['L', '40"', '30"'], ['XL', '42"', '31"'], ['XXL', '44"', '32"'], ['XXXL', '46"', '33"'],
      ];
      const table = h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Size'), h('th', {}, 'Chest'), h('th', {}, 'Length'))),
        h('tbody', {}, ...rows.map(([sz, ch, len]) => h('tr', {}, h('td', {}, sz), h('td', {}, ch), h('td', {}, len)))));
      const content = h('div', {},
        h('h3', { style: { fontFamily: 'var(--font-display)' } }, 'Size Guide'),
        h('p', { class: 'muted text-sm', style: { marginBottom: '12px' } }, 'Measurements in inches. For best fit, measure a well-fitting T-shirt.'),
        table,
        h('p', { class: 'muted text-xs', style: { marginTop: '12px' } }, 'Fit may vary by style. Oversized is intentionally larger — size down for a regular fit.'));
      modal(content);
    }

    // ── Premium info panel ──
    const youSave = saveAmt ? h('span',{style:{background:'#dcfce7', color:'#166534', fontSize:'11px', fontWeight:'800', padding:'4px 8px', borderRadius:'999px'}}, `You save ${money(saveAmt)}`) : null;
    // Live rating refs — updated instantly when user rates, stable on refresh
    const topRatingBadge = h('span', { style:{display:'inline-flex', gap:'4px', alignItems:'center', background:'#fff7ed', border:'1px solid #fed7aa', color:'#9a3412', fontSize:'12px', fontWeight:'700', padding:'4px 10px', borderRadius:'999px'} }, `★ ${product.rating || '4.5'}`);
    const topCountText = h('span', { style:{fontSize:'12px', color:'#64748b'} }, `· ${product.ratingCount || 0} ratings`);

    const info = h('div', { style:{display:'flex', flexDirection:'column', gap:'0', minWidth:'0', background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:'16px', padding:'18px', boxShadow:'0 8px 24px rgba(15,23,42,0.08)'}},
      h('div', { style:{display:'inline-flex', alignItems:'center', gap:'8px'} },
        h('span', { style:{fontSize:'11px', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:'800', background:'#0f172a', color:'#fff', padding:'5px 10px', borderRadius:'999px'} }, 'ZUNO'),
        h('span', { style:{fontSize:'11px', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:'700', color:'#64748b', border:'1px solid #e2e8f0', padding:'5px 10px', borderRadius:'999px', background:'#fff'} }, product.collection || 'Essentials')
      ),
      h('h1', { style: { fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', margin: '10px 0 6px', lineHeight:'1.05', fontSize:'clamp(22px,3.2vw,32px)', color:'#0f172a'} }, product.name),
      h('div', { style:{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'} },
        topRatingBadge,
        topCountText,
        h('span', { style:{width:'4px', height:'4px', borderRadius:'50%', background:'#cbd5e1'} }),
        h('span', { style:{fontSize:'12px', color:'#0f172a', fontWeight:'600'} }, (product.fabric || '100% Cotton'))
      ),
      // price block — premium card
      h('div', { style:{marginTop:'14px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'16px', padding:'16px', boxShadow:'0 4px 12px rgba(15,23,42,0.04)'} },
        h('div', { style:{display:'flex', gap:'10px', alignItems:'baseline', flexWrap:'wrap'} },
          h('span', { style: { fontSize: '28px', fontWeight: '900', color:'#0f172a', letterSpacing:'-0.02em' } }, money(product.price)),
          product.mrp > product.price ? h('span', { style:{fontSize:'14px', color:'#94a3b8', textDecoration:'line-through', fontWeight:'600'} }, money(product.mrp)) : null,
          product.discountPercent ? h('span', { style: { background: '#0f172a', color: '#fff', fontSize:'12px', fontWeight:'800', padding:'5px 10px', borderRadius:'999px' } }, product.discountPercent + '% OFF') : null
        ),
        h('div', { style:{display:'flex', gap:'8px', marginTop:'8px', flexWrap:'wrap', alignItems:'center'} },
          youSave,
          h('span',{style:{fontSize:'11px', color:'#64748b'}}, 'Inclusive of all taxes'),
          product.stock>0 ? h('span',{style:{marginLeft:'auto', fontSize:'11px', fontWeight:'700', color:'#16a34a', background:'#f0fdf4', border:'1px solid #bbf7d0', padding:'4px 8px', borderRadius:'999px'}}, '● In stock') : h('span',{style:{marginLeft:'auto', fontSize:'11px', fontWeight:'700', color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', padding:'4px 8px', borderRadius:'999px'}}, 'Out of stock')
        )
      ),
      // description
      h('div', { style:{marginTop:'14px', background:'linear-gradient(180deg,#fff,#f8fafc)', border:'1px solid #e2e8f0', borderRadius:'14px', padding:'14px'} },
        h('div',{style:{fontSize:'11px', fontWeight:'800', letterSpacing:'0.08em', textTransform:'uppercase', color:'#334155', marginBottom:'6px'}}, 'About this tee'),
        h('p', { style: { margin:'0', lineHeight: '1.7', color:'#334155', fontSize:'14px' } }, product.description || 'Premium ZUNO tee — heavyweight, soft, and built for everyday. Pre-shrunk, bio-washed, and made in India.')
      ),
      h('div', { style:{height:'1px', background:'#e2e8f0', margin:'16px 0'} }),
      product.colors?.length ? h('div', {},
        h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center'} },
          h('span', { style:{fontSize:'11px', fontWeight:'800', letterSpacing:'0.08em', textTransform:'uppercase', color:'#0f172a'} }, 'Color'),
          h('span', { id:'pdpColorLabel', style:{fontSize:'12px', fontWeight:'700', color:'#1e40af', background:'#dbeafe', padding:'3px 8px', borderRadius:'999px'} }, selColor || '')
        ),
        colorRow,
        h('div',{style:{fontSize:'11px', color:'#64748b', marginTop:'6px'}}, (product.colors||[]).length + ' colour' + ((product.colors||[]).length>1?'s':'') + ' • Premium fabric dyes')
      ) : null,
      product.sizes?.length ? h('div', { style: { marginTop: '16px' } },
        h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center'} },
          h('span', { style:{fontSize:'11px', fontWeight:'800', letterSpacing:'0.08em', textTransform:'uppercase', color:'#0f172a'} }, 'Size'),
          sizeGuideBtn
        ),
        sizeRow,
        variantInfo,
        product.fit ? h('div', { style:{marginTop:'6px', fontSize:'12px', color:'#64748b', background:'#f1f5f9', padding:'6px 10px', borderRadius:'999px', display:'inline-flex', gap:'6px'} }, h('span',{style:{fontWeight:'700', color:'#0f172a'}}, 'Fit:'), product.fit, h('span',{style:{color:'#cbd5e1'}}, '•'), (product.fit==='oversized'?'Dropped shoulders': product.fit==='regular'?'True to size':'Relaxed drape')) : null
      ) : null,
      h('div', { style:{marginTop:'16px', display:'flex', alignItems:'center', gap:'12px'} },
        h('span', { style:{fontSize:'11px', fontWeight:'800', letterSpacing:'0.08em', textTransform:'uppercase', color:'#0f172a'} }, 'Qty'),
        h('div',{style:{display:'flex', alignItems:'center', border:'1px solid #e2e8f0', borderRadius:'999px', background:'#fff', overflow:'hidden'}}, qtyMinus, qtyInput, qtyPlus),
        h('span',{style:{fontSize:'11px', color:'#64748b', marginLeft:'auto'}}, 'Max 10 per order')
      ),
      h('div', { style:{display:'flex', gap:'10px', marginTop:'18px', alignItems:'stretch'} }, addBtn, buyBtn, wishBtn),
      h('div', { style:{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginTop:'14px'} },
        h('div',{style:{background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'12px', padding:'10px', textAlign:'center'}},
          h('div',{style:{fontSize:'16px'}}, '🚚'),
          h('div',{style:{fontSize:'11px', fontWeight:'700', color:'#166534'}}, 'Free shipping'),
          h('div',{style:{fontSize:'10px', color:'#15803d'}}, 'over ₹999')
        ),
        h('div',{style:{background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'12px', padding:'10px', textAlign:'center'}},
          h('div',{style:{fontSize:'16px'}}, '↩︎'),
          h('div',{style:{fontSize:'11px', fontWeight:'700', color:'#1e40af'}}, '7-day returns'),
          h('div',{style:{fontSize:'10px', color:'#1d4ed8'}}, 'Easy exchange')
        ),
        h('div',{style:{background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'12px', padding:'10px', textAlign:'center'}},
          h('div',{style:{fontSize:'16px'}}, '✓'),
          h('div',{style:{fontSize:'11px', fontWeight:'700', color:'#9a3412'}}, '240 GSM'),
          h('div',{style:{fontSize:'10px', color:'#c2410c'}}, 'Premium cotton')
        )
      ),
      h('div',{style:{marginTop:'12px', display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', fontSize:'11px', color:'#64748b'}},
        h('span',{style:{display:'inline-flex', gap:'6px', alignItems:'center', background:'#fff', border:'1px solid #e2e8f0', padding:'6px 10px', borderRadius:'999px'}}, '🔒 Secure payments'),
        h('span',{style:{display:'inline-flex', gap:'6px', alignItems:'center', background:'#fff', border:'1px solid #e2e8f0', padding:'6px 10px', borderRadius:'999px'}}, '🇮🇳 Made in India'),
        h('span',{style:{display:'inline-flex', gap:'6px', alignItems:'center', background:'#fff', border:'1px solid #e2e8f0', padding:'6px 10px', borderRadius:'999px'}}, '♻️ Bio-washed')
      )
    );

    // ── Premium Details Section ──
    const specEntries = product.specs ? Object.entries(product.specs) : [];
    const details = h('div', { style:{marginTop:'28px'} },
      h('div', { style:{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'14px'} },
        h('h3',{style:{margin:'0', fontFamily:'var(--font-display)', fontSize:'18px', color:'#f8fafc', letterSpacing:'-0.02em', textShadow:'0 1px 2px rgba(0,0,0,0.15)'}}, 'Product Details'),
        h('span',{style:{fontSize:'11px', letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:'700', color:'#cbd5e1', background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,255,255,0.15)', padding:'6px 10px', borderRadius:'999px'}}, 'Premium • ZUNO')
      ),
      h('div', { style:{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'14px'} },
        // Fabric & Care
        h('div', { style:{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'16px', padding:'18px', boxShadow:'0 4px 12px rgba(15,23,42,0.04)'} },
          h('div',{style:{display:'flex', gap:'10px', alignItems:'center', marginBottom:'10px'}},
            h('span',{style:{width:'36px', height:'36px', borderRadius:'10px', background:'linear-gradient(135deg,#0f172a,#334155)', color:'#fff', display:'grid', placeItems:'center', fontSize:'16px'}}, '◈'),
            h('h4',{style:{margin:'0', fontSize:'14px', color:'#0f172a'}}, 'Fabric & Care')
          ),
          h('div',{style:{fontSize:'13px', lineHeight:'1.7', color:'#334155'}},
            h('div',{}, h('span',{style:{fontWeight:'700', color:'#0f172a'}}, 'Fabric: '), product.fabric || 'Premium Cotton'),
            h('div',{}, h('span',{style:{fontWeight:'700', color:'#0f172a'}}, 'Care: '), product.careInstructions || 'Machine wash cold, tumble dry low. Do not bleach.'),
            specEntries.length ? h('div',{style:{marginTop:'10px', display:'flex', flexDirection:'column', gap:'6px'}}, ...specEntries.slice(0,6).map(([k,v])=> h('div',{style:{display:'flex', justifyContent:'space-between', fontSize:'12px', background:'#f8fafc', padding:'6px 10px', borderRadius:'8px', border:'1px solid #f1f5f9'}}, h('span',{style:{fontWeight:'700', color:'#334155'}}, k), h('span',{style:{color:'#0f172a', fontWeight:'600'}}, String(v))))) : null,
            product.colors?.length ? h('div',{style:{marginTop:'10px', fontSize:'12px', color:'#64748b'}}, `Available in ${product.colors.length} colours · ${product.sizes?.length||0} sizes`) : null
          )
        ),
        // Craftmanship
        h('div', { style:{background:'linear-gradient(135deg,#0f172a 0%, #1e293b 100%)', color:'#e2e8f0', borderRadius:'16px', padding:'18px', boxShadow:'0 8px 20px rgba(15,23,42,0.18)'} },
          h('div',{style:{display:'flex', gap:'10px', alignItems:'center', marginBottom:'10px'}},
            h('span',{style:{width:'36px', height:'36px', borderRadius:'10px', background:'rgba(255,255,255,0.12)', color:'#fff', display:'grid', placeItems:'center', fontSize:'16px', border:'1px solid rgba(255,255,255,0.15)'}}, '✦'),
            h('h4',{style:{margin:'0', fontSize:'14px', color:'#fff'}}, 'Why ZUNO')
          ),
          h('ul',{style:{margin:'0', paddingLeft:'18px', display:'flex', flexDirection:'column', gap:'8px', fontSize:'13px', lineHeight:'1.6', color:'#cbd5e1'}},
            h('li',{}, h('span',{style:{color:'#fff', fontWeight:'700'}}, '240 GSM'), ' heavyweight — no see-through, premium drape'),
            h('li',{}, h('span',{style:{color:'#fff', fontWeight:'700'}}, 'Pre-shrunk & bio-washed'), ' — stays true after wash'),
            h('li',{}, h('span',{style:{color:'#fff', fontWeight:'700'}}, 'Reinforced stitching'), ' — built for everyday, season after season'),
            h('li',{}, h('span',{style:{color:'#fff', fontWeight:'700'}}, 'Made in India'), ' — ethically made')
          )
        ),
        // Shipping
        h('div', { style:{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'16px', padding:'18px', boxShadow:'0 4px 12px rgba(15,23,42,0.04)'} },
          h('div',{style:{display:'flex', gap:'10px', alignItems:'center', marginBottom:'10px'}},
            h('span',{style:{width:'36px', height:'36px', borderRadius:'10px', background:'#eff6ff', color:'#1e40af', display:'grid', placeItems:'center', fontSize:'16px', border:'1px solid #dbeafe'}}, '⧉'),
            h('h4',{style:{margin:'0', fontSize:'14px', color:'#0f172a'}}, 'Shipping')
          ),
          h('div',{style:{fontSize:'13px', lineHeight:'1.7', color:'#334155'}},
            h('div',{}, h('span',{style:{fontWeight:'700'}}, 'Free'), ' standard shipping on orders over ₹999'),
            h('div',{style:{marginTop:'6px', color:'#64748b'}}, 'Dispatched in 24 hours. Express 2–3 days at checkout. Tracking via SMS & email.'),
            h('div',{style:{marginTop:'10px', display:'inline-flex', gap:'6px', background:'#f8fafc', border:'1px solid #e2e8f0', padding:'6px 10px', borderRadius:'999px', fontSize:'11px', fontWeight:'700', color:'#0f172a'}}, '🚚 Delivered in 3–5 days')
          )
        ),
        // Returns
        h('div', { style:{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'16px', padding:'18px', boxShadow:'0 4px 12px rgba(15,23,42,0.04)'} },
          h('div',{style:{display:'flex', gap:'10px', alignItems:'center', marginBottom:'10px'}},
            h('span',{style:{width:'36px', height:'36px', borderRadius:'10px', background:'#f0fdf4', color:'#15803d', display:'grid', placeItems:'center', fontSize:'16px', border:'1px solid #bbf7d0'}}, '↺'),
            h('h4',{style:{margin:'0', fontSize:'14px', color:'#0f172a'}}, 'Returns & Exchange')
          ),
          h('div',{style:{fontSize:'13px', lineHeight:'1.7', color:'#334155'}},
            h('div',{}, h('span',{style:{fontWeight:'700'}}, '7-day'), ' easy returns & size exchange'),
            h('div',{style:{marginTop:'6px', color:'#64748b'}}, 'Custom printed items are made to order — exchange only if defective.'),
            h('div',{style:{marginTop:'10px', display:'inline-flex', gap:'6px', background:'#fefce8', border:'1px solid #fef08a', padding:'6px 10px', borderRadius:'999px', fontSize:'11px', fontWeight:'700', color:'#854d0e'}}, 'Need help? support@zuno.app')
          )
        )
      )
    );

    const related = product.related?.length
      ? h('div', { class: 'section', style:{marginTop:'28px'} },
          h('div', { style:{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:'14px'} },
            h('h2', { style:{fontFamily:'var(--font-display)', fontSize:'18px', color:'#f8fafc', margin:'0', textShadow:'0 1px 2px rgba(0,0,0,0.15)'} }, 'You may also like'),
            h('a',{href:'#/shop', style:{fontSize:'12px', fontWeight:'700', color:'#e0e7ff', textDecoration:'none', border:'1px solid rgba(255,255,255,0.18)', padding:'6px 10px', borderRadius:'999px', background:'rgba(255,255,255,0.10)'}}, 'View all →')
          ),
          h('div', { class: 'grid grid-products' }, ...product.related.map(ProductCard)))
      : null;

    // ── Live Rating Section (store + fetch live, no glitch) ──
    let liveRating = product.rating || 0;
    let liveCount = product.ratingCount || 0;
    // large box refs for live update
    const largeRatingNum = h('div', { style:{fontSize:'32px', fontWeight:'900', lineHeight:'1'} }, String(liveRating || '—'));
    const largeStars = h('div', { style:{fontSize:'14px', color:'#fbbf24', marginTop:'4px'} }, '★★★★★'.slice(0, Math.round(liveRating)) + '☆☆☆☆☆'.slice(Math.round(liveRating) || 0));
    const largeCount = h('div', { style:{fontSize:'12px', color:'#cbd5e1', marginTop:'6px'} }, `${liveCount} ratings`);

    function setLiveRating(rating, count) {
      liveRating = rating; liveCount = count;
      topRatingBadge.textContent = `★ ${rating}`;
      topCountText.textContent = `· ${count} ratings`;
      largeRatingNum.textContent = String(rating || '—');
      largeStars.textContent = '★★★★★'.slice(0, Math.round(rating)) + '☆☆☆☆☆'.slice(Math.round(rating) || 0);
      largeCount.textContent = `${count} ratings`;
      product.rating = rating; product.ratingCount = count;
    }

    let reviewsData = { reviews: product.reviews || [], distribution: {1:0,2:0,3:0,4:0,5:0}, rating: liveRating, ratingCount: liveCount };
    try {
      const pid = product.id || product._id;
      const d = await api.get('/products/' + pid + '/reviews').catch(async () => await api.get('/reviews/products/' + pid + '/reviews').catch(()=> null));
      if (d) {
        reviewsData = d;
        setLiveRating(d.rating || liveRating, d.ratingCount || d.total || liveCount);
      } else if (reviewsData.reviews.length) {
        // fallback from product.reviews already
      }
    } catch {}

    const dist = reviewsData.distribution || {1:0,2:0,3:0,4:0,5:0};
    const maxDist = Math.max(1, ...Object.values(dist));
    const reviewListWrap = h('div', { style:{display:'flex', flexDirection:'column', gap:'10px', marginTop:'14px'} });
    function renderReviews() {
      reviewListWrap.innerHTML = '';
      const rows = reviewsData.reviews || [];
      if (!rows.length) {
        reviewListWrap.append(h('div', { style:{padding:'18px', textAlign:'center', color:'#64748b', background:'#f8fafc', border:'1px dashed #e2e8f0', borderRadius:'12px', fontSize:'13px'} }, 'No reviews yet — be the first to rate!'));
        return;
      }
      rows.slice(0, 8).forEach(rv => {
        const stars = '★★★★★'.slice(0, Math.round(rv.rating)) + '☆☆☆☆☆'.slice(Math.round(rv.rating));
        reviewListWrap.append(
          h('div', { style:{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'12px'} },
            h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center'} },
              h('span', { style:{fontWeight:'700', fontSize:'13px', color:'#0f172a'} }, rv.user_name || rv.userName || 'Anonymous'),
              h('span', { style:{fontSize:'11px', color:'#64748b'} }, rv.created_at ? new Date(rv.created_at).toLocaleDateString('en-IN') : '')
            ),
            h('div', { style:{fontSize:'12px', color:'#f59e0b', marginTop:'4px'} }, stars + `  ${rv.rating}/5`, rv.verified ? h('span', { style:{marginLeft:'8px', background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0', padding:'2px 6px', borderRadius:'999px', fontSize:'10px'} }, '✓ Verified') : null),
            rv.title ? h('div', { style:{fontWeight:'600', fontSize:'13px', marginTop:'6px', color:'#0f172a'} }, rv.title) : null,
            rv.body ? h('div', { style:{fontSize:'13px', color:'#334155', marginTop:'4px', lineHeight:'1.5'} }, rv.body) : null
          )
        );
      });
      if (rows.length > 8) reviewListWrap.append(h('div', { style:{fontSize:'12px', color:'#64748b', textAlign:'center', marginTop:'4px'} }, `Showing 8 of ${rows.length} reviews`));
    }
    renderReviews();

    let selectedRating = 0;
    const starBtns = [];
    const starRow = h('div', { style:{display:'flex', gap:'6px'} });
    for (let i=1;i<=5;i++) {
      const btn = h('button', { type:'button', style:{fontSize:'28px', background:'none', border:'none', cursor:'pointer', color:'#e2e8f0', padding:'2px 4px', transition:'transform 0.12s, color 0.12s'}, onclick:()=> setStars(i) }, '★');
      starBtns.push(btn); starRow.append(btn);
    }
    function setStars(n) {
      selectedRating = n;
      starBtns.forEach((b, idx)=> { b.style.color = idx < n ? '#f59e0b' : '#e2e8f0'; b.style.transform = idx < n ? 'scale(1.08)' : 'scale(1)'; });
      if (ratingHint) ratingHint.textContent = n ? `${n}/5 — ${['','Poor','Fair','Good','Very Good','Excellent'][n]}` : 'Tap to rate';
      if (ratingHint) ratingHint.style.color = n ? '#0f172a' : '#64748b';
    }
    const ratingHint = h('div', { style:{fontSize:'12px', color:'#64748b', marginTop:'4px', minHeight:'16px'} }, 'Tap to rate');
    const titleInput = h('input', { placeholder:'Title (optional)', style:{width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:'10px', fontSize:'13px'} });
    const bodyInput = h('textarea', { placeholder:'Share your experience… (optional)', style:{width:'100%', minHeight:'80px', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:'10px', fontSize:'13px', resize:'vertical'} });
    const submitMsg = h('div', { style:{fontSize:'12px', minHeight:'16px'} });
    const submitBtn = h('button', { class:'btn btn-primary', style:{padding:'10px 18px', borderRadius:'10px', background:'#0f172a', borderColor:'#0f172a', fontWeight:'700'}, onclick: async ()=>{
      if (!selectedRating) { submitMsg.textContent='Please select a rating (1-5)'; submitMsg.style.color='#dc2626'; return; }
      if (!Store.isAuthed()) { toast('Please sign in to rate', 'warning'); location.hash='#/login'; return; }
      submitBtn.disabled=true; submitBtn.textContent='Publishing…'; submitMsg.textContent='';
      try {
        const pid = product.id || product._id;
        let res = null;
        try { res = await api.post('/products/' + pid + '/reviews', { rating: selectedRating, title: titleInput.value.trim() || undefined, body: bodyInput.value.trim() || undefined }); }
        catch(e){ res = await api.post('/reviews/products/' + pid + '/reviews', { rating: selectedRating, title: titleInput.value.trim() || undefined, body: bodyInput.value.trim() || undefined }); }
        toast('Rating published — live!', 'success');
        submitMsg.textContent='✓ Live — thank you!'; submitMsg.style.color='#16a34a';
        titleInput.value=''; bodyInput.value=''; setStars(0);
        // refresh live stats without page reload
        try {
          const d = await api.get('/products/' + pid + '/reviews').catch(async ()=> await api.get('/reviews/products/' + pid + '/reviews'));
          if (d) { reviewsData = d; setLiveRating(d.rating || selectedRating, d.ratingCount || d.total || liveCount); Object.assign(dist, d.distribution||dist); renderReviews(); renderDist(); }
          else { // optimistic
            const newAvg = liveCount ? ((liveRating*liveCount + selectedRating)/(liveCount+1)) : selectedRating;
            setLiveRating(Number(newAvg.toFixed(1)), liveCount+1);
          }
        } catch {}
        // clear API cache so other views see live rating instantly
        try { api.clearCache && api.clearCache(); } catch {}
      } catch(e){ submitMsg.textContent=e.message||'Failed to publish'; submitMsg.style.color='#dc2626'; toast(e.message,'error'); }
      submitBtn.disabled=false; submitBtn.textContent='Publish rating';
    } }, 'Publish rating');

    const distWrap = h('div', { style:{marginTop:'10px'} });
    function renderDist(){
      distWrap.innerHTML='';
      for(let s=5;s>=1;s--){
        const c = dist[s]||0;
        const pct = Math.round((c / maxDist)*100);
        // recalc max live
        const curMax = Math.max(1, ...Object.values(dist));
        const w = curMax ? Math.round((c/curMax)*100) : 0;
        distWrap.append(
          h('div', { style:{display:'flex', gap:'8px', alignItems:'center', fontSize:'12px'} },
            h('span', { style:{width:'32px', fontWeight:'700', color:'#334155'} }, s+'★'),
            h('div', { style:{flex:'1', height:'8px', borderRadius:'999px', background:'#f1f5f9', overflow:'hidden'} }, h('div', { style:{width: w+'%', height:'100%', background:'#f59e0b', borderRadius:'999px'} })),
            h('span', { style:{width:'28px', color:'#64748b', fontWeight:'600'} }, String(c))
          )
        );
      }
    }
    renderDist();

    const ratingSection = h('div', { style:{marginTop:'28px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:'16px', padding:'18px', boxShadow:'0 8px 24px rgba(15,23,42,0.06)'} },
      h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'10px'} },
        h('h3', { style:{margin:'0', fontFamily:'var(--font-display)', fontSize:'18px', color:'#0f172a'} }, 'Ratings & Reviews'),
        h('span', { style:{fontSize:'11px', background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0', padding:'5px 10px', borderRadius:'999px', fontWeight:'700'} }, '● Live')
      ),
      h('div', { style:{display:'grid', gridTemplateColumns:'180px 1fr', gap:'16px', marginTop:'16px', alignItems:'start'} },
        h('div', { style:{background:'linear-gradient(135deg,#0f172a,#1e293b)', color:'#fff', borderRadius:'14px', padding:'16px', textAlign:'center'} },
          largeRatingNum,
          largeStars,
          largeCount,
          h('div', { style:{fontSize:'11px', color:'#93c5fd', marginTop:'4px'} }, 'Live average')
        ),
        h('div', {}, distWrap, h('div', { style:{fontSize:'11px', color:'#64748b', marginTop:'8px'} }, 'Tap a star to rate — updates live for everyone'))
      ),
      h('div', { style:{height:'1px', background:'#e2e8f0', margin:'18px 0'} }),
      h('div', { style:{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'14px'} },
        h('div', { style:{fontSize:'12px', fontWeight:'700', color:'#0f172a'} }, 'Write a review'),
        h('div', { style:{marginTop:'8px'} }, starRow, ratingHint),
        h('div', { style:{marginTop:'10px', display:'grid', gap:'8px'} }, titleInput, bodyInput),
        h('div', { style:{marginTop:'10px', display:'flex', gap:'8px', alignItems:'center'} }, submitBtn, submitMsg),
        h('div', { style:{fontSize:'11px', color:'#64748b', marginTop:'8px'} }, 'Your rating is stored and visible instantly. Refresh-safe — stored in database.')
      ),
      h('div', { style:{marginTop:'16px'} }, h('div', { style:{fontWeight:'700', fontSize:'13px', color:'#0f172a'} }, 'Customer reviews'), reviewListWrap)
    );

    root.append(crumb, h('div', { class: 'pdp', style:{gap:'20px'} }, gallery, info));
    root.append(details);
    root.append(ratingSection);
    if (related) root.append(related);
    return root;
  } catch (err) {
    root.innerHTML = '';
    if (err.status === 404) root.append(emptyState({ icon: '◐', title: 'Product not found', desc: 'This item is no longer available.', action: h('a', { class: 'btn btn-primary', href: '#/shop' }, 'Back to shop') }));
    else root.append(errorState(err.message, () => location.reload()));
    return root;
  }
}
