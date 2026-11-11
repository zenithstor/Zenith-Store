/* ZenithStore Conversational Engine v2.0
 * Local-first Arabic/Iraqi support assistant.
 * Reads live storefront data; no external API, keys, or customer secrets.
 * This is a deterministic NLP/rule engine, not a generative LLM.
 */
(() => {
  'use strict';
  const panel = document.getElementById('supportPanel');
  if (!panel || window.__zenithAssistantV2) return;
  window.__zenithAssistantV2 = true;

  const $ = id => document.getElementById(id);
  const messages = $('zenithChatMessages');
  const input = $('zenithChatInput');
  const form = $('zenithChatForm');
  const empty = $('zenithChatEmpty');
  const limitLabel = $('zenithChatLimit');
  const INSTAGRAM = 'https://ig.me/m/zenith.mlbb1';
  const DAY = 86400000;
  const SESSION_KEY = 'zenith_support_chat_v3';
  const moneyFmt = n => typeof money === 'function' ? money(Number(n)||0) : (Number(n)||0).toLocaleString('en-US')+' د.ع';
  let session;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { session = null; }
  if (!session || !session.started || Date.now() - session.started >= DAY) {
    session = { started: Date.now() };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (_) {}
  }

  const state = {
    pending: null,
    lastGame: null,
    lastRegion: null,
    lastCategory: null,
    lastProduct: null,
    lastQuantity: null,
    lastProvider: null,
    lastIntent: null,
    turn: 0
  };

  const REGION_LIST = [
    {id:'global', label:'العالمي', aliases:['عالمي','العالمي','جلوبال','global','globel','world','global server']},
    {id:'indonesia', label:'الإندونيسي', aliases:['اندونيسي','اندونيسيا','اندونيزيا','اندونيس','indonesia','indo']},
    {id:'malaysia', label:'الماليزي', aliases:['ماليزي','ماليزيا','ماليز','malaysia','my region']},
    {id:'philippines', label:'الفلبيني', aliases:['فلبيني','فلبين','الفلبين','philippines','philippine','ph region']},
    {id:'singapore', label:'السنغافوري', aliases:['سنغافوري','سنغافورة','سنغافور','singapore','sg region']},
    {id:'turkey', label:'التركي', aliases:['تركي','تركيا','turkey']},
    {id:'russia', label:'الروسي', aliases:['روسي','روسيا','russia']}
  ];
  const GAME_ALIASES = {
    mlbb:['موبايل ليجند','موبايل لجند','موبايل ليجندز','موبايل لجندز','موبايل ليجند بانغ بانغ','موبايل','mlbb','mobile legends','mobile legend','mobile legends bang bang','ليجند','ليجندز','جواهر','دايموند','دايموندز','diamond','diamonds'],
    honor:['هونر اوف كينغز','هونر اوف كنجز','هونر اوف كينجز','هونر','هونر كينغز','هونر كنجز','honor of kings','honor kings','honor','hok','توكن','توكنز','tokens','token']
  };
  const PROVIDERS = [
    {id:'mastercard', label:'ماستركارد', aliases:['ماستركارد','ماستر كارد','ماستر','mastercard','master card','visa','فيزا','بطاقة']},
    {id:'asiacell', label:'آسياسيل', aliases:['اسياسيل','اسيا سيل','اسيا','آسياسيل','asiacell','asia cell']}
  ];

  const SYNONYMS = [
    [/باقات|باكات|بكجات/, 'باقات منتجات'],
    [/جواهرات|الماس|الماسات/, 'جواهر'],
    [/مشتريات|مشترياتي/, 'سلة'],
    [/دفعه|دفعية/, 'دفع'],
    [/حسابي الشخصي|ملفي/, 'حساب'],
    [/التوصيل|وصول الشحن|استلام/, 'شحن'],
    [/مشكله|مشاكل|عطلان|خربان/, 'مشكلة'],
    [/ما يشتغل|ما يفتح|ما يحمل/, 'مشكلة'],

    [/شلون|كيف|بأي طريقه|طريقة/, 'كيف'],
    [/اريد|ابي|ابغى|احتاج|محتاج|ممكن احصل/, 'طلب'],
    [/بكم|شكد|كم سعر|السعر شنو|تكلف/, 'سعر'],
    [/فلوس|نقود|مبلغ|مبالغ/, 'رصيد'],
    [/عربه|عربة|كارت|cart/, 'سلة'],
    [/جيم|لعبه|game/, 'لعبة'],
    [/دايموند|دايموندز|diamond|diamonds/, 'جواهر'],
    [/توكن|tokens?/, 'توكنز'],
    [/خصم|تخفيض|تنزيل|عرض|عروض|discount|sale|offer/, 'تخفيض'],
    [/اغلى|اعلى|اكبر|زيادة|ازيد|فوك|فوق/, 'أعلى'],
    [/ارخص|اقل|اصغر|انزل|انقص|جوه/, 'أقل'],
    [/اشتري|شراء|اطلب|طلبية/, 'شراء'],
    [/ماكو|مو موجود|غير متوفر|نفذ|خلص/, 'غير متوفر'],
    [/زين|جيد|حلو|افضل/, 'جيد']
  ];

  function normalize(value) {
    let s = String(value ?? '').toLowerCase();
    try { s = s.normalize('NFKD'); } catch (_) {}
    return s
      .replace(/[\u064B-\u065F\u0670]/g,'')
      .replace(/ـ/g,'')
      .replace(/[أإآٱ]/g,'ا')
      .replace(/ى/g,'ي')
      .replace(/ة/g,'ه')
      .replace(/[ؤئ]/g,'ء')
      .replace(/[گ]/g,'ك')
      .replace(/[چ]/g,'ج')
      .replace(/[ڤ]/g,'ف')
      .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[^\p{L}\p{N}]+/gu,' ')
      .replace(/\s+/g,' ').trim();
  }
  function expandSynonyms(s) {
    let out = normalize(s);
    for (const [rx, replacement] of SYNONYMS) if (rx.test(out)) out += ' ' + replacement;
    return out;
  }
  const words = s => normalize(s).split(' ').filter(Boolean);
  function includesAny(s, list) {
    const n = normalize(s);
    return list.some(x => {
      const w = normalize(x);
      return w && (n === w || n.includes(w));
    });
  }
  function hasWord(s, list) {
    const set = new Set(words(s));
    return list.some(x => set.has(normalize(x)));
  }
  function numberFrom(s) {
    const m = String(s).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).match(/(?:^|\D)(\d{1,7})(?:\D|$)/);
    return m ? Number(m[1]) : null;
  }
  function detectGame(s) {
    for (const id of ['honor','mlbb']) if (includesAny(s, GAME_ALIASES[id])) return id;
    return null;
  }
  function detectRegion(s) {
    return REGION_LIST.find(r => includesAny(s,r.aliases)) || null;
  }
  function detectProvider(s) {
    return PROVIDERS.find(p => includesAny(s,p.aliases))?.id || null;
  }
  function gameName(id) { return id === 'honor' ? 'Honor of Kings' : 'Mobile Legends'; }
  function regionName(id) { return REGION_LIST.find(r=>r.id===id)?.label || 'العالمي'; }

  function productTitle(p) {
    try { return typeof window.productTitle === 'function' ? window.productTitle(p) : (p?.name || `${p?.diamonds||''} جوهرة`); }
    catch (_) { return p?.name || `${p?.diamonds||''} جوهرة`; }
  }
  function productCategory(p) {
    try { return typeof window.getProductCategory === 'function' ? window.getProductCategory(p) : String(p?.product_type||'gems'); }
    catch (_) { return String(p?.product_type||'gems'); }
  }
  function price(p, provider) {
    if (!p) return null;
    try {
      if (typeof window.getPrice === 'function') {
        const v = window.getPrice(p, provider || 'mastercard');
        return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      }
    } catch (_) {}
    const raw = provider === 'asiacell' ? p.price_asiacell_iqd : p.price_mastercard_iqd;
    return raw == null || !Number.isFinite(Number(raw)) ? null : Number(raw);
  }
  function productsFor(game, region, category) {
    const source = typeof productsCache !== 'undefined' && Array.isArray(productsCache) ? productsCache : [];
    return source.filter(p => {
      if (!p || p.active === false || p.__unavailable) return false;
      const correctGame = game === 'honor' ? p.__game === 'honor' : !p.__game;
      if (!correctGame) return false;
      if (game !== 'honor') {
        const rid = region?.id || 'global';
        if (rid === 'global' ? !!p.__gemRegion : p.__gemRegion !== rid) return false;
      }
      return !category || productCategory(p) === category;
    });
  }
  function productSort(list, key='diamonds') {
    return [...list].sort((a,b) => Number(a[key]||0)-Number(b[key]||0));
  }
  function providerPriceText(p, provider) {
    if (provider) {
      const v = price(p,provider);
      return v == null ? `سعر ${PROVIDERS.find(x=>x.id===provider)?.label||provider} غير متوفر.` : `${PROVIDERS.find(x=>x.id===provider)?.label||provider}: ${moneyFmt(v)}`;
    }
    const m=price(p,'mastercard'), a=price(p,'asiacell');
    return `ماستركارد: ${m==null?'غير متوفر':moneyFmt(m)} · آسياسيل: ${a==null?'غير متوفر':moneyFmt(a)}`;
  }
  function isGem(p) {
    return Number(p?.diamonds)>0 && ['gems','double'].includes(productCategory(p));
  }
  function findProductByName(s, game, region) {
    const list = productsFor(game,region);
    const q = normalize(s);
    let best=null, score=0;
    for (const p of list) {
      const title=normalize(productTitle(p));
      const amount=Number(p.diamonds||0);
      let n=0;
      if (title && q.includes(title)) n=title.length+20;
      else if (title && title.includes(q) && q.length>=3) n=q.length+5;
      if (amount && new RegExp(`(^|\\s)${amount}(\\s|$)`).test(q)) n=Math.max(n,amount.toString().length+20);
      if (n>score){score=n;best=p;}
    }
    return best;
  }
  function fuzzyScore(a,b) {
    const aa=words(a), bb=words(b);
    if (!aa.length || !bb.length) return 0;
    const setB=new Set(bb);
    let hit=0;
    for (const w of aa) if(setB.has(w)) hit++;
    const j=hit/(new Set([...aa,...bb]).size||1);
    const containment=aa.filter(w=>bb.some(x=>x.includes(w)||w.includes(x))).length/Math.max(aa.length,bb.length);
    return Math.max(j,containment*.82);
  }

  function faqSearch(query) {
    const nodes=[...document.querySelectorAll('#faqSection .faqItem')];
    let best=null,score=0;
    for(const node of nodes){
      const q=node.querySelector('.faqQuestion')?.innerText||'';
      const a=node.querySelector('.faqAnswer')?.innerText||'';
      const v=Math.max(fuzzyScore(query,q),fuzzyScore(expandSynonyms(query),expandSynonyms(q)));
      if(v>score){score=v;best={q,a};}
    }
    return score>=.27&&best?.a ? best : null;
  }
  function pageKnowledge() {
    const sections = [
      ['الرئيسية','homePanel'],['المنتجات والباقات','productsPanel'],['السلة','cartPanel'],
      ['إتمام الطلب','purchasePanel'],['حسابي','accountPanel'],['طلباتي','myOrdersPanel'],
      ['المحفظة','customerWalletPanel'],['الشروط','termsPanel'],['سياسة المتجر','policyPanel'],
      ['الدعم الفني','supportPanel']
    ];
    return sections.map(([name,id])=>{
      const node=$(id); if(!node)return null;
      const text=(node.innerText||'').replace(/\s+/g,' ').trim();
      return {name,id,text:text.slice(0,4500)};
    }).filter(Boolean);
  }
  function retrieveSiteText(query) {
    const q=expandSynonyms(query);
    let best=null,score=0;
    for(const section of pageKnowledge()){
      const v=fuzzyScore(q,section.name+' '+section.text.slice(0,900));
      if(v>score){score=v;best=section;}
    }
    return score>.16?{...best,score}:null;
  }

  function classify(q) {
    const t=expandSynonyms(q);
    const intents = [
      ['insult', ['انجب','نجب','انچب','نچب','انجب انت']],
      ['cart', ['سلة','السلة','عربة التسوق','محتويات السلة','مشترياتي','المشتريات','cart','اضفت للسلة','بالسلة']],
      ['upgrade', ['اعلى','أعلى','اكبر','أكبر','ازيد','زيادة','ارفع','فوك','فوق','upgrade','more diamonds','more tokens']],
      ['downgrade', ['اقل','أقل','اصغر','أصغر','انزل','نقص','ارخص','أرخص','تحت','lower','cheaper','less']],
      ['discount', ['تخفيض','خصم','عرض','عروض','تنزيلات','تنزيل','كوبون','كود خصم','discount','sale','offer','promo']],
      ['compare', ['قارن','مقارنه','الفرق','افضل','أحسن','مقارنة','compare','فرق السعر']],
      ['cheapest', ['ارخص باقه','أرخص باقة','اقل سعر','الأقل سعرا','ارخص شي','ارخص منتج','cheap']],
      ['most_expensive', ['اغلى باقه','أغلى باقة','اعلى سعر','الأعلى سعرا','اكبر باقه','biggest']],
      ['list_products', ['كل الباقات','اعرض الباقات','شنو الباقات','الباقات المتوفرة','المنتجات المتوفرة','قائمة المنتجات','شنو عدكم','شنو عندكم','اعرض المنتجات','كل المنتجات','شنو متوفر','شنو موجود']],
      ['weekly_subscription', ['الاشتراك الاسبوعي','اشتراك اسبوعي','weekly subscription','weekly sub']],
      ['weekly_pack', ['الباقة الاسبوعية','باقة اسبوعية','الحزمة الاسبوعية','weekly pack','weekly bundle']],
      ['monthly', ['الباقة الشهرية','حزمة شهرية','شهري','monthly']],
      ['twilight', ['توايلايت','twilight','الباس القمري']],
      ['membership', ['العضوية المميزة','عضوية مميزة','membership']],
      ['fanframe', ['اطار كبير المعجبين','إطار كبير المعجبين','fan frame','fanframe']],
      ['wallet', ['محفظة','محفظتي','رصيد','الرصيد','ايداع','إيداع','شحن رصيد','اضافة رصيد','إضافة رصيد','balance','wallet']],
      ['orders', ['طلباتي','الطلبات','حالة الطلب','وين طلبي','تتبع الطلب','order status','track order']],
      ['account', ['حسابي','حساب','تسجيل','دخول','انشاء حساب','نسيت كلمة المرور','profile','account','login','register']],
      ['payment', ['دفع','طريقة الدفع','طرق الدفع','ماستركارد','آسياسيل','اسياسيل','فيزا','mastercard','payment']],
      ['shipping', ['اشحن','شحن','شراء','اشتري','اطلب','شلون اطلب','كيف اشتري','طريقة الشراء','طريقة الشحن','how to buy']],
      ['uid', ['uid','zone id','player id','معرف اللاعب','رقم اللاعب','ايدي','id اللاعب']],
      ['region', ['ريجن','منطقة الحساب','المنطقة','اندونيسيا','ماليزيا','الفلبين','سنغافورة','العالمي','global']],
      ['games', ['الالعاب','الألعاب','شنو العاب','اي العاب','الالعاب الموجودة','games']],
      ['contact', ['تواصل','مسؤول','ادمن','انستغرام','انستا','instagram','شخص حقيقي','موظف','بشري']],
      ['security', ['امن','آمن','موثوق','نصب','احتيال','كلمة المرور','باسورد','رمز التحقق','otp','cvv','بيانات البطاقة']],
      ['refund', ['استرجاع','استرداد','الغاء الطلب','إلغاء الطلب','ارجاع فلوس','رجع فلوسي','refund','cancel']],
      ['technical', ['ما يفتح','ما يشتغل','خطأ','مشكلة','عطل','بطيء','ما وصل','لم يصل','متأخر','انخصم','فشل','error','bug']],
      ['faq', ['سؤال','استفسار','شلون','كيف','ليش','لماذا','ممكن','هل']],
      ['greeting', ['مرحبا','هلا','السلام عليكم','اهلا','صباح الخير','مساء الخير','سلام']],
      ['thanks', ['شكرا','مشكور','تسلم','ممنون','يعطيك العافية']],
      ['identity', ['منو انت','من انت','شنو انت','اسمك','مساعد زينيث']],
      ['capabilities', ['شنو تعرف','شنو تكدر','شنو تگدر','تساعدني','شنو تقدر تسوي','ماذا تستطيع']]
    ];
    const scores=[];
    for(const [id,phrases] of intents){
      let sc=0;
      for(const phrase of phrases){
        const p=normalize(phrase);
        if(!p)continue;
        if(t===p)sc=Math.max(sc,1.4);
        else if(t.includes(p))sc=Math.max(sc,Math.min(1.25,.65+p.length/Math.max(t.length,10)*.6));
        else sc=Math.max(sc,fuzzyScore(t,p)*.78);
      }
      if(sc>.30)scores.push({id,score:sc});
    }
    return scores.sort((a,b)=>b.score-a.score)[0]?.id||'unknown';
  }

  function detectCategory(t) {
    if(includesAny(t,['توايلايت','twilight']))return 'twilight';
    if(includesAny(t,['اطار كبير المعجبين','fanframe','اطار المعجبين']))return 'fanframe';
    if(includesAny(t,['عضوية','membership']))return 'membership';
    if(includesAny(t,['مضاعف','مضاعفة','دبل','double']))return 'double';
    if(includesAny(t,['باقة اسبوعية','الحزمة الاسبوعية','weekly pack','باقة خاصة','خاصه','special']))return 'special';
    if(includesAny(t,['شهري','monthly']))return 'special';
    if(includesAny(t,['جواهر','جوهرة','دايموند','diamond','توكن','token']))return 'gems';
    return null;
  }
  function weeklyKind(t) {
    if(includesAny(t,['اشتراك اسبوعي','الاشتراك الاسبوعي','weekly subscription','weekly sub']))return 'subscription';
    if(includesAny(t,['باقة اسبوعية','الباقة الاسبوعية','الحزمة الاسبوعية','weekly pack','weekly bundle']))return 'pack';
    return null;
  }
  function quantityFrom(t) {
    const n=numberFrom(t);
    if(n && (includesAny(t,['جوهرة','جواهر','دايموند','diamond','توكن','token','باقة','كمية']) || n>0))return n;
    return null;
  }
  function currentContext(q) {
    const game=detectGame(q)||state.lastGame;
    const region=detectRegion(q)||(state.lastRegion?REGION_LIST.find(r=>r.id===state.lastRegion):null);
    const provider=detectProvider(q)||state.lastProvider;
    return {game,region,provider};
  }
  function needsRegion(game) { return game !== 'honor'; }

  function priceReplyFor(p, game, region, provider, prefix='') {
    const where=game==='honor'?'Honor of Kings':'Mobile Legends — ريجن '+(region?.label||'العالمي');
    state.lastProduct=p; state.lastGame=game; state.lastRegion=region?.id||'global';
    state.lastCategory=productCategory(p); state.lastQuantity=Number(p.diamonds)||null;
    if(provider)state.lastProvider=provider;
    return `${prefix}${productTitle(p)}\n${where}\n${providerPriceText(p,provider)}\nإذا تريد باقة أعلى أو أقل، اكتب «أعلى» أو «أقل».`;
  }
  function availableList(game, region, category) {
    return productsFor(game,region,category).filter(p=>price(p,'mastercard')!=null||price(p,'asiacell')!=null);
  }
  function askGame(intent) {
    state.pending={...intent,step:'game'};
    return 'أكيد أساعدك. تقصد أي لعبة؟\n🎮 Mobile Legends\n⚔️ Honor of Kings';
  }
  function askRegion(intent) {
    state.pending={...intent,step:'region'};
    return 'تمام، حدد ريجن حساب Mobile Legends: العالمي، الإندونيسي، الماليزي، الفلبيني أو السنغافوري. ملاحظة: التركي والروسي غير متاحين حالياً.';
  }
  function askProduct(intent) {
    state.pending={...intent,step:'product'};
    return 'أي منتج تقصد؟ اكتب عدد الجواهر أو التوكنز، أو اسم الباقة مثل الاشتراك الأسبوعي أو الباقة الشهرية.';
  }
  function findNextPackage(intent, direction) {
    const game=intent.game||state.lastGame||'mlbb';
    const region=intent.region||(state.lastRegion?REGION_LIST.find(r=>r.id===state.lastRegion):null)||REGION_LIST[0];
    const category=intent.category||state.lastCategory||'gems';
    const list=availableList(game,region,category);
    if(!list.length)return {reply:'ما ظهرت منتجات متاحة بهذا التصنيف حالياً. افتح صفحة الباقات حتى يتم تحميل القائمة، أو جرّب تصنيفاً آخر.'};
    let anchor=intent.quantity||state.lastQuantity;
    let base=intent.product||state.lastProduct;
    if(!anchor&&base)anchor=Number(base.diamonds)||null;
    if(!anchor){
      state.pending={game,region,provider:intent.provider,category,action:direction==='up'?'upgrade':'downgrade',step:'product'};
      return {reply:'أكيد. أعلى أو أقل من أي باقة تقصد؟ اكتب عدد الجواهر أو اسم الباقة الحالية حتى أختار لك الباقة المجاورة بالاتجاه الصحيح.'};
    }
    const metric=p=>Number(category==='gems'||category==='double'?p.diamonds:price(p,intent.provider||'mastercard'))||0;
    const candidates=list.filter(p=>direction==='up'?metric(p)>anchor:metric(p)<anchor).sort((a,b)=>direction==='up'?metric(a)-metric(b):metric(b)-metric(a));
    if(!candidates.length){
      const edge=list.slice().sort((a,b)=>direction==='up'?metric(b)-metric(a):metric(a)-metric(b))[0];
      return {reply:`ماكو منتج ${direction==='up'?'أعلى':'أقل'} من ${base?productTitle(base):anchor} ضمن هذا التصنيف. ${edge?'أبعد خيار متاح هو '+productTitle(edge)+'.':''}`};
    }
    const chosen=candidates[0];
    const diff=metric(chosen)-anchor;
    return {reply:priceReplyFor(chosen,game,region,intent.provider,`الباقة ${direction==='up'?'الأعلى التالية':'الأقل التالية'} من طلبك:\n`)};
  }

  function listProductsReply(intent) {
    const game=intent.game||state.lastGame;
    const region=intent.region||(state.lastRegion?REGION_LIST.find(r=>r.id===state.lastRegion):null)||REGION_LIST[0];
    if(!game)return askGame({...intent,action:'list'});
    if(needsRegion(game)&&!intent.region&&!state.lastRegion)return askRegion({...intent,action:'list',game});
    const list=availableList(game,region,intent.category);
    if(!list.length)return 'ماكو منتجات متاحة ضمن الاختيار الحالي. جرّب تصنيفاً آخر أو ريجناً آخر.';
    const sorted=productSort(list,(intent.category==='gems'||intent.category==='double'||!intent.category)?'diamonds':'price_mastercard_iqd');
    const limited=sorted.slice(0,14);
    state.lastGame=game;state.lastRegion=region.id;state.lastCategory=intent.category||'gems';
    const lines=limited.map(p=>`• ${productTitle(p)} — ${providerPriceText(p,intent.provider)}`);
    return `هاي المنتجات المتاحة حالياً${game==='honor'?' في Honor of Kings':' في ريجن '+region.label}:\n${lines.join('\n')}${sorted.length>limited.length?`\n... وأكو ${sorted.length-limited.length} منتج إضافي.`:''}\nتگدر تطلب اسم أي باقة حتى أعرض تفاصيلها.`;
  }

  function productIntent(q, intent) {
    const game=intent.game||state.lastGame;
    const region=intent.region||(state.lastRegion?REGION_LIST.find(r=>r.id===state.lastRegion):null);
    if(!game)return askGame({...intent,raw:q});
    if(needsRegion(game)&&!region)return askRegion({...intent,game,raw:q});
    const list=availableList(game,region,intent.category);
    if(intent.weekly){
      const p=list.find(x=>intent.weekly==='subscription'
        ? (typeof window.isWeeklySubscriptionProduct==='function'?window.isWeeklySubscriptionProduct(x):String(x.product_type)==='weekly')
        : (String(x.product_type)==='special'&&includesAny(productTitle(x),['الباقة الاسبوعية','الحزمة الاسبوعية','weekly pack'])));
      if(!p)return {reply:`ما لكيت ${intent.weekly==='subscription'?'الاشتراك الأسبوعي':'الباقة الأسبوعية'} متاحة في ${game==='honor'?'Honor of Kings':'ريجن '+region.label}.`};
      return {reply:priceReplyFor(p,game,region,intent.provider)};
    }
    if(intent.name){
      const named=findProductByName(q,game,region);
      if(named)return {reply:priceReplyFor(named,game,region,intent.provider)};
    }
    if(intent.quantity){
      const gems=list.filter(isGem).sort((a,b)=>Number(a.diamonds)-Number(b.diamonds));
      const exact=gems.find(p=>Number(p.diamonds)===intent.quantity);
      if(exact)return {reply:priceReplyFor(exact,game,region,intent.provider,'لكيت الكمية المطلوبة بالضبط:\n')};
      const higher=gems.find(p=>Number(p.diamonds)>intent.quantity);
      if(higher){
        state.lastProduct=higher;state.lastQuantity=Number(higher.diamonds);
        return {reply:priceReplyFor(higher,game,region,intent.provider,`ماكو باقة ${intent.quantity} بالضبط. حسب طلبك أعرض لك الباقة الأعلى التالية (${higher.diamonds}):\n`)};
      }
      const max=gems[gems.length-1];
      return {reply:`ماكو باقة ${intent.quantity} بالضبط، وماكو باقة أعلى منها حالياً. أكبر باقة متاحة هي ${max?productTitle(max):'غير محددة'}.\n${max?providerPriceText(max,intent.provider):''}`};
    }
    const named=findProductByName(q,game,region);
    if(named)return {reply:priceReplyFor(named,game,region,intent.provider)};
    return {reply:askProduct({...intent,game,region,raw:q})};
  }

  function discountReply(intent) {
    const game=intent.game||state.lastGame;
    const region=intent.region||(state.lastRegion?REGION_LIST.find(r=>r.id===state.lastRegion):null)||REGION_LIST[0];
    if(!game)return askGame({...intent,action:'discount'});
    if(needsRegion(game)&&!intent.region&&!state.lastRegion)return askRegion({...intent,game,action:'discount'});
    const list=availableList(game,region,intent.category);
    const deals=[];
    for(const p of list){
      const oldM=Number(p.old_price_mastercard_iqd||p.original_price_mastercard_iqd||p.price_before_discount_mastercard);
      const oldA=Number(p.old_price_asiacell_iqd||p.original_price_asiacell_iqd||p.price_before_discount_asiacell);
      const newM=price(p,'mastercard'),newA=price(p,'asiacell');
      if(oldM>newM&&newM>0)deals.push(`${productTitle(p)} — ماستركارد: ${moneyFmt(newM)} بدلاً من ${moneyFmt(oldM)}`);
      if(oldA>newA&&newA>0)deals.push(`${productTitle(p)} — آسياسيل: ${moneyFmt(newA)} بدلاً من ${moneyFmt(oldA)}`);
      if(typeof window.isWeeklySubscriptionProduct==='function'&&window.isWeeklySubscriptionProduct(p)){
        const old=typeof window.getWeeklyOldPrice==='function'?window.getWeeklyOldPrice('mastercard'):null;
        if(old&&newM<old)deals.push(`${productTitle(p)} — ماستركارد: ${moneyFmt(newM)} بدلاً من ${moneyFmt(old)}`);
      }
    }
    if(deals.length)return `العروض/التخفيضات المؤكدة الظاهرة بقائمة الأسعار الحالية:\n${[...new Set(deals)].slice(0,12).join('\n')}\nالأسعار تتغير حسب اللعبة والريجن وطريقة الدفع.`;
    return 'راجعت أسعار المنتجات المحمّلة وما لقيت تخفيضاً عاماً مؤكداً أگدر أعلنه حالياً. إذا تقصد باقة معينة اكتب اسمها والريجن حتى أقارن سعرها وأتحقق من أي سعر سابق مسجل.';
  }

  function cartReply(q) {
    const cart=typeof cartItems !== 'undefined' && Array.isArray(cartItems) ? cartItems : [];
    const all=typeof productsCache !== 'undefined' && Array.isArray(productsCache) ? productsCache : [];
    const lines=cart.map(line=>({line,product:all.find(p=>String(p.id)===String(line.id))})).filter(x=>x.product);
    if(!cart.length)return 'سلتك فارغة حالياً 🛒. افتح المنتجات، اختار اللعبة والريجن والباقة، وبعدها اضغط إضافة للسلة.';
    if(!lines.length)return 'أكو عناصر محفوظة بالسلة لكن المنتجات ما تحمّلت بعد. حدّث الصفحة وانتظر تحميل الباقات، وبعدها افتح السلة.';
    const qty=lines.reduce((n,x)=>n+Number(x.line.qty||1),0);
    const total=lines.reduce((n,x)=>n+(price(x.product,x.line.provider)||0)*Number(x.line.qty||1),0);
    const details=lines.map(x=>`• ${productTitle(x.product)} × ${Number(x.line.qty||1)} — ${moneyFmt((price(x.product,x.line.provider)||0)*Number(x.line.qty||1))}`).join('\n');
    if(includesAny(q,['كم','المجموع','الاجمالي','الحساب','السعر الكلي','total']))return `محتويات سلتك (${qty} قطعة):\n${details}\nالمجموع حسب الأسعار الحالية: ${moneyFmt(total)}.`;
    if(includesAny(q,['افتح','روح','وديني','انتقل','ادخل'])){try{if(typeof window.showCart==='function')window.showCart();else $('menuCart')?.click();}catch(_){} return `فتحت لك السلة. بيها ${qty} قطعة والمجموع ${moneyFmt(total)}.`;}
    return `هاي محتويات سلتك حالياً 🛒:\n${details}\nعدد القطع: ${qty}\nالمجموع: ${moneyFmt(total)}.\nتگدر تطلب مني أحسب المجموع أو أشرح لك إتمام الطلب.`;
  }

  function walletReply(q) {
    const balance=$('accountCurrentBalance')?.innerText?.trim();
    const loggedIn=!!document.querySelector('#accountPanel .accountDetailsGrid') && balance && balance!=='—';
    if(includesAny(q,['رصيدي','كم عندي','كم رصيد']))return loggedIn?`الرصيد الظاهر بحسابك حالياً: ${balance}.`:'حتى تشوف رصيدك، سجل الدخول وافتح «حسابي» أو «محفظتي». ما أگدر أشوف رصيد حسابك إذا مو مسجل دخول.';
    if(includesAny(q,['ايداع','اضافة رصيد','اشحن رصيد','تعبئة','اشحن المحفظة']))return 'لإضافة رصيد: سجل الدخول، افتح القائمة ☰ ثم «محفظتي»، اختار طريقة الإيداع المتاحة واتبع تعليمات الصفحة. تابع حالة طلب الإيداع من سجل الإيداعات. لا ترسل رقم البطاقة أو CVV أو OTP بالمحادثة.';
    return 'المحفظة مخصصة لرصيد حساب ZenithStore. تگدر تشوف الرصيد وسجل الإيداعات بعد تسجيل الدخول، وتضيف رصيداً من خيارات الإيداع الظاهرة بصفحة المحفظة.';
  }
  function orderReply(q) {
    if(includesAny(q,['افتح','اعرض','روح','وديني','وين الاقي'])){$('menuMyOrders')?.click();return 'فتحت لك صفحة «طلباتي» حتى تراجع طلباتك.';}
    return 'لمراجعة طلباتك: سجل الدخول، افتح القائمة ☰ ثم «طلباتي»، وبعدها اضغط تحديث إذا احتجت. إذا الطلب متأخر، لا تكرر الشراء قبل مراجعة حالته، وتواصل مع المسؤول مع رقم الطلب.';
  }
  function accountReply(q) {
    if(includesAny(q,['افتح','اعرض','روح','وديني'])){$('menuAccount')?.click();return 'فتحت لك صفحة حسابك. إذا ما كنت مسجل دخول، راح تظهر لك خيارات الدخول أو إنشاء الحساب.';}
    return 'من القائمة ☰ اختار «حسابي» حتى تشوف بيانات حسابك. لإنشاء حساب جديد اختار إنشاء حساب، أدخل الاسم واسم المستخدم والبريد وكلمة مرور قوية. إذا نسيت كلمة المرور استخدم خيار الاستعادة الظاهر بصفحة الدخول. لا تشارك كلمة المرور أو رمز التحقق.';
  }
  function paymentReply(q) {
    if(includesAny(q,['شلون ادفع','طريقة الدفع','طرق الدفع','ادفع']))return 'طرق الدفع المعروضة بالمتجر تشمل ماستركارد وآسياسيل، كما يمكن إتمام الطلب باستخدام رصيد المحفظة إذا كان متاحاً. راجع الخيارات الظاهرة عند الإيداع أو إتمام الطلب؛ لا ترسل بيانات البطاقة أو رمز التحقق داخل المحادثة.';
    return 'اختيار طريقة الدفع يكون من خيارات المنتج أو نموذج الطلب حسب العملية. الأسعار قد تختلف بين ماستركارد وآسياسيل، لذلك أگدر أعرض لك السعرين إذا تحدد اللعبة والريجن والباقة.';
  }
  function shippingReply() {
    return 'طريقة الشراء من ZenithStore:\n1) اختار اللعبة من الرئيسية.\n2) في Mobile Legends اختار الريجن المطابق لحسابك.\n3) افتح تصنيف الباقات واختار المنتج.\n4) راجع السعر وطريقة الدفع واضغط إضافة للسلة.\n5) افتح السلة ثم إتمام الطلب.\n6) أدخل بيانات اللاعب المطلوبة مثل Player ID وZone ID وتأكد منها قبل التأكيد.\nالشحن ما يحتاج كلمة مرور اللعبة أو رمز تسجيل الدخول.';
  }
  function regionReply(q) {
    const r=detectRegion(q);
    if(r) {state.lastRegion=r.id;return `الريجن اللي تقصده هو ${r.label}. لازم تختار نفس منطقة حسابك داخل اللعبة، مو بالضرورة بلد سكنك. إذا تريد أسعاره، اكتب عدد الجواهر أو اسم الباقة.`;}
    return 'الريجن هو منطقة/خادم حساب اللعبة. في Mobile Legends المتجر يعرض العالمي والإندونيسي والماليزي والفلبيني والسنغافوري. التركي والروسي ظاهرين كغير متاحين حالياً. اختار نفس ريجن حسابك، مو بلد إقامتك.';
  }
  function securityReply() {
    return 'حافظ على بيانات حسابك: لا تشارك كلمة مرور اللعبة، رمز OTP، CVV أو رقم البطاقة داخل الدردشة. الشحن يحتاج فقط بيانات اللاعب التي يطلبها نموذج الطلب الرسمي، مثل Player ID وZone ID عند الحاجة.';
  }
  function technicalReply(q) {
    if(includesAny(q,['ما وصل','لم يصل','متاخر','تاخر','انخصم','خصم','فشل']))return 'إذا انخصم الرصيد أو تأخر الشحن:\n1) افتح «طلباتي» وتحقق من حالة الطلب.\n2) تأكد من Player ID وZone ID والريجن.\n3) لا تكرر الشراء قبل معرفة حالة الطلب.\n4) احتفظ برقم الطلب وتواصل مع مسؤول المتجر حتى يراجع العملية.';
    return 'خل نحدد المشكلة حتى أساعدك: هل المشكلة بفتح الموقع، تسجيل الدخول، تحميل المنتجات، السلة، الدفع، لو وصول الشحن؟ اكتب اسم الصفحة والزر اللي ما يشتغل، ولا ترسل بيانات سرية.';
  }
  function navigationReply(q) {
    const routes=[
      {terms:['الرئيسية','البيت','home'],id:'navHome',label:'الرئيسية'},
      {terms:['السلة','cart'],id:'menuCart',label:'السلة'},
      {terms:['المحفظة','محفظتي','wallet'],id:'menuWallet',label:'المحفظة'},
      {terms:['طلباتي','الطلبات','orders'],id:'menuMyOrders',label:'طلباتي'},
      {terms:['حسابي','الحساب','account'],id:'menuAccount',label:'حسابي'},
      {terms:['الدعم','المساعد','المحادثة'],id:'menuSupport',label:'الدعم'},
      {terms:['بحث','البحث','search'],id:'menuSearch',label:'البحث'}
    ];
    const found=routes.find(r=>includesAny(q,r.terms));
    if(found&&includesAny(q,['افتح','روح','وديني','انتقل','اعرض','ادخل'])){
      $(found.id)?.click();
      return `تمام، فتحت لك قسم ${found.label}.`;
    }
    return 'تگدر تتنقل من القائمة ☰ أعلى الموقع. بيها الرئيسية، السلة، طلباتي، حسابي، المحفظة، البحث ومساعد زينيث.';
  }
  function generalHelp() {
    return 'أگدر أساعدك بأغلب أمور ZenithStore، مثل:\n• الباقات والأسعار حسب اللعبة والريجن.\n• باقة أعلى أو أقل، وأقرب كمية متاحة.\n• الاشتراك الأسبوعي والباقة الأسبوعية والشهرية.\n• التخفيضات والأسعار قبل وبعد الخصم إذا كانت مسجلة.\n• السلة والكميات والمجموع وإتمام الطلب.\n• المحفظة والإيداع وطرق الدفع.\n• الحساب وتسجيل الدخول وطلباتي وحالة الشحن.\n• الريجن وPlayer ID وZone ID.\nاسأل بطريقتك العراقية أو العربية، حتى لو بيها أخطاء إملائية.';
  }


  // Curated store knowledge: grounded in the current ZenithStore UI and workflows.
  // The bot uses this as a local retrieval library, not as a source for invented prices.
  const STORE_KNOWLEDGE = [
    {keys:['الفرق بين الاشتراك الاسبوعي والباقة الاسبوعية','اشتراك اسبوعي باقة اسبوعية','weekly subscription vs weekly pack'],answer:'الاشتراك الأسبوعي والباقة الأسبوعية منتجان مختلفان. الاشتراك الأسبوعي هو منتج اشتراك مستقل، أما الباقة الأسبوعية فهي حزمة/باقة خاصة. لا تختار واحداً اعتماداً على الاسم فقط؛ افتح تفاصيل المنتج وشوف اسمه وسعره قبل الإضافة للسلة.'},
    {keys:['شنو هو الريجن','ما معنى الريجن','معنى region','ما هو region'],answer:'الريجن يعني منطقة أو خادم حساب اللعبة. لازم تختار نفس الريجن المرتبط بحسابك داخل Mobile Legends، وليس بالضرورة بلد سكنك. إذا اخترت ريجناً مختلفاً قد لا يطابق حسابك.'},
    {keys:['شنو ال uid','ما هو uid','ما معنى player id','معرف اللاعب'],answer:'Player ID أو UID هو رقم تعريف حساب اللاعب داخل اللعبة. انسخه من ملفك الشخصي داخل اللعبة واكتبه في نموذج الطلب الرسمي بدون تغيير.'},
    {keys:['شنو zone id','ما هو zone id','معنى zone id','وين zone id'],answer:'Zone ID هو رقم المنطقة/الخادم المرتبط بحساب Mobile Legends، ويظهر بجانب Player ID في ملف اللاعب. اكتبه كما يظهر تماماً في نموذج الطلب.'},
    {keys:['هل احتاج كلمة المرور','هل يحتاج باسورد','الشحن يحتاج كلمة مرور','اعطيكم حسابي'],answer:'لا تشارك كلمة مرور اللعبة أو رمز تسجيل الدخول مع أي أحد. الشحن يتم باستخدام بيانات اللاعب المطلوبة في نموذج الطلب فقط، مثل Player ID وZone ID عند الحاجة.'},
    {keys:['هل الموقع امن','هل المتجر موثوق','اخاف من النصب','هل انتم مضمونين'],answer:'قبل إتمام أي طلب، راجع اسم المنتج والريجن والسعر وبيانات اللاعب. لا تشارك كلمة المرور أو رموز التحقق. إذا عندك شك أو مشكلة محددة، تواصل مع مسؤول المتجر قبل الدفع.'},
    {keys:['كيف اختار الريجن الصحيح','اي ريجن اختار','ما اعرف ريجني','كيف اعرف ريجن حسابي'],answer:'اختار الريجن الظاهر في معلومات حساب اللعبة أو المرتبط بحسابك، ولا تعتمد على بلد إقامتك وحده. إذا ما تعرفه، تحقق من بيانات الحساب داخل اللعبة قبل الشراء.'},
    {keys:['ما الفرق بين الجواهر والتوكنز','الفرق بين diamond و token','جواهر وتوكنز'],answer:'الجواهر تخص Mobile Legends، بينما التوكنز تخص Honor of Kings. اختار اللعبة أولاً حتى تظهر لك المنتجات الصحيحة.'},
    {keys:['كيف اشتري من الموقع','طريقة الطلب','خطوات الشراء','شلون اطلب باقة'],answer:'اختار اللعبة، ثم الريجن في Mobile Legends، وبعدها التصنيف والباقة. راجع السعر وطريقة الدفع، أضف المنتج للسلة، افتح السلة واضغط إتمام الطلب، ثم أدخل بيانات اللاعب المطلوبة وتأكد منها قبل التأكيد.'},
    {keys:['كيف اضيف للسلة','اضافة منتج للسلة','شلون اضيف باقة'],answer:'من صفحة الباقات اضغط على المنتج المطلوب، اختار طريقة الدفع إذا ظهرت، ثم اضغط إضافة إلى السلة. افتح أيقونة السلة حتى تتأكد من المنتج والكمية والمجموع.'},
    {keys:['كيف احذف من السلة','حذف منتج من السلة','اشيل باقة من السلة'],answer:'افتح صفحة السلة، وابحث عن المنتج المطلوب، ثم استخدم زر الحذف الموجود بجانبه. تگدر أيضاً تعدل الكمية من أزرار + و− إذا كانت ظاهرة.'},
    {keys:['كيف اغير الكمية بالسلة','زيادة الكمية','انقص الكمية'],answer:'افتح السلة واستخدم أزرار + و− الموجودة بجانب المنتج لتغيير الكمية. راجع المجموع بعد التعديل قبل إتمام الطلب.'},
    {keys:['كيف اكمل الطلب','اتمام الطلب من السلة','زر اتمام الطلب'],answer:'افتح السلة وراجع المنتجات والكميات والمجموع، ثم اضغط «إتمام الطلب». أدخل بيانات اللاعب المطلوبة وتأكد من صحتها قبل تأكيد الطلب.'},
    {keys:['هل اقدر اشتري بدون حساب','شراء بدون تسجيل','لازم اسجل دخول'],answer:'بعض وظائف المتجر مثل المحفظة والطلبات مرتبطة بتسجيل الدخول. إذا طلبت منك الصفحة تسجيل الدخول، أنشئ حساباً أو سجل دخولك أولاً حتى تتابع طلباتك ورصيدك.'},
    {keys:['كيف اسوي حساب','انشاء حساب جديد','التسجيل بالموقع'],answer:'افتح القائمة ☰ واختار إنشاء حساب جديد، ثم املأ الاسم واسم المستخدم والبريد الإلكتروني وكلمة المرور المطلوبة. استخدم كلمة مرور قوية ولا تشاركها مع أحد.'},
    {keys:['نسيت كلمة المرور','استعادة كلمة المرور','ما اقدر ادخل حسابي'],answer:'من صفحة تسجيل الدخول استخدم خيار استعادة كلمة المرور إذا كان متاحاً، واتبع التعليمات التي تظهر لك. إذا لم تنجح الاستعادة، تواصل مع مسؤول المتجر.'},
    {keys:['ما هو رصيد المحفظة','كيف تعمل المحفظة','شنو المحفظة'],answer:'محفظة ZenithStore تعرض رصيد حسابك وتتيح متابعة الإيداعات واستخدام الرصيد في الطلبات عندما يكون خيار المحفظة متاحاً. افتح «محفظتي» بعد تسجيل الدخول.'},
    {keys:['كيف اضيف رصيد للمحفظة','ايداع رصيد','شحن المحفظة'],answer:'سجل الدخول، افتح «محفظتي»، اختار طريقة الإيداع المتاحة واتبع التعليمات الظاهرة في الصفحة، ثم تابع حالة الإيداع من سجل الإيداعات. لا ترسل بيانات البطاقة أو رموز التحقق بالدردشة.'},
    {keys:['رصيدي ما انضاف','الايداع معلق','طلب الايداع'],answer:'افتح صفحة المحفظة وراجع سجل الإيداعات وحالة الطلب. إذا بقي الطلب معلقاً أو تم الخصم ولم يظهر الرصيد، احتفظ برقم العملية وتواصل مع المسؤول، ولا تكرر الإيداع قبل المراجعة.'},
    {keys:['ما هي طرق الدفع','طرق الدفع المتاحة','ادفع ماستركارد او اسيا'],answer:'طرق الدفع الظاهرة في المتجر تشمل ماستركارد وآسياسيل، وقد يتاح استخدام رصيد المحفظة عند إتمام الطلب. راجع الخيارات الفعلية المعروضة في الصفحة قبل التأكيد.'},
    {keys:['ليش سعر اسيا مختلف عن الماستر','فرق اسعار الدفع','الاسعار تختلف حسب الدفع'],answer:'قد يختلف سعر المنتج بين ماستركارد وآسياسيل حسب تسعير المتجر. أگدر أعرض لك السعرين من بيانات المنتج الحالية إذا تحدد اللعبة والريجن والباقة.'},
    {keys:['ليش الاسعار تختلف حسب الريجن','فرق اسعار الريجنات','السعر حسب المنطقة'],answer:'الأسعار والباقات تختلف حسب ريجن حساب اللعبة. لذلك لازم تختار الريجن الصحيح حتى تشوف السعر المطابق للمنتج المتاح لذلك الريجن.'},
    {keys:['هل يوجد خصم','كود خصم','كوبون خصم','عروض اليوم'],answer:'أتحقق من التخفيضات المسجلة فعلياً في أسعار المنتجات الحالية. إذا ما ظهر خصم مؤكد، ما راح أخترع كود أو نسبة خصم. اكتب اسم الباقة والريجن حتى أقارن السعر المتاح.'},
    {keys:['متى يوصل الشحن','كم مدة الشحن','وقت وصول الجواهر'],answer:'ما عندي مدة تنفيذ ثابتة ومؤكدة أگدر أضمنها لكل الطلبات. تابع حالة طلبك من «طلباتي»، وإذا تأخر تواصل مع المسؤول برقم الطلب.'},
    {keys:['طلب قيد المعالجة','حالة الطلب pending','طلب جديد'],answer:'إذا حالة الطلب قيد المعالجة، فهذا يعني أن الطلب لم يظهر كمكتمل بعد. تابع صفحة «طلباتي» ولا تنشئ طلباً مكرراً قبل التأكد من الحالة.'},
    {keys:['تم الدفع ولم يصل الشحن','انخصم المبلغ ولم تصل الجواهر','الطلب لم يصل'],answer:'راجع حالة الطلب في «طلباتي» وتأكد من Player ID وZone ID والريجن. إذا تم الخصم ولم يصل الشحن، لا تكرر الشراء؛ تواصل مع المسؤول وأرسل رقم الطلب فقط، دون بيانات سرية.'},
    {keys:['هل يمكن الغاء الطلب','الغاء عملية الشراء','استرجاع المبلغ'],answer:'الإلغاء أو الاسترجاع يعتمد على حالة الطلب وسياسة المتجر وما إذا بدأ التنفيذ. راجع «طلباتي» وتواصل مع المسؤول برقم الطلب حتى يتم التحقق من الحالة.'},
    {keys:['المنتج غير موجود','ما لقيت الباقة','باقتي مو موجودة'],answer:'إذا لم تجد الكمية المطلوبة، أگدر أبحث عن أقرب باقة أعلى متاحة ضمن نفس اللعبة والريجن. اكتب الكمية المطلوبة حتى أعرض الخيار الأعلى وسعره.'},
    {keys:['اريد باقة اكبر','اريد كمية اكثر','باقة اعلى من هذه'],answer:'أگدر أختار لك الباقة الأعلى التالية من آخر باقة تكلمنا عنها. اكتب «أعلى» إذا سبق وحددنا باقة، أو اكتب كمية/اسم الباقة الحالية حتى تكون المقارنة دقيقة.'},
    {keys:['اريد باقة اصغر','اريد كمية اقل','باقة اقل من هذه'],answer:'أگدر أختار لك الباقة الأقل التالية من آخر باقة تكلمنا عنها. اكتب «أقل» إذا سبق وحددنا باقة، أو اكتب كمية/اسم الباقة الحالية.'},
    {keys:['شنو الباقة الشهرية','اشتراك شهري','monthly pack'],answer:'الباقة الشهرية منتج منفصل عن الاشتراك الأسبوعي. توفرها وسعرها يعتمدان على اللعبة والريجن؛ حدد الريجن حتى أقرأ السعر من قائمة المنتجات.'},
    {keys:['شنو التوايلايت باس','twilight pass','توايلايت'],answer:'التوايلايت باس يظهر ضمن تصنيفات/منتجات Mobile Legends لبعض الريجنات فقط. إذا لم يظهر في ريجنك فقد يكون غير متاح هناك حالياً.'},
    {keys:['ما هي العضوية المميزة','membership','عضوية'],answer:'العضوية المميزة منتج مستقل عن باقات الجواهر. افتح تصنيف العضوية المميزة حتى تشوف التفاصيل والسعر المتاح.'},
    {keys:['اطار كبير المعجبين','fan frame','اطار المعجبين'],answer:'إطار كبير المعجبين يظهر كمنتج/تصنيف مستقل. افتح تصنيف الإطار حتى تشوف المنتج وسعره إذا كان متاحاً.'},
    {keys:['كيف ابحث عن باقة','البحث عن منتج','ما لقيت المنتج بالبحث'],answer:'استخدم خانة البحث في صفحة المنتجات واكتب اسم المنتج أو عدد الجواهر/التوكنز. إذا ما ظهر، اسألني عن الكمية والريجن حتى أبحث في القائمة المحمّلة.'},
    {keys:['الموقع لا يفتح','الموقع بطيء','الصفحة لا تحمل'],answer:'تأكد من اتصال الإنترنت، حدّث الصفحة، وانتظر تحميل المنتجات. إذا استمرت المشكلة جرّب متصفحاً محدثاً واكتب اسم الصفحة أو الزر الذي لا يعمل.'},
    {keys:['كيف اغير الثيم','الوضع الليلي','الوضع الفاتح','الوان الموقع'],answer:'إذا كان زر تبديل المظهر ظاهراً في أعلى الموقع، اضغطه للتبديل بين الثيمات المتاحة. اختيار الثيم لا يغير أسعار المنتجات.'},
    {keys:['هل المتجر يدعم الموبايل','استخدم الهاتف','الموقع على الهاتف'],answer:'الموقع مصمم للاستخدام من الهاتف أيضاً. إذا واجهت مشكلة في العرض، حدّث الصفحة واستخدم متصفحاً حديثاً.'},
    {keys:['كيف اتواصل مع الدعم','رقم المسؤول','الدعم البشري'],answer:'تگدر تتواصل مع مسؤول المتجر عبر إنستغرام من الرابط: https://ig.me/m/zenith.mlbb1'},
    {keys:['هل الاسعار بالدينار','عملة الموقع','iqd'],answer:'الأسعار المعروضة في المتجر بالدينار العراقي (د.ع). راجع السعر النهائي الظاهر عند المنتج وإتمام الطلب.'},
    {keys:['كم لعبة موجودة','الالعاب المدعومة','شنو الالعاب الموجودة'],answer:'المتجر يعرض حالياً Mobile Legends لشحن الجواهر وHonor of Kings لشحن التوكنز.'},
    {keys:['هل اقدر اغير الريجن بعد الطلب','اخترت ريجن غلط','الريجن خطا'],answer:'إذا اخترت ريجناً غير صحيح ولم تؤكد الطلب بعد، ارجع وعدّل اختيارك قبل الإتمام. إذا تم إرسال الطلب بالفعل، لا تنشئ طلباً جديداً؛ تواصل مع المسؤول فوراً برقم الطلب.'},
    {keys:['ادخل uid غلط','كتبت رقم اللاعب خطا','بيانات اللاعب غير صحيحة'],answer:'إذا لم تؤكد الطلب بعد، ارجع وصحح Player ID وZone ID. إذا تم تأكيد الطلب، تواصل مع المسؤول فوراً برقم الطلب؛ لا أگدر أعدّل طلباً منفذاً من داخل الدردشة.'},
    {keys:['هل استطيع شراء اكثر من باقة','عدة منتجات بالسلة','اضيف اكثر من منتج'],answer:'نعم، تگدر تضيف أكثر من منتج إلى السلة إذا كانت المنتجات متاحة. راجع كل منتج وكميته والمجموع قبل إتمام الطلب.'},
    {keys:['هل اقدر اغير طريقة الدفع','تغيير الدفع','اختيار ماستركارد'],answer:'طريقة الدفع تختارها من الخيارات الظاهرة عند المنتج أو أثناء الإيداع/إتمام الطلب. إذا أضفت المنتج للسلة بطريقة دفع معينة، راجع تفاصيله قبل التأكيد.'},
    {keys:['كيف اعرف ان الطلب اكتمل','طلب مكتمل','تم تنفيذ الطلب'],answer:'افتح «طلباتي» وحدّث القائمة، ثم راجع حالة الطلب. إذا ظهرت الحالة مكتمل، فهذا هو التأكيد الظاهر في سجل الطلبات.'}
  ];
  function knowledgeSearch(query) {
    const q=expandSynonyms(query);
    let best=null, bestScore=0;
    for(const item of STORE_KNOWLEDGE){
      let score=0;
      for(const key of item.keys){
        const k=expandSynonyms(key);
        const exact=q.includes(k)||k.includes(q);
        const v=exact?1.1:fuzzyScore(q,k);
        if(v>score)score=v;
      }
      if(score>bestScore){bestScore=score;best=item;}
    }
    return bestScore>=.34?{...best,score:bestScore}:null;
  }

  function respond(q) {
    state.turn++;
    const t=normalize(q);
    const intent=classify(q);
    const game=detectGame(q);
    const region=detectRegion(q);
    const provider=detectProvider(q);
    const quantity=quantityFrom(q);
    const category=detectCategory(q);
    if(includesAny(q,['الاشتراك الاسبوعي','اشتراك اسبوعي']) &&
       includesAny(q,['الباقة الاسبوعية','باقة اسبوعية','الحزمة الاسبوعية']) &&
       includesAny(q,['فرق','الفرق','مختلف','شنو الفرق']))
      return 'الاشتراك الأسبوعي والباقة الأسبوعية مو نفس المنتج: الاشتراك الأسبوعي نوع اشتراك مستقل، والباقة الأسبوعية حزمة خاصة. الأسعار والتوفر يختلفان حسب الريجن؛ إذا تريد السعرين، حدد اللعبة والريجن.';
    // A new, clearly unrelated question cancels an old clarification instead of trapping the user in it.
    if(state.pending){
      const expected =
        (state.pending.step==='game' && !!game) ||
        (state.pending.step==='region' && !!region) ||
        (['product','details'].includes(state.pending.step) &&
          (!!quantity || !!weeklyKind(q) || !!category || !!findProductByName(q,state.pending.game,state.pending.region)));
      const independent = ['cart','wallet','orders','account','payment','shipping','uid','region','games','security','refund','technical','contact','greeting','thanks','identity','capabilities','discount','upgrade','downgrade','compare','list_products'];
      if(!expected && independent.includes(intent))state.pending=null;
    }
    if(game)state.lastGame=game;
    if(region)state.lastRegion=region.id;
    if(provider)state.lastProvider=provider;
    if(category)state.lastCategory=category;

    if(intent==='insult')return 'انجب أو انچب أنت 😄';
    if(intent==='greeting')return 'هلا بيك ونورت ZenithStore 🌟 شتحتاج أساعدك بيه؟ أگدر أبحث عن الباقات والأسعار أو أشرح لك أي قسم بالموقع.';
    if(intent==='thanks')return 'العفو، بالخدمة دائماً 🌟';
    if(intent==='identity')return 'أنا مساعد ZenithStore المحلي 🤖، أقرأ بيانات المنتجات والأسعار والسلة والأسئلة الشائعة من الموقع وأساعدك بخطوات المتجر.';
    if(intent==='capabilities')return generalHelp();

    if(state.pending){
      const p=state.pending;
      if(p.step==='game'){
        const g=game||detectGame(q);
        if(!g)return 'اختار اللعبة حتى أكمل: Mobile Legends أو Honor of Kings.';
        state.lastGame=g;
        state.pending={...p,game:g,step:needsRegion(g)?'region':'details'};
        if(needsRegion(g))return askRegion(state.pending);
        if(p.action==='list')return listProductsReply({...p,game:g});
        if(p.action==='discount')return discountReply({...p,game:g});
        return 'تمام، Honor of Kings. اكتب عدد التوكنز أو اسم الباقة حتى أطلع السعر.';
      }
      if(p.step==='region'){
        const r=region||detectRegion(q);
        if(!r)return 'ما حددت الريجن بعد. اكتب العالمي أو الإندونيسي أو الماليزي أو الفلبيني أو السنغافوري.';
        state.pending={...p,region:r,step:'details'};
        if(p.action==='discount')return discountReply({...p,region:r});
        if(p.action==='list')return listProductsReply({...p,region:r});
        if(p.action==='upgrade'||p.action==='downgrade')return findNextPackage({...p,region:r},p.action==='upgrade'?'up':'down').reply;
        if(p.action==='cheapest'||p.action==='most_expensive'){
          const l=availableList(p.game,r,p.category);
          if(!l.length)return 'ماكو منتجات متاحة بهذا الاختيار حالياً.';
          const picked=l.reduce((a,b)=>p.action==='cheapest'?(price(a,p.provider||'mastercard')<=price(b,p.provider||'mastercard')?a:b):(price(a,p.provider||'mastercard')>=price(b,p.provider||'mastercard')?a:b));
          return priceReplyFor(picked,p.game,r,p.provider,p.action==='cheapest'?'أقل سعر متاح:\\n':'أعلى سعر متاح:\\n');
        }
        if(p.action==='compare')return 'اكتب الكميتين أو اسمي الباقتين اللي تريد أقارن بينهن.';
        if(p.quantity||p.weekly||p.name)return productIntent(q,{...p,game:p.game,region:r}).reply;
        return askProduct({...p,game:p.game,region:r});
      }
      if(p.step==='details'){
        const qn=quantity||quantityFrom(q);
        const wk=weeklyKind(q)||p.weekly;
        const cat=detectCategory(q)||p.category;
        const next={...p,quantity:qn||p.quantity,weekly:wk,category:cat,provider:provider||p.provider};
        state.pending=null;
        if(next.action==='list')return listProductsReply(next);
        if(next.action==='discount')return discountReply(next);
        if(next.action==='upgrade'||next.action==='downgrade')return findNextPackage(next,next.action==='upgrade'?'up':'down').reply;
        if(next.action==='cheapest'||next.action==='most_expensive'){
          const l=availableList(next.game,next.region,cat);
          if(!l.length)return 'ماكو منتجات متاحة بهذا الاختيار حالياً.';
          const picked=l.reduce((a,b)=>next.action==='cheapest'?(price(a,next.provider||'mastercard')<=price(b,next.provider||'mastercard')?a:b):(price(a,next.provider||'mastercard')>=price(b,next.provider||'mastercard')?a:b));
          return priceReplyFor(picked,next.game,next.region,next.provider,next.action==='cheapest'?'أقل سعر متاح:\\n':'أعلى سعر متاح:\\n');
        }
        if(qn||wk||cat||findProductByName(q,next.game,next.region)){
          return productIntent(q,{...next,game:next.game,region:next.region,quantity:qn,weekly:wk,category:cat,name:!qn&&!wk}).reply;
        }
        return askProduct(next);
      }
      if(p.step==='product'){
        const qn=quantity||quantityFrom(q);
        const wk=weeklyKind(q);
        const cat=detectCategory(q)||p.category;
        state.pending=null;
        if(p.action==='list')return listProductsReply({...p,category:cat});
        if(p.action==='discount')return discountReply({...p,category:cat});
        if(p.action==='upgrade'||p.action==='downgrade')return findNextPackage({...p,quantity:qn,category:cat},p.action==='upgrade'?'up':'down').reply;
        if(p.action==='cheapest'||p.action==='most_expensive'){
          const l=availableList(p.game,p.region,cat);
          if(!l.length)return 'ماكو منتجات متاحة بهذا الاختيار حالياً.';
          const picked=l.reduce((a,b)=>p.action==='cheapest'?(price(a,p.provider||'mastercard')<=price(b,p.provider||'mastercard')?a:b):(price(a,p.provider||'mastercard')>=price(b,p.provider||'mastercard')?a:b));
          return priceReplyFor(picked,p.game,p.region,p.provider,p.action==='cheapest'?'أقل سعر متاح:\\n':'أعلى سعر متاح:\\n');
        }
        return productIntent(q,{...p,quantity:qn,weekly:wk,category:cat,name:!qn&&!wk}).reply;
      }
    }

    if(intent==='cart'){
      if(includesAny(q,['ما تشتغل','ما يفتح','مشكلة','خطا','ما اكدر','ما اقدر','ما ينضاف','ما ينحذف','علق']))return 'إذا السلة ما تشتغل: حدّث الصفحة، انتظر تحميل المنتجات، وجرب فتح السلة مرة ثانية. إذا المنتج ما ينضاف، تأكد من اختيار طريقة الدفع المطلوبة. اكتبلي شنو الزر اللي يسبب المشكلة حتى أحدد الحل.';
      return cartReply(q);
    }
    if(intent==='wallet')return walletReply(q);
    if(intent==='orders')return orderReply(q);
    if(intent==='account')return accountReply(q);
    if(intent==='payment')return paymentReply(q);
    if(intent==='shipping')return shippingReply();
    if(intent==='uid')return 'Player ID هو رقم اللاعب، وZone ID هو رقم المنطقة/الخادم في Mobile Legends. افتح ملفك داخل اللعبة وانسخ الرقمين كما يظهران، ثم أدخلهما في نموذج الطلب. لا ترسل كلمة المرور أو رمز التحقق.';
    if(intent==='region')return regionReply(q);
    if(intent==='games')return 'الألعاب الموجودة حالياً بالمتجر: Mobile Legends: Bang Bang لشحن الجواهر، وHonor of Kings لشحن التوكنز. اختار اللعبة من الصفحة الرئيسية حتى تظهر منتجاتها.';
    if(intent==='security')return securityReply();
    if(intent==='refund')return 'إلغاء الطلب أو الاسترجاع يعتمد على حالة تنفيذ الطلب وسياسة المتجر. افتح «طلباتي» وراجع الحالة، ثم تواصل مع المسؤول برقم الطلب قبل تقديم طلب جديد. لا أگدر أعدك باسترجاع قبل مراجعة العملية.';
    if(intent==='technical')return technicalReply(q);
    if(intent==='contact')return `تگدر تتواصل ويا مسؤول ZenithStore عبر إنستغرام:\n${INSTAGRAM}`;
    if(intent==='navigation')return navigationReply(q);

    const ctx={game:game||state.lastGame,region:region||(state.lastRegion?REGION_LIST.find(r=>r.id===state.lastRegion):null),provider:provider||state.lastProvider,quantity,category:category||state.lastCategory,raw:q};
    if(intent==='upgrade'||intent==='downgrade'){
      const direction=intent==='upgrade'?'up':'down';
      if(!ctx.game)return askGame({...ctx,action:intent});
      if(needsRegion(ctx.game)&&!ctx.region)return askRegion({...ctx,action:intent});
      if(!ctx.category)ctx.category='gems';
      return findNextPackage(ctx,direction).reply;
    }
    if(intent==='discount')return discountReply(ctx);
    if(intent==='list_products')return listProductsReply(ctx);
    if(intent==='cheapest'||intent==='most_expensive'){
      if(!ctx.game)return askGame({...ctx,action:intent});
      if(needsRegion(ctx.game)&&!ctx.region)return askRegion({...ctx,action:intent});
      const list=availableList(ctx.game,ctx.region,ctx.category);
      if(!list.length)return 'ماكو منتجات ظاهرة حالياً بهذا الاختيار.';
      const chosen=list.reduce((a,b)=>intent==='cheapest'?(price(a,ctx.provider||'mastercard')<=price(b,ctx.provider||'mastercard')?a:b):(price(a,ctx.provider||'mastercard')>=price(b,ctx.provider||'mastercard')?a:b));
      return priceReplyFor(chosen,ctx.game,ctx.region,ctx.provider,intent==='cheapest'?'أقل سعر متاح:\n':'أعلى سعر متاح:\n');
    }
    if(intent==='compare'){
      if(!ctx.game)return askGame({...ctx,action:'compare'});
      if(needsRegion(ctx.game)&&!ctx.region)return askRegion({...ctx,action:'compare'});
      const list=availableList(ctx.game,ctx.region,ctx.category||'gems').sort((a,b)=>Number(a.diamonds||0)-Number(b.diamonds||0));
      if(ctx.quantity){
        const around=list.filter(p=>Math.abs(Number(p.diamonds||0)-ctx.quantity)>0).sort((a,b)=>Math.abs(Number(a.diamonds||0)-ctx.quantity)-Math.abs(Number(b.diamonds||0)-ctx.quantity)).slice(0,3);
        return around.length?`أقرب الباقات إلى ${ctx.quantity}:\n${around.map(p=>`• ${productTitle(p)} — ${providerPriceText(p,ctx.provider)}`).join('\n')}`:'ماكو باقات كافية للمقارنة.';
      }
      return 'حتى أقارن بدقة، اكتب الكميتين أو أسماء الباقات اللي تريد تقارن بينها.';
    }
    if(['weekly_subscription','weekly_pack','monthly','twilight','membership','fanframe'].includes(intent)||quantity||intent==='unknown'&&category){
      let weekly=null;
      if(intent==='weekly_subscription')weekly='subscription';
      if(intent==='weekly_pack')weekly='pack';
      const info={...ctx,weekly,category:category||ctx.category};
      if(!info.game)return askGame({...info,raw:q});
      if(needsRegion(info.game)&&!info.region)return askRegion({...info,raw:q});
      return productIntent(q,info).reply;
    }
    if(intent==='discount')return discountReply(ctx);
    const faq=faqSearch(q);
    if(faq)return `حسب الأسئلة الشائعة بالموقع:\n${faq.a}`;
    const kb=knowledgeSearch(q);
    if(kb)return kb.answer;
    if(intent==='faq'||intent==='unknown'){
      const match=retrieveSiteText(q);
      if(match&&match.score>.23){
        const excerpt=match.text.slice(0,620);
        return `أقرب معلومات لقيتها بقسم «${match.name}» بالموقع:\n${excerpt}\nإذا تقصد نقطة محددة من هذا القسم، اكتب اسمها حتى أوضحها.`;
      }
      if(includesAny(q,['شنو','ماذا','هل','ليش','لماذا','كيف','شلون','اقدر','ممكن','اريد','اريد اعرف'])){
        return 'أريد أجاوبك بشكل صحيح، بس سؤالك ما يحدد القسم المقصود. تقصد المنتجات والباقات، التخفيضات، السلة، المحفظة، الحساب، الطلبات، الدفع، لو مشكلة بالشحن؟ اكتب اسم القسم أو مثال بسيط.';
      }
      return 'وصلني سؤالك، لكن ما لقيت له معلومة مؤكدة ضمن بيانات المتجر الحالية. أگدر أجاوب عن الباقات والأسعار والسلة والتخفيضات والحساب والمحفظة والطلبات والشحن. وإذا الموضوع يحتاج مسؤول، تواصل وياه من هنا:\n'+INSTAGRAM;
    }
    return 'أگدر أساعدك بهذا الموضوع إذا تحددلي شنو الجزء اللي تقصده. '+generalHelp();
  }

  function addMessage(text,who='bot') {
    const node=document.createElement('div');
    node.className='zenithChatBubble '+who;
    node.textContent=String(text||'');
    messages.appendChild(node);
    messages.scrollTop=messages.scrollHeight;
    return node;
  }
  function showSupport() {
    if(typeof window.hideCustomerPanels==='function')window.hideCustomerPanels();
    panel.hidden=false;
    if(typeof window.saveActivePage==='function')window.saveActivePage('support');
    if(typeof window.setActiveNav==='function')window.setActiveNav('');
    const menu=$('mainMenu');if(menu)menu.hidden=true;
    const toggle=$('menuToggle');if(toggle){toggle.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');}
    panel.scrollIntoView({behavior:'smooth',block:'start'});
    input?.focus();
  }
  function send(value) {
    const q=String(value||'').trim();
    if(!q||!messages)return;
    empty?.classList.add('is-hidden');
    addMessage(q,'user');
    if(input)input.value='';
    const typing=document.createElement('div');
    typing.className='zenithTyping';typing.setAttribute('aria-label','المساعد يكتب');
    typing.innerHTML='<i></i><i></i><i></i>';
    messages.appendChild(typing);messages.scrollTop=messages.scrollHeight;
    let reply;
    try { reply=respond(q); }
    catch(err) { console.error('[Zenith Assistant]',err); reply='صار خطأ بسيط أثناء قراءة البيانات. حدّث الصفحة وجرب مرة ثانية، وإذا استمرت المشكلة تواصل ويا المسؤول.'; }
    const delay=Math.min(1100,350+String(reply).length*2);
    setTimeout(()=>{typing.remove();addMessage(reply,'bot');},delay);
  }

  $('menuSupport')?.addEventListener('click',showSupport);
  $('supportBackHome')?.addEventListener('click',()=>$('navHome')?.click());
  form?.addEventListener('submit',event=>{event.preventDefault();send(input?.value);});
  document.querySelectorAll('#zenithChatSuggestions button').forEach(button=>button.addEventListener('click',()=>send(button.dataset.question||button.textContent)));

  if(limitLabel)limitLabel.textContent='مساعد زينيث المحلي — يقرأ بيانات المتجر الحالية، بدون اشتراك أو API.';
  if(Date.now()-session.started>=DAY){session={started:Date.now()};try{localStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch(_){}}
  setTimeout(()=>{
    try{localStorage.removeItem(SESSION_KEY);}catch(_){}
    if(messages){
      messages.innerHTML='';
      const welcome=document.createElement('div');welcome.className='zenithChatBubble bot';
      welcome.textContent='أهلاً بك في ZenithStore 👋\nبدأت محادثة جديدة. اسألني عن المنتجات أو أي قسم بالموقع.';
      messages.appendChild(welcome);
    }
    empty?.classList.remove('is-hidden');
    session={started:Date.now()};try{localStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch(_){}
  },Math.max(0,DAY-(Date.now()-session.started)));

  // Expose a tiny read-only diagnostic surface for maintainers; no purchase actions.
  window.ZenithAssistant = {
    version:'2.0.0-local',
    ask:respond,
    getState:()=>({...state}),
    getProductCount:()=>typeof productsCache !== 'undefined' && Array.isArray(productsCache) ? productsCache.length : 0
  };
  if(sessionStorage.getItem('zenithstore:activePage:'+location.pathname)==='support'&&performance.getEntriesByType('navigation')[0]?.type==='reload')showSupport();
})();
