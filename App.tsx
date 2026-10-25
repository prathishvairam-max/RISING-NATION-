import { useEffect, useMemo, useState } from 'react';
import { api, auth } from '@appdeploy/client';
import { Gamepad2, MessageCircle, Youtube, CalendarDays, ShoppingBag, Code2, Megaphone, Users, Crown, LogIn, LogOut, Settings, Save, Plus, Upload, X, ExternalLink, Sparkles, Menu, Trash2, Pencil, Eye, ShieldCheck, Clock, CheckCircle2, XCircle, Image as ImageIcon, LayoutDashboard, ArrowLeft, RefreshCw } from 'lucide-react';

type Item = Record<string, any>;
type Me = { user?: { userId?: string; name?: string; email?: string }; role: string; permissions?: string[] };
type SettingsData = Record<string, string>;
const sections = [
 {id:'minecraft',title:'Minecraft',description:'Server details, connection information and community worlds.',icon:Gamepad2,kind:'minecraft'},
 {id:'discord',title:'Discord',description:'Join the RISING NATION community.',icon:MessageCircle,kind:'discord'},
 {id:'youtube',title:'YouTube',description:'Videos, channel updates and creator content.',icon:Youtube,kind:'videos'},
 {id:'events',title:'Events',description:'Community events, schedules and highlights.',icon:CalendarDays,kind:'events'},
 {id:'games',title:'Games',description:'Explore game offers and submit purchase requests.',icon:ShoppingBag,kind:'offers'},
 {id:'developers',title:'Hire a Developer',description:'Browse services, portfolios and developer contacts.',icon:Code2,kind:'services'},
 {id:'announcements',title:'Announcements',description:'Official news and important notices.',icon:Megaphone,kind:'announcements'},
 {id:'community',title:'Community Updates',description:'Projects, community news and shared progress.',icon:Users,kind:'posts'}
];
const publishKinds = [['minecraft','Minecraft'],['discord','Discord'],['videos','YouTube / videos'],['events','Events'],['offers','Games'],['services','Developers'],['announcements','Announcements'],['posts','Community updates']];
const imageKeys: Record<string,string> = {minecraft:'minecraftImage',discord:'discordImage',youtube:'youtubeImage',events:'eventsImage',games:'offersImage',developers:'servicesImage',announcements:'announcementsImage',community:'communityImage'};
const defaultSettings: SettingsData = {name:'RISING NATION',tagline:'ONE COMMUNITY. INFINITE POSSIBILITIES.',description:'Your home for gaming, creators, developers and a community that builds together.',minecraftIp:'Not configured yet',minecraftEdition:'Java Edition',minecraftVersion:'Owner configured',minecraftStatus:'UNKNOWN',minecraftDescription:'Server information will be published here.',discordUrl:'',youtubeUrl:'',youtubeName:'RISING NATION',youtubeDescription:'Videos, builds and community highlights.',footer:'Built for players, creators and community builders.'};
function messageOf(e: unknown) { return e instanceof Error ? e.message : 'Something went wrong. Please try again.'; }
function imageFor(it: Item) { return it.image || it.imageUrl || ''; }
function validUrl(value:string) { return !value || /^https:\/\//i.test(value); }

export default function App() {
 const [page,setPage] = useState((window.location.hash.slice(1) || 'home').replace(/^page\//,''));
 const [menu,setMenu] = useState(false);
 const [user,setUser] = useState<Me|null>(null);
 const [settings,setSettings] = useState<SettingsData>(defaultSettings);
 const [content,setContent] = useState<Record<string,Item[]>>({});
 const [notice,setNotice] = useState('');
 const [busy,setBusy] = useState(false);
 const [uploading,setUploading] = useState(false);
 const [panel,setPanel] = useState(false);
 const [claimCode,setClaimCode] = useState('');
 const [selected,setSelected] = useState<Item|null>(null);
 const [kind,setKind] = useState('offers');
 const [editId,setEditId] = useState('');
 const [title,setTitle] = useState('');
 const [body,setBody] = useState('');
 const [url,setUrl] = useState('');
 const [imageUrl,setImageUrl] = useState('');
 const [imagePath,setImagePath] = useState('');
 const [price,setPrice] = useState('');
 const [compareAtPrice,setCompareAtPrice] = useState('');
 const [offerBadge,setOfferBadge] = useState('');
 const [category,setCategory] = useState('');
 const [sectionKey,setSectionKey] = useState('minecraftImage');
 const [sectionImageUrl,setSectionImageUrl] = useState('');
 const [sectionImagePath,setSectionImagePath] = useState('');
 const [sectionUrl,setSectionUrl] = useState('');
 const [requests,setRequests] = useState<Item[]>([]);
 const [myRequests,setMyRequests] = useState<Item[]>([]);
 const [dashboard,setDashboard] = useState<Item|null>(null);
 const [staff,setStaff] = useState<Item[]>([]);
 const [requestInstructions,setRequestInstructions] = useState<Record<string,string>>({});
 const [statusFilter,setStatusFilter] = useState('pending');

 async function refresh() {
  try {
   const pub = await api.get('/api/public');
   setSettings({...defaultSettings,...(pub.data?.settings||{})});
   setContent(pub.data?.content||{});
   const signed = await auth.getUser();
   if (signed) { try { const me=await api.get('/api/me'); setUser(me.data); } catch { setUser(null); } }
   else setUser(null);
  } catch(e) { setNotice(messageOf(e)); }
 }
 useEffect(()=>{ void refresh(); const onHash=()=>{setPage((window.location.hash.slice(1)||'home').replace(/^page\//,''));setMenu(false);setSelected(null);}; window.addEventListener('hashchange',onHash); return ()=>window.removeEventListener('hashchange',onHash); },[]);
 useEffect(()=>{ void api.post('/api/metrics/view',{page:page||'home'}).catch(()=>{}); },[page]);
 const currentSection = sections.find(s=>s.id===page);
 const canManage = user?.role==='owner' || (user?.role==='staff' && (user.permissions||[]).some(p=>['publish_content','edit_content','manage_offers'].includes(p)));
 const isOwner = user?.role==='owner';

 async function signIn() {
  setBusy(true);setNotice('');
  try { await auth.signIn(); const me=await api.get('/api/me');setUser(me.data);setNotice('Signed in successfully.'); }
  catch(e) { const m=messageOf(e);setNotice(m.includes('popup_blocked')?'Your browser blocked the sign-in popup. Allow popups and try again.':m); }
  finally {setBusy(false);}
 }
 async function signOut() { await auth.signOut();setUser(null);setPanel(false);setNotice('Signed out.'); }
 async function claimOwner(e:React.FormEvent) {
  e.preventDefault();setBusy(true);setNotice('');
  try {await api.post('/api/owner/claim',{code:claimCode});setClaimCode('');await refresh();setNotice('Owner access activated.');}
  catch(e){setNotice(messageOf(e));}finally{setBusy(false);}
 }
 async function saveSettings(e:React.FormEvent) {
  e.preventDefault();setBusy(true);setNotice('');
  try {
   const keys=['name','tagline','description','minecraftIp','minecraftEdition','minecraftVersion','minecraftStatus','minecraftDescription','discordUrl','youtubeUrl','youtubeName','youtubeDescription','footer','heroImage','minecraftImage','discordImage','youtubeImage','offersImage','servicesImage','eventsImage','announcementsImage','communityImage'];
   const payload:Record<string,string>={}; for(const k of keys) payload[k]=settings[k]||'';
   payload.minecraftStatus=payload.minecraftStatus||'UNKNOWN';
   if(!validUrl(payload.discordUrl)||!validUrl(payload.youtubeUrl)) throw new Error('Discord and YouTube links must begin with https://');
   await api.put('/api/settings',payload);await refresh();setNotice('Website settings saved.');
  } catch(e){setNotice(messageOf(e));}finally{setBusy(false);}
 }
 async function uploadImage(file:File,target:'tile'|'section') {
  if(!file.type.startsWith('image/')){setNotice('Choose an image file.');return;}
  if(file.size>4*1024*1024){setNotice('Choose an image smaller than 4 MB.');return;}
  setUploading(true);setNotice('Preparing image upload…');
  try {
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();const timer=window.setTimeout(()=>reject(new Error('Reading the image timed out. Try a smaller image.')),15000);reader.onload=()=>{window.clearTimeout(timer);resolve(String(reader.result||''));};reader.onerror=()=>{window.clearTimeout(timer);reject(new Error('Could not read the image from your device.'));};reader.readAsDataURL(file);});
   setNotice('Uploading image…');
   let timer=0;
   const request=api.post('/api/upload-image',{data,contentType:file.type});
   const timeout=new Promise<never>((_,reject)=>{timer=window.setTimeout(()=>reject(new Error('Upload timed out after 25 seconds. Check your connection and retry.')),25000);});
   const result=await Promise.race([request,timeout]);window.clearTimeout(timer);
   if(!result.data?.path) throw new Error('The server did not return a saved image path.');
   if(target==='tile'){setImagePath(result.data.path);setImageUrl('');}else{setSectionImagePath(result.data.path);setSectionImageUrl('');}
   setNotice('Image uploaded. Save or publish to attach it.');
  } catch(e){setNotice('Image upload failed: '+messageOf(e));}
  finally{setUploading(false);}
 }
 async function saveSection(e:React.FormEvent) {
  e.preventDefault();setBusy(true);setNotice('');
  try {
   const patch:Record<string,string>={[sectionKey]:sectionImagePath||sectionImageUrl||settings[sectionKey]||''};
   if(sectionKey==='discordImage'&&sectionUrl)patch.discordUrl=sectionUrl;
   if(sectionKey==='youtubeImage'&&sectionUrl)patch.youtubeUrl=sectionUrl;
   if(!validUrl(sectionUrl)||!validUrl(sectionImageUrl))throw new Error('Links must begin with https://');
   await api.put('/api/settings',patch);await refresh();setSectionImagePath('');setSectionImageUrl('');setNotice('Section image and link saved.');
  }catch(e){setNotice(messageOf(e));}finally{setBusy(false);}
 }
 function clearEditor(){setEditId('');setTitle('');setBody('');setUrl('');setImageUrl('');setImagePath('');setPrice('');setCompareAtPrice('');setOfferBadge('');setCategory('');}
 function startEdit(it:Item) {setEditId(String(it.id||''));setTitle(it.title||'');setBody(it.message||it.description||'');setUrl(it.url||'');setImageUrl(it.image||'');setImagePath(it.imagePath||'');setPrice(it.price||'');setCompareAtPrice(it.compareAtPrice||'');setOfferBadge(it.offerBadge||'');setCategory(it.category||'');setSelected(null);setPanel(true);}
 async function publish(e:React.FormEvent) {
  e.preventDefault();setBusy(true);setNotice('');
  try {
   const payload={title,message:body,description:body,url,image:imageUrl,imagePath,category:category||kind,price,compareAtPrice,offerBadge};
   if(!validUrl(url)||!validUrl(imageUrl))throw new Error('Links must begin with https://');
   if(editId) await api.put('/api/content/'+kind+'/'+encodeURIComponent(editId),payload);
   else await api.post('/api/content/'+kind,payload);
   clearEditor();await refresh();setNotice(editId?'Changes saved.':'Content published successfully.');
  }catch(e){setNotice(messageOf(e));}finally{setBusy(false);}
 }
 async function deleteItem(k:string,id:string) {
  if(!window.confirm('Delete this item permanently?'))return;
  setBusy(true);try{await api.delete('/api/content/'+k+'/'+encodeURIComponent(id));await refresh();setNotice('Item deleted.');}
  catch(e){setNotice(messageOf(e));}finally{setBusy(false);}
 }
 async function loadDashboard() {
  try {
   const [d,r,s]=await Promise.all([api.get('/api/owner/dashboard'),api.get('/api/purchase-requests'),api.get('/api/staff/permissions')]);
   setDashboard(d.data);setRequests(Array.isArray(r.data)?r.data:[]);setStaff(Array.isArray(s.data)?s.data:[]);
  }catch(e){setNotice(messageOf(e));}
 }
 async function loadMyRequests() { try {const r=await api.get('/api/purchase-requests/mine');setMyRequests(Array.isArray(r.data)?r.data:[]);}catch(e){setNotice(messageOf(e));} }
 useEffect(()=>{if(user){void loadMyRequests();if(user.role==='owner')void loadDashboard();}},[user?.role,user?.user?.userId]);
 async function purchase(it:Item) {
  if(!user){setNotice('Sign in to submit a purchase request.');setSelected(null);void signIn();return;}
  setBusy(true);try{const r=await api.post('/api/purchase-requests',{gameId:it.id});setNotice('Purchase request submitted. Status: Pending.');setSelected(null);await loadMyRequests();if(isOwner)await loadDashboard();}
  catch(e){setNotice(messageOf(e));}finally{setBusy(false);}
 }
 async function decideRequest(req:Item,status:'approved'|'rejected') {
  setBusy(true);try{await api.put('/api/purchase-requests/'+encodeURIComponent(req.id),{status,instructions:requestInstructions[req.id]||req.instructions||''});await loadDashboard();setNotice('Purchase request updated.');}
  catch(e){setNotice(messageOf(e));}finally{setBusy(false);}
 }
 async function updateStaff(member:Item,role:string,permissions:string[]) {
  setBusy(true);try{await api.put('/api/staff/permissions/'+encodeURIComponent(member.userId),{role,permissions,suspended:member.suspended});await loadDashboard();setNotice('Staff permissions saved.');}
  catch(e){setNotice(messageOf(e));}finally{setBusy(false);}
 }
 const listFor = (s:typeof sections[number]) => s.kind==='minecraft' ? [...(content.minecraft||[]),...(content.cards||[]).filter(x=>x.category==='minecraft')] : s.kind==='discord' ? [...(content.discord||[]),...(content.cards||[]).filter(x=>x.category==='discord')] : s.kind==='offers' ? content.offers||[] : s.kind==='services' ? content.services||[] : s.kind==='videos' ? content.videos||[] : s.kind==='events' ? content.events||[] : s.kind==='announcements' ? content.announcements||[] : content.posts||[];
 const filteredRequests=useMemo(()=>requests.filter(r=>statusFilter==='all'||r.status===statusFilter),[requests,statusFilter]);
 const renderContentGrid=(list:Item[],type:string)=>!list.length?<div className="empty-state"><Sparkles size={24}/><h3>Fresh updates are coming soon</h3><p>Check back later for new {type}.</p></div>:<div className={'content-grid '+(type==='offers'?'games-grid':'')}>{list.map((it,i)=><button type="button" className={'content-tile '+(type==='offers'?'game-image-tile':'')} key={it.id||i} onClick={()=>setSelected({...it,_kind:type})}>{imageFor(it)?<img src={imageFor(it)} alt={type==='offers'?'Game cover':it.title||'RISING NATION content'} loading="lazy"/>:<div className="image-placeholder"><ImageIcon size={28}/><span>RISING NATION</span></div>}{type!=='offers'&&<div className="tile-copy"><span className="eyebrow">{type.toUpperCase()}</span><h3>{it.title||'Untitled'}</h3><p>{it.message||it.description||''}</p><span className="tile-more">View details ↗</span></div>}</button>)}</div>;

 return <div className="app">
  <header className="topbar"><a className="brand" href="#home"><span className="logo">RN</span><span>RISING <b>NATION</b><small>ONE COMMUNITY. INFINITE POSSIBILITIES.</small></span></a><button className="menu" onClick={()=>setMenu(!menu)} aria-label="Toggle navigation"><Menu/></button><nav className={menu?'nav open':'nav'}><a href="#home" onClick={()=>setMenu(false)}>Home</a>{sections.map(s=><a key={s.id} href={'#'+s.id} onClick={()=>setMenu(false)}>{s.title}</a>)}{user&&<a href="#my-requests" onClick={()=>setMenu(false)}>My Requests</a>}{user&&<a href="#dashboard" onClick={()=>{setMenu(false);setPanel(true);}}>Dashboard</a>}</nav><button className="button secondary" onClick={user?signOut:signIn} disabled={busy}>{user?<LogOut size={16}/>:<LogIn size={16}/>} {user?'Sign out':'Sign in'}</button></header>
  {content.announcements?.length>0&&<a className="announcement-ribbon" href="#announcements"><Megaphone size={17}/><b>ANNOUNCEMENT</b><span>{content.announcements[0].title||content.announcements[0].message}</span></a>}
  <main>
   {page==='home'&&<><section className="hero"><span className="eyebrow"><Sparkles size={14}/> YOUR COMMUNITY. YOUR NEXT LEVEL.</span><div className="logo large">RN</div><h1>RISING <span>NATION</span></h1><p className="tagline">{settings.tagline}</p><p className="description">{settings.description}</p><div className="actions"><a className="button" href="#minecraft">Explore the nation ↗</a><a className="button secondary" href="#discord">Join Discord ↗</a></div><div className="hero-glow"/></section><section className="section"><span className="eyebrow">EXPLORE THE NATION</span><h2>Everything starts <em>here.</em></h2><p className="muted">Choose a section to explore. Each area has its own page.</p><div className="section-grid">{sections.map((s,i)=>{const Icon=s.icon;return <a className="section-card" href={'#'+s.id} key={s.id}>{settings[imageKeys[s.id]]&&<img src={settings[imageKeys[s.id]]} alt="" loading="lazy"/>}<div className={'section-icon tone-'+(i%4)}><Icon size={24}/></div><span className="eyebrow">EXPLORE ↗</span><h3>{s.title}</h3><p>{s.description}</p></a>})}</div></section></>}
   {currentSection&&<section className="section page-section"><a className="back-link" href="#home"><ArrowLeft size={16}/> All sections</a><span className="eyebrow">RISING NATION / {currentSection.title.toUpperCase()}</span><h1 className="page-title">{currentSection.title}</h1><p className="muted">{currentSection.description}</p>{settings[imageKeys[currentSection.id]]&&<img className="section-banner" src={settings[imageKeys[currentSection.id]]} alt={currentSection.title}/>}
    {page==='minecraft'&&<><div className="server"><div><b>SERVER STATUS · {settings.minecraftStatus||'UNKNOWN'}</b><p>{settings.minecraftDescription}</p></div><div><small>SERVER ADDRESS</small><h3>{settings.minecraftIp||'Not configured yet'}</h3><small>{settings.minecraftEdition} · {settings.minecraftVersion}</small></div></div><p className="muted">Copy the server address into Minecraft Java Edition to connect.</p>{renderContentGrid(listFor(currentSection),'minecraft')}</>}
    {page==='discord'&&<div className="feature-card"><div className="feature-art"><MessageCircle size={46}/></div><div><h2>Join our Discord</h2><p>{settings.description}</p><a className="button" href={settings.discordUrl||'#'} target={settings.discordUrl?'_blank':undefined} rel="noreferrer">Join Discord now ↗</a></div></div>}
    {page==='youtube'&&<div className="feature-card"><div className="feature-art"><Youtube size={46}/></div><div><h2>{settings.youtubeName||'RISING NATION'}</h2><p>{settings.youtubeDescription||'Videos, builds and community highlights.'}</p><a className="button" href={settings.youtubeUrl||'#'} target={settings.youtubeUrl?'_blank':undefined} rel="noreferrer">Subscribe ↗</a></div></div>}
    {page==='games'&&<><p className="muted">Choose a game image to see details and the current offer. Purchase requests require a website account.</p>{renderContentGrid(listFor(currentSection),'offers')}</>}
    {page==='developers'&&<><p className="muted">Open a developer profile to view their services, portfolio and contact details.</p>{renderContentGrid(listFor(currentSection),'services')}</>}
    {['events','announcements','community'].includes(page)&&renderContentGrid(listFor(currentSection),currentSection.kind)}
   </section>}
   {page==='my-requests'&&<section className="section page-section"><a className="back-link" href="#home"><ArrowLeft size={16}/> Home</a><h1 className="page-title">My Purchase Requests</h1>{!user?<button className="button" onClick={signIn}>Sign in to view requests</button>:<><button className="button secondary" onClick={()=>void loadMyRequests()}><RefreshCw size={15}/> Refresh requests</button><div className="request-list">{myRequests.length?myRequests.map(r=><article className="request-card" key={r.id}><div><h3>{r.gameName||r.title}</h3><p>{r.priceAtRequest||'Price shown on request'}</p><span className={'status status-'+r.status}>{r.status}</span>{r.status==='approved'&&<p className="instructions">{r.instructions||'Your request is approved. Please check back for next-step instructions.'}</p>}</div></article>):<p className="muted">You have not submitted any purchase requests yet.</p>}</div></>}</section>}
   {page==='dashboard'&&<section className="section page-section"><a className="back-link" href="#home"><ArrowLeft size={16}/> Home</a><span className="eyebrow">PRIVATE MANAGEMENT</span><h1 className="page-title">Owner Dashboard</h1>{!user?<button className="button" onClick={signIn}>Sign in</button>:user.role!=='owner'&&!canManage?<div className="owner-card"><p>You are signed in as {user.role}. You do not have dashboard permissions.</p><form onSubmit={claimOwner} className="owner-form"><h3>Owner setup</h3><label>Owner setup code<input type="password" value={claimCode} onChange={e=>setClaimCode(e.target.value)} minLength={8} required/></label><button className="button" disabled={busy}>Activate owner access</button></form></div>:<><div className="dashboard-tabs"><button className="button secondary" onClick={()=>setPanel(true)}>Content manager</button>{isOwner&&<button className="button secondary" onClick={()=>void loadDashboard()}><RefreshCw size={15}/> Refresh overview</button>}</div>{isOwner&&dashboard&&<div className="stats-grid">{[{label:'Recorded page views',value:dashboard.pageViews||0,icon:Eye},{label:'Registered accounts',value:dashboard.users||0,icon:Users},{label:'Staff members',value:dashboard.staff||0,icon:ShieldCheck},{label:'Pending requests',value:dashboard.pending||0,icon:Clock}].map((x:any)=><div className="stat-card" key={x.label}><x.icon size={20}/><span>{x.label}</span><strong>{x.value}</strong></div>)}</div>}
    <div className="dashboard-layout"><aside className="dashboard-nav"><button className={panel?'active':''} onClick={()=>setPanel(true)}><Settings size={16}/> Content & settings</button>{isOwner&&<button onClick={()=>{setPanel(false);void loadDashboard();}}><ShoppingBag size={16}/> Purchase requests</button>}{isOwner&&<button onClick={()=>{setPanel(false);void loadDashboard();}}><Users size={16}/> Staff access</button>}</aside><div className="dashboard-main">
     {panel&&<><h2>Website settings</h2><form onSubmit={saveSettings} className="owner-form settings-grid">{[['name','Site name'],['tagline','Tagline'],['description','Homepage description'],['minecraftIp','Minecraft server address'],['minecraftEdition','Minecraft edition'],['minecraftVersion','Minecraft version'],['minecraftStatus','Server status'],['minecraftDescription','Minecraft description'],['discordUrl','Discord invite URL'],['youtubeUrl','YouTube channel URL'],['youtubeName','YouTube channel name'],['youtubeDescription','YouTube description'],['footer','Footer text']].map(([k,l])=><label key={k}>{l}{['description','minecraftDescription','youtubeDescription'].includes(k)?<textarea rows={3} value={settings[k]||''} onChange={e=>setSettings({...settings,[k]:e.target.value})}/>:<input value={settings[k]||''} onChange={e=>setSettings({...settings,[k]:e.target.value})}/>}</label>)}<button className="button" disabled={busy}><Save size={16}/> Save settings</button></form>
      <h2>Section images and links</h2><form onSubmit={saveSection} className="owner-form"><label>Section<select value={sectionKey} onChange={e=>{setSectionKey(e.target.value);setSectionImageUrl('');setSectionImagePath('');setSectionUrl('')}}>{Object.entries({heroImage:'Homepage hero',minecraftImage:'Minecraft',discordImage:'Discord',youtubeImage:'YouTube',eventsImage:'Events',offersImage:'Games',servicesImage:'Developers',announcementsImage:'Announcements',communityImage:'Community'}).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Section link (optional)<input value={sectionUrl} onChange={e=>setSectionUrl(e.target.value)} placeholder="https://..."/></label><label>Image URL<input value={sectionImageUrl} onChange={e=>{setSectionImageUrl(e.target.value);setSectionImagePath('')}} placeholder="https://..."/></label><label className="upload-label"><Upload size={16}/> {uploading?'Uploading…':'Upload section image'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadImage(f,'section');e.currentTarget.value=''}}/></label><button className="button" disabled={busy||uploading}>Save section</button></form>
      <h2>{editId?'Edit content item':'Add new content'}</h2><form onSubmit={publish} className="owner-form"><label>Section<select value={kind} onChange={e=>{setKind(e.target.value);clearEditor()}}>{publishKinds.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Title / name<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Details, services or portfolio information<textarea rows={5} maxLength={5000} value={body} onChange={e=>setBody(e.target.value)}/></label><label>Contact / destination URL<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/></label><label>Category<input value={category} onChange={e=>setCategory(e.target.value)}/></label>{kind==='offers'&&<div className="settings-grid"><label>Offer price<input value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. ₹199"/></label><label>Original price<input value={compareAtPrice} onChange={e=>setCompareAtPrice(e.target.value)} placeholder="e.g. ₹299"/></label><label>Offer badge<input value={offerBadge} onChange={e=>setOfferBadge(e.target.value)} placeholder="e.g. 30% OFF"/></label></div>}<label>Image URL<input value={imageUrl} onChange={e=>{setImageUrl(e.target.value);setImagePath('')}} placeholder="https://..."/></label><label className="upload-label"><Upload size={16}/> {uploading?'Uploading…':'Upload image from device'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadImage(f,'tile');e.currentTarget.value=''}}/></label><div className="actions"><button className="button" disabled={busy||uploading}><Save size={16}/>{editId?'Save changes':'Publish content'}</button>{editId&&<button type="button" className="button secondary" onClick={clearEditor}>Cancel edit</button>}</div></form>
      <h2>Manage existing items</h2><label>Content type<select value={kind} onChange={e=>{setKind(e.target.value);clearEditor()}}>{publishKinds.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><div className="manage-list">{(content[kind]||[]).map(it=><div className="manage-row" key={it.id}><div>{imageFor(it)&&<img src={imageFor(it)} alt=""/>}<div><b>{it.title||'Untitled'}</b><p>{it.message||it.description||''}</p>{it.price&&<small>{it.price}</small>}</div></div><div className="actions"><button className="icon-button" onClick={()=>startEdit(it)} aria-label="Edit item"><Pencil size={16}/></button><button className="icon-button danger" onClick={()=>void deleteItem(kind,String(it.id))} aria-label="Delete item"><Trash2 size={16}/></button></div></div>)}</div></>}
     {!panel&&isOwner&&<><h2>Purchase requests</h2><label>Filter requests<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label><div className="request-list">{filteredRequests.map(r=><article className="request-card" key={r.id}><div className="request-head"><div><h3>{r.gameName}</h3><p>Buyer: {r.username||r.buyerName} · {r.priceAtRequest}</p><small>{r.createdAt}</small></div><span className={'status status-'+r.status}>{r.status}</span></div><label>Next-step instructions<textarea rows={2} value={requestInstructions[r.id]??r.instructions??''} onChange={e=>setRequestInstructions({...requestInstructions,[r.id]:e.target.value})} placeholder="Instructions shown after approval"/></label><div className="actions"><button className="button" disabled={busy} onClick={()=>void decideRequest(r,'approved')}><CheckCircle2 size={16}/> Approve</button><button className="button secondary" disabled={busy} onClick={()=>void decideRequest(r,'rejected')}><XCircle size={16}/> Reject</button></div></article>)}</div><h2>Staff and permissions</h2><p className="muted">Grant only the access each person needs. The owner remains the highest authority.</p><div className="manage-list">{staff.map(m=><StaffEditor key={m.userId} member={m} busy={busy} onSave={updateStaff}/>)}</div></>}
    </div></div></>}</section>}
  </main>
  {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><article className="detail-modal" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)} aria-label="Close"><X/></button>{imageFor(selected)&&<img className="modal-image" src={imageFor(selected)} alt={selected.title||''}/>}<div className="modal-body"><span className="eyebrow">{String(selected._kind||'RISING NATION').toUpperCase()}</span><h2>{selected.title||'Details'}</h2>{selected.price&&<div className="modal-prices">{selected.compareAtPrice&&<del>{selected.compareAtPrice}</del>}<strong>{selected.price}</strong>{selected.offerBadge&&<span className="offer-badge">{selected.offerBadge}</span>}</div>}<p className="detail-description">{selected.message||selected.description||'More information coming soon.'}</p>{selected._kind==='offers'?<button className="button" disabled={busy} onClick={()=>void purchase(selected)}><ShoppingBag size={16}/> Buy Now</button>:selected.url&&<a className="button" href={selected.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Contact / open link ↗</a>}</div></article></div>}
  {notice&&<div className="toast" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss message"><X size={16}/></button></div>}
  <footer><div className="brand"><span className="logo">RN</span><span>RISING <b>NATION</b><small>ONE COMMUNITY. INFINITE POSSIBILITIES.</small></span></div><span>{settings.footer}</span><a href="#home">Back to top ↑</a></footer>
 </div>;
}

function StaffEditor({member,busy,onSave}:{member:Item;busy:boolean;onSave:(m:Item,role:string,permissions:string[])=>void}) {
 const [role,setRole]=useState(member.role==='owner'?'owner':member.role==='staff'?'staff':'member');
 const [permissions,setPermissions]=useState<string[]>(member.permissions||[]);
 const choices=[['publish_content','Publish content'],['edit_content','Edit content'],['manage_offers','Manage game offers'],['manage_staff_profiles','Manage staff profiles'],['review_private_submissions','Review private submissions'],['view_moderation_logs','View audit logs'],['create_events','Create events'],['moderate_posts','Moderate community posts']];
 return <article className="staff-row"><div><b>{member.name||member.email||member.userId}</b><p>{member.email||member.userId}</p><span className="status">{member.role}</span></div>{member.role!=='owner'&&<><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="member">Member</option><option value="staff">Staff / administrator</option></select></label>{role==='staff'&&<div className="permission-grid">{choices.map(([v,l])=><label key={v} className="check-label"><input type="checkbox" checked={permissions.includes(v)} onChange={e=>setPermissions(e.target.checked?[...permissions,v]:permissions.filter(p=>p!==v))}/>{l}</label>)}</div>}<button className="button secondary" disabled={busy} onClick={()=>onSave(member,role,role==='staff'?permissions:[])}>Save access</button></>}</article>;
}
