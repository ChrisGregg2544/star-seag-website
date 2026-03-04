import { useState, useEffect, useRef } from "react";

const GOLD = "#C9A84C";
const NAVY = "#0B1F3A";
const GOLD_LIGHT = "#E8C97A";

function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

function AnimatedNumber({ target, suffix = "" }) {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView();
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(target / 50);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 28);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const StarIcon = ({ size = 20, filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? GOLD : "none"} stroke={GOLD} strokeWidth="1.5">
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  </svg>
);

const CheckIcon = ({ size = 16, color = GOLD }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const BoltIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8ab4ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
  </svg>
);

const TrophyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
    <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
    <path d="M4 2h16v7a8 8 0 0 1-16 0V2z" />
    <line x1="12" y1="17" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9,12 11,14 15,10" strokeWidth="2" />
  </svg>
);

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" />
  </svg>
);

function SkillBar({ label, pct, color, animate }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: "'Lato',sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.78)" }}>{label}</span>
        <span style={{ fontFamily: "'Lato',sans-serif", fontSize: "0.76rem", color: GOLD, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 6, overflow: "hidden" }}>
        <div style={{
          width: animate ? `${pct}%` : "0%", height: "100%", borderRadius: 99,
          background: `linear-gradient(90deg, ${color || GOLD}, ${GOLD_LIGHT})`,
          transition: "width 1.3s ease 0.2s",
        }} />
      </div>
    </div>
  );
}

function FocusChip({ label, urgency }) {
  const c = {
    high: { bg: "rgba(220,60,60,0.14)", border: "rgba(220,60,60,0.38)", dot: "#ff7070", text: "#ff9090" },
    med:  { bg: "rgba(201,168,76,0.11)", border: "rgba(201,168,76,0.32)", dot: GOLD,    text: GOLD_LIGHT },
    low:  { bg: "rgba(60,180,100,0.11)", border: "rgba(60,180,100,0.32)", dot: "#6ee098", text: "#6ee098" },
  }[urgency] || {};
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 6, padding: "4px 11px", margin: "3px",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, flexShrink: 0, display: "inline-block" }} />
      <span style={{ fontFamily: "'Lato',sans-serif", fontSize: "0.75rem", color: c.text, fontWeight: 700 }}>{label}</span>
    </span>
  );
}

