import { h, money, toast, productImage, resolveImageUrl, imgFallback } from '../ui.js';
import { api } from '../api.js';
import { Store } from '../store.js';
import { refreshCart, showCartDrawer } from '../components.js';

const COLORS = [
  { key: 'white', label: 'White', bg: '#ffffff', border: '#d8dee8' },
  { key: 'black', label: 'Black', bg: '#111111', border: '#111111' },
  { key: 'grey', label: 'Grey', bg: '#a3a3a3', border: '#a3a3a3' },
  { key: 'charcoal', label: 'Charcoal', bg: '#2a2a2a', border: '#2a2a2a' },
  { key: 'navy', label: 'Navy', bg: '#1e293b', border: '#1e293b' },
  { key: 'beige', label: 'Beige', bg: '#e8e6e1', border: '#d5d0c7' },
  { key: 'olive', label: 'Olive', bg: '#556b2f', border: '#556b2f' },
  { key: 'red', label: 'Red', bg: '#dc2626', border: '#dc2626' },
  { key: 'maroon', label: 'Maroon', bg: '#7f1d1d', border: '#7f1d1d' },
  { key: 'forest', label: 'Forest', bg: '#14532d', border: '#14532d' },
  { key: 'sage', label: 'Sage', bg: '#9caf88', border: '#9caf88' },
  { key: 'mustard', label: 'Mustard', bg: '#ca8a04', border: '#ca8a04' },
];
const SIZES = ['XS','S','M','L','XL','XXL','XXXL'];
let uid=0; function nextId(){ return 'el-'+(++uid)+'-'+Date.now().toString(36); }
function toPct(el){ if(typeof el.xPct==='number' && typeof el.yPct==='number') return el; const x=typeof el.x==='number'?el.x:140; const y=typeof el.y==='number'?el.y:170; const xPct=x>100?(x/280)*100:x; const yPct=y>100?(y/340)*100:y; el.xPct=Math.max(4,Math.min(96,xPct)); el.yPct=Math.max(4,Math.min(96,yPct)); return el; }
function shade(hex,amt){ try{let c=hex.replace('#',''); if(c.length===3) c=c.split('').map(x=>x+x).join(''); let n=parseInt(c,16); let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt; r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b)); return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');}catch{return hex;} }
function teeSVG(bg,side){ const dark=shade(bg,-28),darker=shade(bg,-55),light=shade(bg,18); const isFront=side==='front'; const neck=isFront?`<path d="M118 28 C 130 52, 170 52, 182 28 C 170 38, 130 38, 118 28 Z" fill="${dark}" stroke="${darker}" stroke-width="2"/>`:`<path d="M118 28 C 132 38, 168 38, 182 28 L 182 24 L 118 24 Z" fill="${dark}" stroke="${darker}" stroke-width="2"/>`; return `<svg viewBox="0 0 300 330" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><linearGradient id="teeGrad-${side}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}" stop-opacity="0.55"/><stop offset="0.5" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${dark}" stop-opacity="0.5"/></linearGradient></defs><path d="M118 24 L84 38 L34 92 L68 114 L86 92 L86 304 C86 310 90 314 96 314 L204 314 C210 314 214 310 214 304 L214 92 L232 114 L266 92 L216 38 L182 24 C 168 34, 132 34, 118 24 Z" fill="${bg}" stroke="${darker}" stroke-width="2.5" stroke-linejoin="round"/><path d="M118 24 L84 38 L34 92 L68 114 L86 92 L86 304 C86 310 90 314 96 314 L204 314 C210 314 214 310 214 304 L214 92 L232 114 L266 92 L216 38 L182 24 C 168 34, 132 34, 118 24 Z" fill="url(#teeGrad-${side})"/>${neck}<path d="M86 92 L68 114" stroke="${darker}" stroke-width="2" opacity="0.6"/><path d="M214 92 L232 114" stroke="${darker}" stroke-width="2" opacity="0.6"/><path d="M86 100 L86 300" stroke="${darker}" stroke-width="1" opacity="0.22"/><path d="M214 100 L214 300" stroke="${darker}" stroke-width="1" opacity="0.22"/><path d="M96 300 L204 300" stroke="${darker}" stroke-width="1.4" opacity="0.35"/>${isFront?'':`<text x="150" y="72" text-anchor="middle" font-size="10" letter-spacing="3" fill="${darker}" opacity="0.55" font-weight="800">BACK</text>`}</svg>`; }

