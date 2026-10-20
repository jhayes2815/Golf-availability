(async function(){
  const cfg=window.GOLF_SHARED_CONFIG;
  if(!cfg||cfg.supabaseUrl.includes('PASTE_')) return alert('Complete config.js before using shared availability.');
  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  const KEY='golf4';
  const banner=document.createElement('div');
  banner.style='position:sticky;top:0;z-index:9999;background:#103b2d;color:white;padding:10px;text-align:center;font:14px system-ui';
  document.body.prepend(banner);
  const {data:{session}}=await sb.auth.getSession();
  if(!session){
    banner.innerHTML='<b>Shared mode:</b> <input id="shareEmail" type="email" placeholder="Email address" style="padding:7px;border-radius:6px;border:0;margin:0 5px"><button id="shareLogin" style="padding:7px;border:0;border-radius:6px">Email sign-in link</button><span id="shareMsg" style="margin-left:8px"></span>';
    document.getElementById('shareLogin').onclick=async()=>{const email=document.getElementById('shareEmail').value.trim();const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.href.split('#')[0]}});document.getElementById('shareMsg').textContent=error?error.message:'Check your email.'};
    return;
  }
  banner.innerHTML='<b>Shared availability active</b> · <span id="syncState">Loading…</span> · '+session.user.email+' <button id="shareLogout" style="margin-left:8px;padding:5px;border:0;border-radius:5px">Sign out</button>';
  document.getElementById('shareLogout').onclick=async()=>{await sb.auth.signOut();location.reload()};
  const status=t=>document.getElementById('syncState').textContent=t;
  const readLocal=()=>{try{return JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('golf4v2')||'null')}catch{return null}};
  const writeLocal=s=>{localStorage.setItem(KEY,JSON.stringify(s));localStorage.setItem('golf4v2',JSON.stringify(s))};
  const {data,error}=await sb.from('golf_group_state').select('state').eq('group_id',cfg.groupId).maybeSingle();
  if(error){status('Load failed');return}
  if(data?.state){const old=JSON.stringify(readLocal());writeLocal(data.state);status('Synced');if(old!==JSON.stringify(data.state))location.reload()}
  else {const initial=readLocal()||{names:['Player 1','Player 2','Player 3','Player 4'],a:{}};await sb.from('golf_group_state').insert({group_id:cfg.groupId,state:initial,updated_by:session.user.id});status('Created')}
  let last=localStorage.getItem(KEY)||localStorage.getItem('golf4v2')||'';
  setInterval(async()=>{const cur=localStorage.getItem(KEY)||localStorage.getItem('golf4v2')||'';if(cur&&cur!==last){last=cur;status('Saving…');const state=JSON.parse(cur);const {error}=await sb.from('golf_group_state').upsert({group_id:cfg.groupId,state,updated_by:session.user.id,updated_at:new Date().toISOString()},{onConflict:'group_id'});status(error?'Save failed':'Synced')}},700);
  sb.channel('golf-shared').on('postgres_changes',{event:'*',schema:'public',table:'golf_group_state',filter:'group_id=eq.'+cfg.groupId},p=>{if(p.new?.state&&JSON.stringify(p.new.state)!==JSON.stringify(readLocal())){writeLocal(p.new.state);status('Updated by another player');setTimeout(()=>location.reload(),500)}}).subscribe();
})();