export default function StarLanding() {
  const [scrollY, setScrollY] = useState(0);
  const [heroRef, heroInView] = useInView(0.05);
  const [tracksRef, tracksInView] = useInView(0.05);
  const [dashRef, dashInView] = useInView(0.05);
  const [accRef, accInView] = useInView(0.1);
  const [statsRef, statsInView] = useInView(0.1);
  const [ctaRef, ctaInView] = useInView(0.1);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div style={{ fontFamily: "Georgia,serif", background: NAVY, color: "#fff", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400;1,700&family=Lato:wght@300;400;700;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        .fd{font-family:'Playfair Display',Georgia,serif}
        .fb{font-family:'Lato',sans-serif}
        .gt{color:${GOLD}}
        .pill{background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.28);border-radius:999px;color:${GOLD};font-family:'Lato',sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:5px 16px;display:inline-block}
        .pill-b{background:rgba(100,160,255,0.1);border:1px solid rgba(100,160,255,0.28);border-radius:999px;color:#8ab4ff;font-family:'Lato',sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;padding:5px 15px;display:inline-block}
        .divc{width:48px;height:2px;background:linear-gradient(90deg,transparent,${GOLD},transparent);margin:16px auto 0}
        .gold-line{height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.28),transparent)}
        .card{background:linear-gradient(155deg,rgba(255,255,255,.055) 0%,rgba(255,255,255,.018) 100%);border:1px solid rgba(201,168,76,.18);border-radius:16px;transition:transform .3s,border-color .3s,box-shadow .3s}
        .card:hover{transform:translateY(-5px);border-color:rgba(201,168,76,.45);box-shadow:0 16px 48px rgba(201,168,76,.1)}
        .tc6{background:linear-gradient(155deg,rgba(60,120,220,.07) 0%,rgba(255,255,255,.025) 100%);border:1px solid rgba(100,160,255,.22);border-radius:20px;transition:transform .3s,border-color .3s,box-shadow .3s}
        .tc6:hover{transform:translateY(-6px);border-color:rgba(100,160,255,.48);box-shadow:0 20px 52px rgba(60,120,220,.12)}
        .tc7{background:linear-gradient(155deg,rgba(201,168,76,.08) 0%,rgba(255,255,255,.025) 100%);border:1px solid rgba(201,168,76,.32);border-radius:20px;transition:transform .3s,border-color .3s,box-shadow .3s}
        .tc7:hover{transform:translateY(-6px);border-color:rgba(201,168,76,.6);box-shadow:0 20px 52px rgba(201,168,76,.14)}
        .cta-btn{background:linear-gradient(135deg,${GOLD} 0%,${GOLD_LIGHT} 50%,${GOLD} 100%);background-size:200% auto;color:${NAVY};font-family:'Lato',sans-serif;font-weight:900;letter-spacing:.1em;text-transform:uppercase;border:none;cursor:pointer;transition:background-position .4s,transform .2s,box-shadow .2s;box-shadow:0 4px 24px rgba(201,168,76,.4)}
        .cta-btn:hover{background-position:right center;transform:translateY(-2px);box-shadow:0 10px 40px rgba(201,168,76,.6)}
        .nav-link{font-family:'Lato',sans-serif;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.62);text-decoration:none;transition:color .2s;cursor:pointer}
        .nav-link:hover{color:${GOLD}}
        .fu{opacity:0;transform:translateY(28px);transition:opacity .65s ease,transform .65s ease}
        .fu.vis{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.05s}.d2{transition-delay:.15s}.d3{transition-delay:.25s}.d4{transition-delay:.35s}.d5{transition-delay:.45s}.d6{transition-delay:.55s}
        .frow{display:flex;align-items:flex-start;gap:13px;margin-bottom:20px}
        .fi6{width:34px;height:34px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(100,160,255,.1);border:1px solid rgba(100,160,255,.2)}
        .fi7{width:34px;height:34px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2)}
        .dash-panel{background:linear-gradient(155deg,rgba(255,255,255,.055) 0%,rgba(255,255,255,.018) 100%);border:1px solid rgba(201,168,76,.18);border-radius:15px;padding:26px 26px 22px}
        @keyframes tw0{from{opacity:.05}to{opacity:.22}}
        @keyframes tw1{from{opacity:.07}to{opacity:.18}}
        @keyframes tw2{from{opacity:.04}to{opacity:.26}}
        @keyframes pulseStar{from{opacity:.7;transform:scale(.95)}to{opacity:1;transform:scale(1.05)}}
        .pstar{animation:pulseStar 2.2s ease-in-out infinite alternate}
        @media(max-width:900px){
          .tgrid{grid-template-columns:1fr!important}
          .twoc{grid-template-columns:1fr!important}
          .dgrid{grid-template-columns:1fr!important}
          .htitle{font-size:2.2rem!important}
          .stitle{font-size:1.9rem!important}
        }
        @media(max-width:600px){
          .thrc{grid-template-columns:1fr 1fr!important}
          .htitle{font-size:1.85rem!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"0 32px",
        background: scrollY>60 ? "rgba(11,31,58,0.97)" : "transparent",
        backdropFilter: scrollY>60 ? "blur(14px)" : "none",
        borderBottom: scrollY>60 ? "1px solid rgba(201,168,76,0.1)" : "none",
        transition:"all .4s ease",
      }}>
        <div style={{maxWidth:1140,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:68}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span className="pstar"><StarIcon size={18} filled /></span>
            <span className="fd gt" style={{fontSize:"1.3rem",fontWeight:700,letterSpacing:".04em"}}>STAR</span>
            <span className="fb" style={{fontSize:".66rem",color:"rgba(255,255,255,.3)",letterSpacing:".18em",textTransform:"uppercase",marginLeft:2}}>AI Tutor</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:28}}>
            {["Tracks","Dashboard","Accuracy"].map(l=>(
              <span key={l} className="nav-link">{l}</span>
            ))}
            <button className="cta-btn" style={{padding:"9px 22px",borderRadius:7,fontSize:".7rem"}}>Start Free Trial</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{position:"relative",minHeight:"100vh",display:"flex",alignItems:"center",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
          <div style={{position:"absolute",top:"40%",left:"50%",transform:"translate(-50%,-50%)",width:680,height:680,background:"radial-gradient(circle,rgba(201,168,76,.05) 0%,transparent 68%)",borderRadius:"50%"}} />
          {[[9,11,3,0],[22,28,2,1],[7,62,4,2],[14,82,2,0],[88,15,3,1],[92,38,5,2],[82,70,2,0],[90,88,3,1],[48,22,2,2],[55,75,3,0]].map(([l,t,s,a],i)=>(
            <div key={i} style={{position:"absolute",left:`${l}%`,top:`${t}%`,width:s,height:s,borderRadius:"50%",background:GOLD,opacity:.12,animation:`tw${a} ${3.5+i*.3}s ease-in-out infinite alternate`}} />
          ))}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:180,background:`linear-gradient(0deg,${NAVY} 0%,transparent 100%)`}} />
        </div>
        <div ref={heroRef} style={{maxWidth:1140,margin:"0 auto",padding:"130px 32px 90px",position:"relative",zIndex:2,width:"100%"}}>
          <div style={{maxWidth:720}}>
            <div className={`fu d1 ${heroInView?"vis":""}`}><span className="pill">Northern Ireland's Premier SEAG Preparation</span></div>
            <h1 className={`fd htitle fu d2 ${heroInView?"vis":""}`} style={{fontSize:"3.7rem",lineHeight:1.1,fontWeight:900,marginTop:28,marginBottom:10}}>
              The AI Tutor That<br/><span style={{color:GOLD,fontStyle:"italic"}}>Grows With</span><br/>Your Child.
            </h1>
            <p className={`fb fu d3 ${heroInView?"vis":""}`} style={{fontSize:"1.08rem",lineHeight:1.82,color:"rgba(255,255,255,.6)",maxWidth:560,marginTop:18,marginBottom:42}}>
              Personalised SEAG Preparation from P6 Foundations to P7 Exam Mastery.
            </p>
            <div className={`fu d4 ${heroInView?"vis":""}`} style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
              <button className="cta-btn" style={{padding:"17px 44px",borderRadius:9,fontSize:".93rem"}}>Start Free Trial</button>
              <span className="fb" style={{fontSize:".78rem",color:"rgba(255,255,255,.36)",letterSpacing:".04em"}}>No card required · Cancel anytime</span>
            </div>
            <div className={`fu d5 ${heroInView?"vis":""}`} style={{marginTop:50,display:"flex",gap:7,alignItems:"center"}}>
              {[...Array(5)].map((_,i)=><StarIcon key={i} size={14} filled />)}
              <span className="fb" style={{fontSize:".78rem",color:"rgba(255,255,255,.4)",marginLeft:8}}>Trusted by P6 &amp; P7 families across Northern Ireland</span>
            </div>
          </div>
        </div>
      </section>

      <div className="gold-line" />

      {/* STATS */}
      <section ref={statsRef} style={{padding:"60px 32px"}}>
        <div style={{maxWidth:1140,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18}} className="thrc">
            {[
              {n:56,s:"",label:"Questions per Mock",sub:"Full SEAG format"},
              {n:10,s:"",label:"Questions per Sprint",sub:"P6 Foundation Track"},
              {n:100,s:"%",label:"Verified Accuracy",sub:"Every sum solved first"},
              {n:2,s:"",label:"Adaptive Tracks",sub:"The Builder & Executor"},
            ].map((s,i)=>(
              <div key={i} className="card" style={{padding:"24px 20px",textAlign:"center"}}>
                <div className="fd gt" style={{fontSize:"2.5rem",fontWeight:700}}>
                  {statsInView ? <AnimatedNumber target={s.n} suffix={s.s} /> : `0${s.s}`}
                </div>
                <div className="fb" style={{fontSize:".86rem",fontWeight:700,color:"rgba(255,255,255,.88)",marginTop:6,marginBottom:3}}>{s.label}</div>
                <div className="fb" style={{fontSize:".73rem",color:"rgba(255,255,255,.36)",letterSpacing:".04em"}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gold-line" />

      {/* TWO TRACKS */}
      <section ref={tracksRef} style={{padding:"100px 32px"}}>
        <div style={{maxWidth:1140,margin:"0 auto"}}>
          <div className={`fu d1 ${tracksInView?"vis":""}`} style={{textAlign:"center",marginBottom:70}}>
            <span className="pill">Two Tracks. One Goal.</span>
            <h2 className="fd stitle" style={{fontSize:"2.5rem",fontWeight:700,marginTop:22,marginBottom:14,lineHeight:1.15}}>
              Built for Every Stage<br/>of the SEAG Journey
            </h2>
            <div className="divc" />
            <p className="fb" style={{color:"rgba(255,255,255,.5)",fontSize:".95rem",marginTop:22,maxWidth:510,margin:"22px auto 0"}}>
              Whether your child is laying foundations in P6 or executing under pressure in P7, STAR meets them exactly where they are.
            </p>
          </div>

          <div className="tgrid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28}}>

            {/* P6 BUILDER */}
            <div className={`tc6 fu d2 ${tracksInView?"vis":""}`} style={{padding:"46px 42px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-50,right:-50,width:200,height:200,background:"radial-gradient(circle,rgba(100,160,255,.06) 0%,transparent 70%)",borderRadius:"50%",pointerEvents:"none"}} />
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <div style={{width:48,height:48,borderRadius:12,background:"rgba(100,160,255,.12)",border:"1px solid rgba(100,160,255,.24)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <BoltIcon />
                </div>
                <span className="pill-b">P6 Foundation Track</span>
              </div>
              <h3 className="fd" style={{fontSize:"1.7rem",fontWeight:700,marginTop:16,marginBottom:8,lineHeight:1.2}}>The Builder</h3>
              <p className="fb" style={{fontSize:".9rem",color:"rgba(255,255,255,.52)",lineHeight:1.78,marginBottom:30}}>
                Confidence-first learning that closes knowledge gaps before the big year begins — with no overwhelm and no wasted sessions.
              </p>

              <div className="frow">
                <div className="fi6">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ab4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                </div>
                <div>
                  <div className="fb" style={{fontWeight:700,fontSize:".9rem",marginBottom:4}}>10-Question Mini-Sprints</div>
                  <div className="fb" style={{fontSize:".82rem",color:"rgba(255,255,255,.5)",lineHeight:1.68}}>Perfect for building daily habits without the stress of a full paper. Short, focused, and habit-forming.</div>
                </div>
              </div>

              <div className="frow">
                <div className="fi6">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ab4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <div>
                  <div className="fb" style={{fontWeight:700,fontSize:".9rem",marginBottom:4}}>Instant Visual Learning</div>
                  <div className="fb" style={{fontSize:".82rem",color:"rgba(255,255,255,.5)",lineHeight:1.68}}>
                    Every mistake is met with a <span style={{color:"#8ab4ff",fontStyle:"italic"}}>"Detective Hint"</span> and a direct video tutorial link from CorbettMaths or BBC Bitesize.
                  </div>
                </div>
              </div>

              <div className="frow" style={{marginBottom:0}}>
                <div className="fi6">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ab4ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                </div>
                <div>
                  <div className="fb" style={{fontWeight:700,fontSize:".9rem",marginBottom:4}}>Confidence First</div>
                  <div className="fb" style={{fontSize:".82rem",color:"rgba(255,255,255,.5)",lineHeight:1.68}}>We focus on the core KS2 NI curriculum to ensure no gaps in knowledge before the big year begins.</div>
                </div>
              </div>

              <div style={{marginTop:34,paddingTop:26,borderTop:"1px solid rgba(100,160,255,.14)"}}>
                <div className="fb" style={{fontSize:".7rem",color:"rgba(255,255,255,.3)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:5}}>Ideal for</div>
                <div className="fb" style={{fontSize:".86rem",color:"#8ab4ff",fontWeight:700}}>P6 students beginning their SEAG journey</div>
              </div>
            </div>

            {/* P7 EXECUTOR */}
            <div className={`tc7 fu d3 ${tracksInView?"vis":""}`} style={{padding:"46px 42px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:20,right:20,background:`linear-gradient(135deg,${GOLD},${GOLD_LIGHT})`,color:NAVY,fontFamily:"'Lato',sans-serif",fontSize:".64rem",fontWeight:900,letterSpacing:".1em",textTransform:"uppercase",padding:"4px 11px",borderRadius:5}}>
                Most Popular
              </div>
              <div style={{position:"absolute",top:-50,right:-50,width:220,height:220,background:"radial-gradient(circle,rgba(201,168,76,.08) 0%,transparent 70%)",borderRadius:"50%",pointerEvents:"none"}} />
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <div style={{width:48,height:48,borderRadius:12,background:"rgba(201,168,76,.13)",border:"1px solid rgba(201,168,76,.28)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <TrophyIcon />
                </div>
                <span className="pill">P7 Exam Track</span>
              </div>
              <h3 className="fd" style={{fontSize:"1.7rem",fontWeight:700,marginTop:16,marginBottom:8,lineHeight:1.2}}>The Executor</h3>
              <p className="fb" style={{fontSize:".9rem",color:"rgba(255,255,255,.52)",lineHeight:1.78,marginBottom:30}}>
                Full-scale exam simulation that builds the stamina, composure, and analytical edge needed when the real day arrives.
              </p>

              <div className="frow">
                <div className="fi7">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </div>
                <div>
                  <div className="fb" style={{fontWeight:700,fontSize:".9rem",marginBottom:4}}>Full-Length Mocks</div>
                  <div className="fb" style={{fontSize:".82rem",color:"rgba(255,255,255,.5)",lineHeight:1.68}}>Authentic 56-question practice papers that mirror the real SEAG format — no shortcuts, no guesswork.</div>
                </div>
              </div>

              <div className="frow">
                <div className="fi7">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
                </div>
                <div>
                  <div className="fb" style={{fontWeight:700,fontSize:".9rem",marginBottom:4}}>Stamina Training</div>
                  <div className="fb" style={{fontSize:".82rem",color:"rgba(255,255,255,.5)",lineHeight:1.68}}>Practice the transition from English Multiple Choice to Maths Free Response — exactly as it happens on exam day.</div>
                </div>
              </div>

              <div className="frow" style={{marginBottom:0}}>
                <div className="fi7"><ChartIcon /></div>
                <div>
                  <div className="fb" style={{fontWeight:700,fontSize:".9rem",marginBottom:4}}>Advanced Analytics</div>
                  <div className="fb" style={{fontSize:".82rem",color:"rgba(255,255,255,.5)",lineHeight:1.68}}>
                    Receive a <span style={{color:GOLD,fontStyle:"italic"}}>"Results Dashboard"</span> after every mock to identify exactly where to focus your final weeks of revision.
                  </div>
                </div>
              </div>

              <div style={{marginTop:34,paddingTop:26,borderTop:"1px solid rgba(201,168,76,.14)"}}>
                <div className="fb" style={{fontSize:".7rem",color:"rgba(255,255,255,.3)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:5}}>Ideal for</div>
                <div className="fb" style={{fontSize:".86rem",color:GOLD,fontWeight:700}}>P7 students preparing for the SEAG examination</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="gold-line" />

      {/* PARENT DASHBOARD */}
      <section ref={dashRef} style={{padding:"100px 32px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(ellipse at 50% 55%,rgba(201,168,76,.04) 0%,transparent 64%)"}} />
        <div style={{maxWidth:1140,margin:"0 auto",position:"relative"}}>

          <div className={`fu d1 ${dashInView?"vis":""}`} style={{textAlign:"center",marginBottom:68}}>
            <span className="pill">For Parents</span>
            <h2 className="fd stitle" style={{fontSize:"2.5rem",fontWeight:700,marginTop:22,marginBottom:14,lineHeight:1.15}}>
              The Parent Dashboard
            </h2>
            <div className="divc" />
            <p className="fb" style={{color:"rgba(255,255,255,.5)",fontSize:".95rem",marginTop:22,maxWidth:540,margin:"22px auto 0"}}>
              You shouldn't have to guess how your child is progressing. STAR gives you a clear, honest picture — at a glance, any time.
            </p>
          </div>

          {/* Dashboard panels */}
          <div className="dgrid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:26,marginBottom:26}}>

            {/* Star Skills panel */}
            <div className={`fu d2 ${dashInView?"vis":""}`}>
              <div className="dash-panel" style={{marginBottom:22}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:20}}>
                  <span className="pstar"><StarIcon size={17} filled /></span>
                  <span className="fd" style={{fontSize:"1.05rem",fontWeight:700}}>Star Skills</span>
                  <span className="fb" style={{fontSize:".68rem",color:"rgba(255,255,255,.32)",marginLeft:"auto",letterSpacing:".1em",textTransform:"uppercase"}}>Week 6</span>
                </div>
                <p className="fb" style={{fontSize:".82rem",color:"rgba(255,255,255,.5)",lineHeight:1.72,marginBottom:20}}>
                  <span style={{color:GOLD,fontWeight:700}}>Star Skills</span> track the topics where your child is genuinely excelling — proven strengths ready to shine on exam day.
                </p>
                <SkillBar label="Fractions & Decimals" pct={88} color={GOLD} animate={dashInView} />
                <SkillBar label="Word Problems" pct={82} color={GOLD} animate={dashInView} />
                <SkillBar label="Data Handling" pct={91} color={GOLD} animate={dashInView} />
                <SkillBar label="Algebra & Patterns" pct={74} color={GOLD_LIGHT} animate={dashInView} />
                <SkillBar label="Time & Measurement" pct={67} color={GOLD_LIGHT} animate={dashInView} />
                <div style={{marginTop:16,padding:"11px 15px",background:"rgba(201,168,76,.07)",borderRadius:8,border:"1px solid rgba(201,168,76,.15)"}}>
                  <span className="fb" style={{fontSize:".78rem",color:"rgba(255,255,255,.48)"}}>Overall Star Rating: &nbsp;</span>
                  <span className="fb" style={{fontSize:".84rem",fontWeight:700,color:GOLD}}>4.2 / 5.0 ⭐</span>
                </div>
              </div>
              <div className="dash-panel" style={{display:"flex",gap:13,alignItems:"flex-start"}}>
                <div style={{flexShrink:0,marginTop:1}}><EyeIcon /></div>
                <div>
                  <div className="fb" style={{fontWeight:700,fontSize:".88rem",marginBottom:5}}>Full Visibility, Always</div>
                  <div className="fb" style={{fontSize:".8rem",color:"rgba(255,255,255,.48)",lineHeight:1.72}}>STAR automatically compiles session data into a parent-facing summary. No jargon. No digging. Just the information you need to support your child.</div>
                </div>
              </div>
            </div>

            {/* Focus Areas panel */}
            <div className={`fu d3 ${dashInView?"vis":""}`}>
              <div className="dash-panel" style={{marginBottom:22}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:20}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                  <span className="fd" style={{fontSize:"1.05rem",fontWeight:700}}>Focus Areas</span>
                  <span className="fb" style={{fontSize:".68rem",color:"rgba(255,255,255,.32)",marginLeft:"auto",letterSpacing:".1em",textTransform:"uppercase"}}>This Week</span>
                </div>
                <p className="fb" style={{fontSize:".82rem",color:"rgba(255,255,255,.5)",lineHeight:1.72,marginBottom:20}}>
                  <span style={{color:"#ff7070",fontWeight:700}}>Focus Areas</span> are the specific topics STAR has identified as needing attention. Prioritised by urgency so revision time is never wasted.
                </p>
                <div style={{marginBottom:16}}>
                  <div className="fb" style={{fontSize:".68rem",color:"rgba(255,255,255,.32)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}>High Priority</div>
                  <FocusChip label="Long Division" urgency="high" />
                  <FocusChip label="Percentage Problems" urgency="high" />
                </div>
                <div style={{marginBottom:16}}>
                  <div className="fb" style={{fontSize:".68rem",color:"rgba(255,255,255,.32)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}>Needs Attention</div>
                  <FocusChip label="Area & Perimeter" urgency="med" />
                  <FocusChip label="Ratio & Proportion" urgency="med" />
                  <FocusChip label="Volume" urgency="med" />
                </div>
                <div>
                  <div className="fb" style={{fontSize:".68rem",color:"rgba(255,255,255,.32)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}>On Track</div>
                  <FocusChip label="Number Sequences" urgency="low" />
                  <FocusChip label="Symmetry" urgency="low" />
                </div>
              </div>
              <div className="dash-panel" style={{display:"flex",gap:13,alignItems:"flex-start"}}>
                <div style={{flexShrink:0,marginTop:1}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                </div>
                <div>
                  <div className="fb" style={{fontWeight:700,fontSize:".88rem",marginBottom:5}}>Adaptive Week by Week</div>
                  <div className="fb" style={{fontSize:".8rem",color:"rgba(255,255,255,.48)",lineHeight:1.72}}>Focus Areas update automatically after every session. As your child improves, their priorities shift — ensuring every practice minute is targeted and purposeful.</div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 supporting cards */}
          <div className={`thrc fu d4 ${dashInView?"vis":""}`} style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
            {[
              {icon:<ChartIcon />, title:"Weekly Progress Reports", body:"A clean summary of sessions completed, questions attempted, and accuracy trends — delivered directly to you."},
              {icon:<ShieldIcon />, title:"Accuracy Tracking", body:"See exactly how your child's accuracy is trending topic by topic, so you always know if they're truly ready."},
              {icon:<ClockIcon />, title:"Session History", body:"A full log of every sprint and mock completed, with timestamps — so you can see effort, not just scores."},
            ].map((f,i)=>(
              <div key={i} className="card" style={{padding:"24px 22px"}}>
                <div style={{marginBottom:11}}>{f.icon}</div>
                <div className="fb" style={{fontWeight:700,fontSize:".87rem",marginBottom:7}}>{f.title}</div>
                <div className="fb" style={{fontSize:".8rem",color:"rgba(255,255,255,.46)",lineHeight:1.7}}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gold-line" />

      {/* ACCURACY MANDATE */}
      <section ref={accRef} style={{padding:"100px 32px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(ellipse at 50% 50%,rgba(201,168,76,.04) 0%,transparent 62%)"}} />
        <div style={{maxWidth:1000,margin:"0 auto",position:"relative"}}>
          <div className={`fu d1 ${accInView?"vis":""}`} style={{textAlign:"center",marginBottom:60}}>
            <span className="pill">The Accuracy Mandate</span>
            <h2 className="fd stitle" style={{fontSize:"2.5rem",fontWeight:700,marginTop:22,marginBottom:16,lineHeight:1.15}}>
              Ironclad Accuracy.<br/><span style={{color:GOLD,fontStyle:"italic"}}>No Exceptions.</span>
            </h2>
            <div className="divc" />
          </div>

          <div className="twoc" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:38,alignItems:"start"}}>
            <div className={`fu d2 ${accInView?"vis":""}`}>
              <div style={{border:"1px solid rgba(201,168,76,.28)",borderRadius:18,padding:"40px 36px",background:"linear-gradient(160deg,rgba(201,168,76,.06) 0%,transparent 100%)"}}>
                <div style={{fontSize:"3.2rem",marginBottom:16}}>🔐</div>
                <h3 className="fd" style={{fontSize:"1.42rem",fontWeight:700,marginBottom:15,color:GOLD,lineHeight:1.25}}>
                  We Solve Every Sum Before Your Child Sees It
                </h3>
                <p className="fb" style={{color:"rgba(255,255,255,.6)",lineHeight:1.82,fontSize:".9rem"}}>
                  Our AI solves every single maths problem and double-checks every grammar rule internally — before the question ever reaches the student. If the answer isn't provably correct, the question doesn't appear.
                </p>
              </div>
            </div>

            <div className={`fu d3 ${accInView?"vis":""}`}>
              {[
                {title:"Zero-Error Logic", body:"Our AI solves every single maths problem and double-checks every grammar rule internally before the student ever sees it."},
                {title:"Human-Verified Standards", body:"Every question is original and generated specifically to meet the official SEAG specification — not recycled from generic question banks."},
                {title:"Explained, Not Just Marked", body:"Students see a clear step-by-step solution for every answer — right or wrong — so real learning happens every session."},
                {title:"Zero Tolerance Policy", body:"A wrong answer in a tutor app erodes trust. That's why our accuracy commitment is absolute, not aspirational."},
              ].map((item,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:13,padding:"18px 0",borderBottom:i<3?"1px solid rgba(201,168,76,.1)":"none"}}>
                  <div style={{width:30,height:30,borderRadius:7,flexShrink:0,background:"rgba(201,168,76,.1)",border:"1px solid rgba(201,168,76,.2)",display:"flex",alignItems:"center",justifyContent:"center",marginTop:2}}>
                    <CheckIcon size={14} />
                  </div>
                  <div>
                    <div className="fb" style={{fontWeight:700,fontSize:".9rem",marginBottom:4}}>{item.title}</div>
                    <div className="fb" style={{fontSize:".82rem",color:"rgba(255,255,255,.47)",lineHeight:1.7}}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="gold-line" />

      {/* TESTIMONIALS */}
      <section style={{padding:"80px 32px"}}>
        <div style={{maxWidth:1140,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:46}}><span className="pill">What Parents Are Saying</span></div>
          <div className="thrc" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
            {[
              {quote:"My daughter looks forward to her STAR sessions now. The Detective Hints make mistakes feel like a puzzle, not a failure.", name:"Sarah M.", loc:"Belfast"},
              {quote:"The Parent Dashboard is brilliant. I finally know exactly which topics to focus on, not just a vague sense that 'maths needs work'.", name:"Declan O.", loc:"Derry / Londonderry"},
              {quote:"My son sat the real SEAG feeling properly prepared for the first time. The full-length mocks made all the difference to his stamina.", name:"Claire B.", loc:"Ballymena"},
            ].map((t,i)=>(
              <div key={i} className="card" style={{padding:"28px 24px"}}>
                <div style={{display:"flex",gap:3,marginBottom:14}}>{[...Array(5)].map((_,j)=><StarIcon key={j} size={13} filled />)}</div>
                <p className="fb" style={{fontSize:".86rem",color:"rgba(255,255,255,.64)",lineHeight:1.8,marginBottom:20,fontStyle:"italic"}}>"{t.quote}"</p>
                <div className="fb" style={{fontWeight:700,fontSize:".86rem"}}>{t.name}</div>
                <div className="fb" style={{fontSize:".74rem",color:"rgba(255,255,255,.34)",letterSpacing:".05em"}}>{t.loc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gold-line" />

      {/* FINAL CTA */}
      <section ref={ctaRef} style={{padding:"120px 32px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(ellipse at 50% 100%,rgba(201,168,76,.07) 0%,transparent 58%)"}} />
        <div className={`fu d1 ${ctaInView?"vis":""}`} style={{maxWidth:640,margin:"0 auto",textAlign:"center",position:"relative"}}>
          <span className="pill">Begin Today</span>
          <h2 className="fd stitle" style={{fontSize:"2.8rem",fontWeight:900,marginTop:26,marginBottom:22,lineHeight:1.12}}>
            Give Your Child the<br/><span style={{color:GOLD,fontStyle:"italic"}}>Best Possible Start.</span>
          </h2>
          <p className="fb" style={{color:"rgba(255,255,255,.5)",fontSize:"1rem",lineHeight:1.8,marginBottom:50}}>
            Join families across Northern Ireland who have chosen a smarter, more confident path to SEAG success. Start your free trial today — no commitment required.
          </p>
          <button className="cta-btn" style={{padding:"20px 58px",borderRadius:10,fontSize:"1rem"}}>Start Free Trial</button>
          <div className="fb" style={{marginTop:18,fontSize:".76rem",color:"rgba(255,255,255,.26)",letterSpacing:".05em"}}>Free for 7 days · No credit card · Cancel anytime</div>
          <div style={{display:"flex",justifyContent:"center",gap:26,marginTop:44,flexWrap:"wrap"}}>
            {["SEAG Aligned","Parent Dashboard","100% Verified","Detective Hints"].map(t=>(
              <div key={t} className="fb" style={{display:"flex",alignItems:"center",gap:5,fontSize:".76rem",color:"rgba(255,255,255,.38)"}}>
                <CheckIcon size={13} /> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{borderTop:"1px solid rgba(201,168,76,.1)",padding:"36px 32px"}}>
        <div style={{maxWidth:1140,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <StarIcon size={15} filled />
            <span className="fd gt" style={{fontSize:"1.1rem",fontWeight:700}}>STAR</span>
            <span className="fb" style={{fontSize:".65rem",color:"rgba(255,255,255,.26)",letterSpacing:".16em",textTransform:"uppercase"}}>AI Tutor</span>
          </div>
          <div className="fb" style={{fontSize:".73rem",color:"rgba(255,255,255,.2)",letterSpacing:".04em"}}>
            © 2025 STAR AI Tutor · Northern Ireland · SEAG Transfer Preparation
          </div>
          <div style={{display:"flex",gap:20}}>
            {["Privacy","Terms","Contact"].map(l=>(
              <span key={l} className="nav-link" style={{fontSize:".74rem"}}>{l}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