export async function Customize(ctx={}){
  const params=(ctx&&ctx.params)?ctx.params:{};
  const slugParam=params.slug||null;
  const root=h('div', { class:'container section', style:{maxWidth:'1100px', width:'100%', margin:'0 auto', boxSizing:'border-box', background:'#fff', minHeight:'70vh'} });

  let products=[];
  try{
    const r=await api.get('/products', {module:'shop', limit:50, customizable:'1'});
    let items=r.items||[];
    if(r.total===0){ const r2=await api.get('/products', {module:'shop', limit:50}); items=(r2.items||[]).filter(p=>p.customizable); }
    else if(!items.some(p=>p.customizable)) items=(r.items||[]).filter(p=>p.customizable);
    products=items;
    if(!products.length){ const r2=await api.get('/products', {module:'shop', limit:20}); products=r2.items||[]; }
  }catch{ try{ const r=await api.get('/products',{module:'shop', limit:20}); products=r.items||[];}catch{} }

  let selectedProduct=products[0]||null;
  if(slugParam && products.length){
    const found=products.find(p=>String(p.slug)===String(slugParam));
    if(found) selectedProduct=found;
    else { try{ const {product}=await api.get('/products/'+slugParam).catch(()=>({})); if(product) selectedProduct=product; }catch{} }
  }
  let color=(selectedProduct?.colors?.[0])||'white';
  let size=(selectedProduct?.sizes?.[0])||'M';
  let fit=selectedProduct?.fit||'regular';
  let side='front', front=[], back=[], selectedId=null, designName='', editingDesignId=new URLSearchParams(location.hash.split('?')[1]||'').get('id')||null;
  const editCartId=new URLSearchParams(location.hash.split('?')[1]||'').get('editCart');
  const editGuestId=new URLSearchParams(location.hash.split('?')[1]||'').get('editGuest');
  let step=1;
  if(editCartId && Store.isAuthed()){
    try{ const sum=await api.get('/cart/summary').catch(()=>null); const it=sum?.shop?.items?.find(x=>String(x.productId)===String(editCartId)); if(it){ if(it.customization){ const c=it.customization; front=(c.front?.elements||[]).map(toPct); back=(c.back?.elements||[]).map(toPct);} color=it.variant?.color||color; size=it.variant?.size||size; fit=it.variant?.fit||fit; const prod=products.find(p=>String(p.id)===String(it.productId)||String(p.slug)===String(it.slug)); if(prod) selectedProduct=prod; step=2; } }catch{}
  }else if(editGuestId){
    try{ const guest=Store.getGuest().find(g=>String(g.productId)===String(editGuestId)); if(guest){ if(guest.customization){ front=(guest.customization.front?.elements||[]).map(toPct); back=(guest.customization.back?.elements||[]).map(toPct);} color=guest.variant?.color||color; size=guest.variant?.size||size; fit=guest.variant?.fit||fit; const prod=products.find(p=>String(p.id)===String(guest.productId)); if(prod) selectedProduct=prod; step=2; } }catch{}
  }
  if(editingDesignId && Store.isAuthed()){
    try{ const {design}=await api.get('/custom-designs/'+editingDesignId); if(design){ color=design.color||color; size=design.size||size; fit=design.fit||fit; const data=typeof design.designData==='string'?JSON.parse(design.designData):design.designData; front=(data.front?.elements||[]).map(toPct); back=(data.back?.elements||[]).map(toPct); designName=design.name||''; if(design.product_id){ const prod=products.find(p=>p.id===design.product_id); if(prod) selectedProduct=prod; } } }catch{}
  }
  const getActive=()=> side==='front'?front:back;

  // --- Step indicator (compact, Bewakoof-like) ---
  function stepIndicator(){
    const steps=['Pick Color & Size','Finalise Design','Preview'];
    const row=h('div', { style:{display:'flex', alignItems:'center', justifyContent:'center', gap:'0', padding:'14px 0', borderBottom:'1px solid #e5e7eb', marginBottom:'16px', background:'#fff', position:'sticky', top:'0', zIndex:'5'} });
    steps.forEach((label,idx)=>{
      const n=idx+1; const isActive=step===n; const isDone=step>n;
      const num=h('span', { style:{width:'26px', height:'26px', borderRadius:'50%', display:'inline-grid', placeItems:'center', fontWeight:'800', fontSize:'11px', border:'1.5px solid '+(isActive?'#fdd835': isDone?'#212121':'#e5e7eb'), background: isActive?'#fdd835': isDone?'#212121':'#fff', color: isActive?'#212121': isDone?'#fff':'#9e9e9e', marginRight:'8px'} }, isDone?'✓':String(n));
      const text=h('span', { style:{fontFamily:'Montserrat, sans-serif', fontSize:'12px', fontWeight: isActive?'700':'500', color: isActive?'#212121': isDone?'#212121':'#9e9e9e', letterSpacing:'0.02em'} }, label);
      const line= idx<2 ? h('div', { style:{width:'40px', height:'1px', background: isDone?'#212121':'#e5e7eb', margin:'0 12px'} }) : null;
      const item=h('div', { style:{display:'flex', alignItems:'center', cursor: isDone?'pointer':'default', opacity: isActive||isDone?1:0.7}, onclick:()=>{ if(isDone){ step=n; render(); } } }, num, text, line);
      row.append(item);
    });
    return row;
  }

  // --- Helpers ---
  const getColorDef=(k)=> COLORS.find(x=>x.key===k) || {key:k, label:k, bg:'#e5e7eb', border:'#e5e7eb'};
  function sizeStock(s){
    const v=selectedProduct?.variants?.find(v=> String(v.size)===String(s) && (!color || String(v.color)===String(color)));
    if(v) return v.stock;
    const v2=selectedProduct?.variants?.find(v=> String(v.size)===String(s));
    if(v2) return v2.stock;
    return selectedProduct?.stock ?? null;
  }

  // --- Canvas ---
  const teeBody=h('div', { style:{position:'relative', width:'min(320px, 78vw)', aspectRatio:'300/330', margin:'0 auto'} });
  const printArea=h('div', { style:{position:'absolute', left:'50%', top:'54%', transform:'translate(-50%,-50%)', width:'46%', height:'44%', border:'1px dashed rgba(0,0,0,0.18)', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'rgba(255,255,255,0.06)'} }, h('span', { style:{fontSize:'9px', letterSpacing:'0.14em', color:'rgba(0,0,0,0.28)', fontWeight:'700', pointerEvents:'none'} }, 'PRINT AREA'));
  teeBody.append(printArea);
  let zoomLevel=1;
  function renderPreview(){
    const c=COLORS.find(x=>x.key===color)||COLORS[0];
    teeBody.style.background='transparent';
    // keep printArea, remove old elements
    teeBody.querySelectorAll('.custom-el, .custom-empty').forEach(el=>el.remove());
    const svgWrap=h('div', { style:{position:'absolute', inset:'0', filter:'drop-shadow(0 8px 18px rgba(0,0,0,0.08))'}, html: teeSVG(c.bg, side) });
    teeBody.prepend(svgWrap);
    const active=getActive().map(toPct);
    if(!active.length){
      printArea.append(h('div', { class:'custom-empty', style:{textAlign:'center', color:'#9e9e9e', fontSize:'11px', padding:'8px'} }, h('div', {style:{fontSize:'18px'}},'✦'), h('div',{}, side==='front'?'Front design':'Back design')));
    } else active.forEach(el=> printArea.append(renderElement(el, c)));
    // update print area from product config
    try{
      const pa= side==='front' ? (selectedProduct?.printAreaFront||selectedProduct?.print_area_front) : (selectedProduct?.printAreaBack||selectedProduct?.print_area_back);
      const parsed= typeof pa==='string'?JSON.parse(pa):pa;
      if(parsed && parsed.w && parsed.h){ printArea.style.width=parsed.w+'%'; printArea.style.height=parsed.h+'%'; printArea.style.top=(parsed.y||54)+'%'; }
    }catch{}
  }
  function renderElement(el, shirtColor){
    toPct(el);
    const isSelected=el.id===selectedId;
    const wrap=h('div', { class:'custom-el'+(isSelected?' selected':''), 'data-id':el.id, style:{position:'absolute', left:el.xPct+'%', top:el.yPct+'%', transform:`translate(-50%,-50%) scale(${el.scale||1}) rotate(${el.rotation||0}deg)`, padding:'2px', border: isSelected?'1px solid #212121':'1px solid transparent', borderRadius:'4px', cursor:'move', background: isSelected?'rgba(253,216,53,0.08)':'transparent'} });
    wrap.addEventListener('click', (e)=>{ e.stopPropagation(); selectedId=el.id; render(); });
    if(el.type==='text'){
      wrap.append(h('span', { style:{fontFamily:el.fontFamily||'Montserrat, sans-serif', fontSize:el.fontSize+'px', color:el.color||'#212121', fontWeight:el.bold?'800':'600', fontStyle:el.italic?'italic':'normal', whiteSpace:'nowrap', display:'block', lineHeight:'1.1'} }, el.value||'Text'));
    } else if(el.type==='image'){
      wrap.append(h('img', { src:el.url, alt:'design', draggable:'false', style:{width: (el.width||110)+'px', height:'auto', display:'block', pointerEvents:'none', borderRadius:'2px'} }));
    }
    if(isSelected){
      const del=h('button', { style:{position:'absolute', top:'-10px', right:'-10px', width:'20px', height:'20px', borderRadius:'50%', background:'#212121', color:'#fff', border:'none', fontSize:'11px', cursor:'pointer'} }, '×');
      del.onclick=(e)=>{ e.stopPropagation(); const a=getActive(); const idx=a.findIndex(x=>x.id===el.id); if(idx>-1) a.splice(idx,1); selectedId=null; render(); };
      const dup=h('button', { style:{position:'absolute', top:'-10px', left:'-10px', width:'20px', height:'20px', borderRadius:'50%', background:'#fff', color:'#212121', border:'1px solid #e5e7eb', fontSize:'11px', cursor:'pointer'} }, '⧉');
      dup.onclick=(e)=>{ e.stopPropagation(); const a=getActive(); const c={...el, id:nextId(), xPct:Math.min(96,el.xPct+4)}; delete c.x; delete c.y; a.push(c); selectedId=c.id; render(); };
      wrap.append(del, dup);
    }
    let sx=0,sy=0,ox=0,oy=0,drag=false;
    wrap.addEventListener('pointerdown', (e)=>{
      if(e.target.closest('button')) return;
      e.preventDefault(); drag=true; selectedId=el.id;
      try{ wrap.setPointerCapture(e.pointerId);}catch{}
      sx=e.clientX; sy=e.clientY; ox=el.xPct; oy=el.yPct;
      wrap.style.zIndex='5';
    });
    const move=(e)=>{
      if(!drag) return;
      const rect=printArea.getBoundingClientRect();
      if(!rect.width) return;
      const dx=((e.clientX-sx)/rect.width)*100;
      const dy=((e.clientY-sy)/rect.height)*100;
      el.xPct=Math.max(4,Math.min(96,ox+dx));
      el.yPct=Math.max(4,Math.min(96,oy+dy));
      wrap.style.left=el.xPct+'%'; wrap.style.top=el.yPct+'%';
    };
    const up=(e)=>{ if(!drag) return; drag=false; wrap.style.zIndex=''; try{ wrap.releasePointerCapture(e.pointerId);}catch{} render(); };
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    return wrap;
  }

  // --- Step renderers ---
  function canGoNext(){
    if(step===1){
      if(!color){ toast('Select color','warning'); return false; }
      if(!size){ toast('Select size','warning'); return false; }
      const v=selectedProduct?.variants?.find(v=>String(v.size)===String(size) && (!color || String(v.color)===String(color))) || selectedProduct?.variants?.find(v=>String(v.size)===String(size));
      if(v && v.stock===0){ toast('Out of stock','error'); return false; }
    }
    if(step===2 && !front.length && !back.length){ toast('Add text or image','warning'); return false; }
    return true;
  }

  function render(){
    root.innerHTML='';
    root.append(
      h('div', { style:{display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', flexWrap:'wrap', marginBottom:'8px'} },
        h('div', {},
          h('h1', { style:{fontFamily:'Montserrat, sans-serif', fontSize:'18px', fontWeight:'800', color:'#212121', margin:'0', letterSpacing:'-0.02em'} }, selectedProduct? `Custom: ${selectedProduct.name}` : 'ZUNO Custom'),
          h('div', { style:{fontSize:'11px', color:'#9e9e9e', marginTop:'2px', fontFamily:'Montserrat, sans-serif'} }, selectedProduct? `${selectedProduct.colors?.length||0} colors • ${selectedProduct.sizes?.length||0} sizes • ${money(selectedProduct.price)}` : '3-step customization')
        ),
        h('a', { href:'#/custom', class:'btn', style:{border:'0.67px solid #e5e7eb', background:'#fff', fontSize:'11px'} }, '← All Custom')
      ),
      stepIndicator()
    );

    if(step===1){
      // Step 1: T-shirt left, controls right — clean, not 3 columns
      const left = h('div', { style:{flex:'1', minWidth:'280px', display:'flex', justifyContent:'center', alignItems:'center', background:'#fafafa', border:'0.67px solid #e5e7eb', borderRadius:'12px', padding:'24px'} }, teeBody);
      // Build color swatches from product
      const colorBox=h('div', { style:{display:'flex', flexWrap:'wrap', gap:'10px', marginTop:'8px'} });
      const keys=(selectedProduct?.colors?.length)?selectedProduct.colors:COLORS.map(c=>c.key);
      keys.forEach(k=>{
        const c=COLORS.find(x=>x.key===k)||{key:k,label:k,bg:'#e5e7eb',border:'#e5e7eb'};
        const sw=h('button', { type:'button', style:{width:'36px', height:'36px', borderRadius:'50%', background:c.bg, border: k===color?'2px solid #212121':'1px solid #e5e7eb', boxShadow: k===color?'0 0 0 2px #fff, 0 0 0 4px #212121':''}, title:c.label, onclick:()=>{ color=k; render(); toast(`Color ${c.label}`,'success'); } });
        colorBox.append(h('div', { style:{textAlign:'center'} }, sw, h('div', {style:{fontSize:'10px', color:'#9e9e9e', marginTop:'4px', fontFamily:'Montserrat, sans-serif'}}, c.label)));
      });
      const sizeBox=h('div', { style:{display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'8px'} });
      const sizes=(selectedProduct?.sizes?.length)?selectedProduct.sizes:SIZES;
      sizes.forEach(s=>{
        const st=(()=>{ const v=selectedProduct?.variants?.find(v=>String(v.size)===String(s) && String(v.color)===String(color)); if(v) return v.stock; const v2=selectedProduct?.variants?.find(v=>String(v.size)===String(s)); if(v2) return v2.stock; return selectedProduct?.stock ?? null; })();
        const out=st===0, low=st!==null&&st>0&&st<=5;
        const b=h('button', { type:'button', disabled:out, style:{minWidth:'52px', padding:'10px 14px', borderRadius:'8px', border: s===size?'1.5px solid #212121':'0.67px solid #e5e7eb', background: s===size?'#212121':'#fff', color: s===size?'#fff':'#363537', fontFamily:'Montserrat, sans-serif', fontWeight:'600', fontSize:'13px', opacity: out?0.4:'1', textDecoration: out?'line-through':''}, onclick:()=>{ size=s; render(); } }, s + (out?' — Out': low?` · ${st} left`:'' ));
        sizeBox.append(b);
      });
      const right=h('div', { style:{flex:'1', minWidth:'300px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'12px', padding:'20px', fontFamily:'Montserrat, sans-serif'} },
        h('h3', { style:{fontSize:'13px', fontWeight:'700', letterSpacing:'0.08em', textTransform:'uppercase', color:'#212121', margin:'0'} }, 'Select Color'),
        colorBox,
        h('div', { style:{marginTop:'18px', fontSize:'13px', fontWeight:'700', letterSpacing:'0.08em', textTransform:'uppercase', color:'#212121'} }, 'Select Size'),
        sizeBox,
        h('div', { style:{marginTop:'8px', fontSize:'11px', color:'#9e9e9e'} }, h('span', { style:{textDecoration:'underline', cursor:'pointer'}, onclick:()=> toast('Sizes: XS 40" bust, S 42", M 44", L 46", XL 48", XXL 50", XXXL 52"','info') }, 'Size Guide')),
        h('div', { style:{marginTop:'6px', display:'flex', gap:'8px', fontSize:'11px', color:'#9e9e9e'} }, h('span',{},`Front Length 28"  |`), h('span',{},`Sleeve 6"  |`), h('span',{},`Bust 44"`)),
        h('button', { style:{marginTop:'18px', width:'100%', padding:'14px', background:'#212121', color:'#fff', border:'none', borderRadius:'8px', fontWeight:'700', fontFamily:'Montserrat, sans-serif', cursor:'pointer', transition:'all 0.2s'}, onclick:()=>{ if(!canGoNext()) return; step=2; render(); } }, 'NEXT →')
      );
      const wrap=h('div', { style:{display:'flex', gap:'20px', alignItems:'flex-start', flexWrap:'wrap', fontFamily:'Montserrat, sans-serif'} }, left, right);
      // Mobile: stack
      const styleEl=h('style', {}, '@media(max-width:760px){ .custom-step1-wrap{flex-direction:column} .custom-step1-wrap > div{width:100%!important} }');
      wrap.classList.add('custom-step1-wrap');
      root.append(styleEl, wrap);
      renderPreview();
    } else if(step===2){
      // Step 2: T-shirt centered, bottom toolbar
      const canvasWrap=h('div', { style:{display:'flex', flexDirection:'column', alignItems:'center', gap:'12px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'12px', padding:'16px', fontFamily:'Montserrat, sans-serif'} },
        h('div', { style:{display:'flex', gap:'8px', alignItems:'center'} },
          h('button', { style:{padding:'8px 18px', borderRadius:'999px', border: side==='front'?'1.5px solid #212121':'0.67px solid #e5e7eb', background: side==='front'?'#212121':'#fff', color: side==='front'?'#fff':'#363537', fontWeight:'700', fontSize:'12px', cursor:'pointer'}, onclick:()=>{ side='front'; render(); } }, 'FRONT'),
          h('button', { style:{padding:'8px 18px', borderRadius:'999px', border: side==='back'?'1.5px solid #212121':'0.67px solid #e5e7eb', background: side==='back'?'#212121':'#fff', color: side==='back'?'#fff':'#363537', fontWeight:'700', fontSize:'12px', cursor:'pointer'}, onclick:()=>{ side='back'; render(); } }, 'BACK'),
          h('span', { style:{marginLeft:'8px', fontSize:'11px', color:'#9e9e9e'} }, 'FLIP to switch sides — designs saved per side')
        ),
        teeBody
      );
      // Bottom toolbar — Add Text / Upload / Gallery compact
      let showText=false, showGallery=false;
      const textInput=h('input', { placeholder:'Enter text — e.g. ZUNO', style:{flex:'1', minWidth:'180px', padding:'10px 12px', border:'0.67px solid #e5e7eb', borderRadius:'8px', fontFamily:'Montserrat, sans-serif'} });
      const fontSel=h('select', { style:{padding:'8px', border:'0.67px solid #e5e7eb', borderRadius:'8px', fontFamily:'Montserrat, sans-serif'} }, ...[
        {k:'Montserrat', l:'Montserrat'}, {k:'Inter', l:'Inter'}, {k:'Playfair Display', l:'Playfair'}, {k:'Georgia', l:'Serif'}
      ].map(f=> h('option', {value:f.k}, f.l)));
      const colorPick=h('input', { type:'color', value:'#212121', style:{width:'36px', height:'36px', padding:'2px', border:'0.67px solid #e5e7eb', borderRadius:'8px'} });
      const sizeRange=h('input', { type:'range', min:'14', max:'64', value:'26', style:{flex:'1'} });
      let isBold=false, isItalic=false;
      const boldBtn=h('button', { style:{padding:'8px 10px', border:'0.67px solid #e5e7eb', borderRadius:'6px', fontWeight:'800', background:'#fff', cursor:'pointer'} }, 'B');
      const italicBtn=h('button', { style:{padding:'8px 10px', border:'0.67px solid #e5e7eb', borderRadius:'6px', fontStyle:'italic', background:'#fff', cursor:'pointer'} }, 'I');
      boldBtn.onclick=()=>{ isBold=!isBold; boldBtn.style.background=isBold?'#212121':'#fff'; boldBtn.style.color=isBold?'#fff':'#212121'; };
      italicBtn.onclick=()=>{ isItalic=!isItalic; italicBtn.style.background=isItalic?'#212121':'#fff'; italicBtn.style.color=isItalic?'#fff':'#212121'; };
      const addTextAction=h('button', { style:{padding:'10px 16px', background:'#212121', color:'#fff', border:'none', borderRadius:'8px', fontWeight:'700', cursor:'pointer'} }, 'Add');
      addTextAction.onclick=()=>{
        const el={id:nextId(), type:'text', value:textInput.value.trim()||'ZUNO', xPct:50, yPct:42, scale:1, rotation:0, fontFamily:fontSel.value, fontSize:Number(sizeRange.value), color:colorPick.value, bold:isBold, italic:isItalic};
        getActive().push(el); selectedId=el.id; textInput.value=''; render();
      };
      const textPanel=h('div', { style:{display:'none', gap:'8px', alignItems:'center', flexWrap:'wrap', padding:'12px', background:'#fafafa', border:'0.67px solid #e5e7eb', borderRadius:'8px', marginTop:'8px'} }, textInput, fontSel, colorPick, sizeRange, boldBtn, italicBtn, addTextAction);
      const fileInput=h('input', { type:'file', accept:'.png,.jpg,.jpeg,.webp', style:{display:'none'} });
      const uploadPanel=h('div', { style:{display:'none', padding:'12px', background:'#fafafa', border:'0.67px solid #e5e7eb', borderRadius:'8px', marginTop:'8px', fontSize:'11px', color:'#9e9e9e'} }, 'PNG, JPG, WEBP up to 5MB — tap to upload');
      uploadPanel.onclick=()=> fileInput.click();
      fileInput.onchange=async()=>{
        const f=fileInput.files[0]; if(!f) return;
        if(!['image/png','image/jpeg','image/webp','image/jpg'].includes(f.type)){ toast('Only PNG, JPG, WEBP','error'); return; }
        if(f.size>5*1024*1024){ toast('Under 5MB','error'); return; }
        const r=new FileReader(); r.onload=()=>{
          const img=new Image(); img.onload=()=>{ const el={id:nextId(), type:'image', url:r.result, xPct:50, yPct:50, scale:1, rotation:0, width: Math.min(130, img.width)}; getActive().push(el); selectedId=el.id; render(); }; img.src=r.result;
        }; r.readAsDataURL(f); fileInput.value='';
      };
      const galleryPanel=h('div', { style:{display:'none', padding:'12px', background:'#fafafa', border:'0.67px solid #e5e7eb', borderRadius:'8px', marginTop:'8px', textAlign:'center', fontSize:'11px', color:'#9e9e9e'} }, 'Gallery — ZUNO designs managed by Admin (coming soon). Use Upload for now.');
      const toolbar=h('div', { style:{display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap', marginTop:'12px'} },
        h('button', { style:{flex:'1', maxWidth:'160px', padding:'12px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'8px', fontWeight:'700', fontFamily:'Montserrat, sans-serif', cursor:'pointer'}, onclick:()=>{ textPanel.style.display=textPanel.style.display==='none'?'flex':'none'; uploadPanel.style.display='none'; galleryPanel.style.display='none'; } }, 'Add Text'),
        h('button', { style:{flex:'1', maxWidth:'160px', padding:'12px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'8px', fontWeight:'700', cursor:'pointer'}, onclick:()=>{ uploadPanel.style.display=uploadPanel.style.display==='none'?'block':'none'; textPanel.style.display='none'; galleryPanel.style.display='none'; } }, 'Upload'),
        h('button', { style:{flex:'1', maxWidth:'160px', padding:'12px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'8px', fontWeight:'700', cursor:'pointer'}, onclick:()=>{ galleryPanel.style.display=galleryPanel.style.display==='none'?'block':'none'; textPanel.style.display='none'; uploadPanel.style.display='none'; } }, 'Gallery')
      );
      const nav=h('div', { style:{display:'flex', justifyContent:'space-between', gap:'12px', marginTop:'16px'} },
        h('button', { style:{padding:'12px 18px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'8px', fontWeight:'700', cursor:'pointer'}, onclick:()=>{ step=1; render(); } }, '← Back'),
        h('button', { style:{flex:'1', maxWidth:'320px', padding:'14px', background:'#fdd835', color:'#212121', border:'none', borderRadius:'8px', fontWeight:'800', cursor:'pointer'}, onclick:()=>{ if(!canGoNext()) return; step=3; render(); } }, 'Next → Preview')
      );
      root.append(canvasWrap, toolbar, textPanel, uploadPanel, galleryPanel, nav);
      renderPreview();
    } else {
      // Step 3 Preview
      const canvasWrap=h('div', { style:{display:'flex', flexDirection:'column', alignItems:'center', gap:'12px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'12px', padding:'20px'} },
        h('div', { style:{display:'flex', gap:'8px'} },
          h('button', { style:{padding:'8px 16px', borderRadius:'999px', border: side==='front'?'1.5px solid #212121':'0.67px solid #e5e7eb', background: side==='front'?'#212121':'#fff', color: side==='front'?'#fff':'#363537', fontWeight:'700', fontSize:'11px', cursor:'pointer'}, onclick:()=>{ side='front'; render(); } }, 'FRONT'),
          h('button', { style:{padding:'8px 16px', borderRadius:'999px', border: side==='back'?'1.5px solid #212121':'0.67px solid #e5e7eb', background: side==='back'?'#212121':'#fff', color: side==='back'?'#fff':'#363537', fontWeight:'700', fontSize:'11px', cursor:'pointer'}, onclick:()=>{ side='back'; render(); } }, 'BACK')
        ),
        teeBody
      );
      const basePaise=selectedProduct?selectedProduct.price:129900;
      let extra=0; if(front.length) extra+= Number(selectedProduct?.customExtraFront ?? 10000); if(back.length) extra+= Number(selectedProduct?.customExtraBack ?? 10000);
      const total=basePaise+extra;
      const details=h('div', { style:{background:'#fafafa', border:'0.67px solid #e5e7eb', borderRadius:'12px', padding:'16px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', color:'#363537'} },
        h('div', { style:{display:'flex', justifyContent:'space-between', fontWeight:'700'} }, h('span',{},'Color'), h('span',{}, color)),
        h('div', { style:{display:'flex', justifyContent:'space-between', marginTop:'6px'} }, h('span',{},'Size'), h('span',{}, size)),
        h('div', { style:{display:'flex', justifyContent:'space-between', marginTop:'6px'} }, h('span',{},'Fit'), h('span',{}, fit)),
        h('div', { style:{borderTop:'0.67px solid #e5e7eb', margin:'12px 0'} }),
        h('div', { style:{fontWeight:'700', fontSize:'11px', letterSpacing:'0.08em', textTransform:'uppercase'} }, 'Customization'),
        h('div', { style:{marginTop:'6px', fontSize:'11px', color:'#757575'} }, `${front.length} front · ${back.length} back · ${front.length+back.length} elements`),
        h('div', { style:{display:'flex', justifyContent:'space-between', marginTop:'12px', fontWeight:'800', fontSize:'14px'} }, h('span',{},'Total'), h('span',{}, money(total))),
        h('div', { style:{marginTop:'12px', padding:'10px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'8px', fontSize:'11px', color:'#757575'} }, h('div', {style:{fontWeight:'700', color:'#212121'}}, 'Terms & Conditions'), h('div',{},'Custom printed items are made to order — exchange only if defective. Preview shows actual print placement.')),
        h('div', { style:{marginTop:'8px', padding:'10px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'8px', fontSize:'11px', color:'#757575'} }, h('div', {style:{fontWeight:'700', color:'#212121'}}, 'About This Product'), h('div',{}, selectedProduct?.description || 'Premium 240 GSM cotton, garment-washed, ZUNO fit.'))
      );
      const nav=h('div', { style:{display:'flex', gap:'12px', marginTop:'16px', flexWrap:'wrap'} },
        h('button', { style:{padding:'12px 18px', background:'#fff', border:'0.67px solid #e5e7eb', borderRadius:'8px', fontWeight:'700', flex:'1', cursor:'pointer'}, onclick:()=>{ step=2; render(); } }, '← Back to Design'),
        h('button', { style:{flex:'1', padding:'14px', background:'#212121', color:'#fff', border:'none', borderRadius:'8px', fontWeight:'800', cursor:'pointer'}, onclick:()=> addToCart() }, `Add to Bag — ${money(total)}`)
      );
      root.append(canvasWrap, details, nav);
      renderPreview();
    }
  }

  function renderPreview(){
    const c=COLORS.find(x=>x.key===color)||COLORS[0];
    teeBody.innerHTML='';
    const svgWrap=h('div', { style:{position:'absolute', inset:'0'} , html: teeSVG(c.bg, side) });
    teeBody.append(svgWrap, printArea);
    printArea.querySelectorAll('.custom-el, .custom-empty').forEach(el=>el.remove());
    const active=getActive().map(toPct);
    if(!active.length){
      printArea.append(h('div', { class:'custom-empty', style:{textAlign:'center', color:'#9e9e9e', fontSize:'11px'} }, h('div',{}, side==='front'?'Front design':'Back design')));
    } else active.forEach(el=> printArea.append(renderElement(el, c)));
    try{
      const pa= side==='front' ? (selectedProduct?.printAreaFront||selectedProduct?.print_area_front) : (selectedProduct?.printAreaBack||selectedProduct?.print_area_back);
      const parsed= typeof pa==='string'?JSON.parse(pa):pa;
      if(parsed && parsed.w && parsed.h){ printArea.style.width=parsed.w+'%'; printArea.style.height=parsed.h+'%'; printArea.style.top=(parsed.y||54)+'%'; }
    }catch{}
  }
  function renderElement(el, sc){
    toPct(el);
    const isSel=el.id===selectedId;
    const wrap=h('div', { class:'custom-el'+(isSel?' selected':''), style:{position:'absolute', left:el.xPct+'%', top:el.yPct+'%', transform:`translate(-50%,-50%) scale(${el.scale||1}) rotate(${el.rotation||0}deg)`, border: isSel?'1px solid #212121':'1px solid transparent', background: isSel?'rgba(253,216,53,0.1)':'transparent', borderRadius:'4px', padding:'2px', cursor:'move'} });
    wrap.onclick=(e)=>{ e.stopPropagation(); selectedId=el.id; render(); };
    if(el.type==='text') wrap.append(h('span', { style:{fontFamily:el.fontFamily||'Montserrat, sans-serif', fontSize:(el.fontSize||26)+'px', color:el.color||'#212121', fontWeight:el.bold?'800':'600', fontStyle:el.italic?'italic':'normal', whiteSpace:'nowrap'} }, el.value));
    else if(el.type==='image') wrap.append(h('img', { src:el.url, alt:'', style:{width:(el.width||110)+'px', display:'block', pointerEvents:'none'} }));
    if(isSel){
      const del=h('button', { style:{position:'absolute', top:'-8px', right:'-8px', width:'18px', height:'18px', borderRadius:'50%', background:'#212121', color:'#fff', border:'none', fontSize:'10px', cursor:'pointer'} }, '×');
      del.onclick=(e)=>{ e.stopPropagation(); const a=getActive(); const i=a.findIndex(x=>x.id===el.id); if(i>-1) a.splice(i,1); selectedId=null; render(); };
      wrap.append(del);
    }
    let sx=0,sy=0,ox=0,oy=0,drag=false;
    wrap.addEventListener('pointerdown', (e)=>{
      if(e.target.closest('button')) return;
      e.preventDefault(); drag=true; selectedId=el.id;
      try{ wrap.setPointerCapture(e.pointerId);}catch{}
      sx=e.clientX; sy=e.clientY; ox=el.xPct; oy=el.yPct;
    });
    wrap.addEventListener('pointermove', (e)=>{
      if(!drag) return;
      const r=printArea.getBoundingClientRect();
      const dx=((e.clientX-sx)/r.width)*100;
      const dy=((e.clientY-sy)/r.height)*100;
      el.xPct=Math.max(4,Math.min(96,ox+dx));
      el.yPct=Math.max(4,Math.min(96,oy+dy));
      wrap.style.left=el.xPct+'%'; wrap.style.top=el.yPct+'%';
    });
    const up=(e)=>{ if(!drag) return; drag=false; try{ wrap.releasePointerCapture(e.pointerId);}catch{} render(); };
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    return wrap;
  }
  async function addToCart(){
    if(!selectedProduct){ toast('Select product','warning'); return; }
    if(!front.length && !back.length){ toast('Add text or image','warning'); return; }
    const designData={ front:{elements:front}, back:{elements:back} };
    const extraF=Number(selectedProduct.customExtraFront ?? selectedProduct.custom_extra_front ?? 10000);
    const extraB=Number(selectedProduct.customExtraBack ?? selectedProduct.custom_extra_back ?? 10000);
    const price=selectedProduct.price + (front.length?extraF:0) + (back.length?extraB:0);
    const added={ name:`Custom: ${selectedProduct.name}`, price, image: (selectedProduct.images&&selectedProduct.images[0])||productImage({name:selectedProduct.name}), variant:{color,size,fit} };
    if(!Store.isAuthed()){
      const guest=JSON.parse(localStorage.getItem('ZUNO_guest_cart')||'[]');
      guest.push({ productId:selectedProduct.id, name:`Custom: ${selectedProduct.name}`, price, slug:selectedProduct.slug, image:productImage({name:selectedProduct.name}), module:'shop', quantity:1, customization:designData, variant:{color,size,fit}, isCustom:true });
      localStorage.setItem('ZUNO_guest_cart', JSON.stringify(guest)); Store._guest=guest; Store.emit();
      toast('Added to bag','success'); try{ showCartDrawer({addedProduct:added}); }catch{} location.hash='#/cart'; return;
    }
    try{ await api.post('/cart/custom', {productId:selectedProduct.id, color,size,fit, designData, quantity:1}); await refreshCart(); toast('Added to bag','success'); try{ showCartDrawer({addedProduct:added});}catch{} location.hash='#/cart'; }catch(e){ toast(e.message,'error'); }
  }

  render();
  return root;
}
