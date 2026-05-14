'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import UserMenu from '@/components/auth/UserMenu'
import { createClient } from '@/lib/supabase/client'
import type { UserRole, Product, Recipe } from '@/types/database'
import dynamic from 'next/dynamic'
import { useCart } from '@/hooks/useCart'
import RecipesSection from './RecipesSection'

const ZonesMap = dynamic(() => import('@/components/ZonesMap'), { ssr: false })

const COMMUNES_WITH_DELIVERY = [
  'Cerrillos','El Bosque','Estación Central','Huechuraba','Independencia',
  'La Cisterna','La Florida','La Granja','La Reina','Las Condes',
  'Lo Barnechea','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda',
  'Peñalolén','Providencia','Pudahuel','Puente Alto','Quilicura',
  'Recoleta','Renca','San Joaquín','San Miguel','San Ramón',
  'Santiago','Vitacura',
].sort()

const CSS = `
  :root {
    --green-900:#1B2B1E; --green-800:#1F4B35; --green-700:#2D6A4F;
    --green-500:#52B788; --green-400:#74C69D; --green-100:#D8F3DC; --green-50:#EFF8F1;
    --cream:#FBF9F3; --surface:#FFFFFF;
    --gray-50:#F8F9FA; --gray-100:#EEF1ED; --gray-200:#E4E9E5;
    --gray-300:#CDD5CF; --gray-500:#6B7A6F; --gray-700:#3A4A3E;
    --ink:#1B2B1E;
    --warm:#F5872A; --warm-600:#D96B12; --warm-100:#FDE6CC;
    --gold-700:#C4811A; --gold-50:#FBF6E9; --gold-100:#FDF1DC;
    --danger:#C44536;
    --radius-sm:8px; --radius-md:14px; --radius-lg:22px; --radius-xl:28px;
    --shadow-xs: 0 1px 2px rgba(27,43,30,.04);
    --shadow-sm: 0 2px 8px rgba(27,43,30,.05), 0 1px 3px rgba(27,43,30,.04);
    --shadow-md: 0 8px 24px rgba(27,43,30,.08), 0 2px 6px rgba(27,43,30,.04);
    --shadow-lg: 0 16px 40px rgba(27,43,30,.10);
    --nav-h: 72px;
    --yellow:#FACC15; --yellow-hover:#EAB308;
    --lime-50:#F7FEE7; --green-grad-50:#F0FDF4;
    --wa:#25D366; --wa-700:#128C7E;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    color: var(--ink);
    background: var(--cream);
    -webkit-font-smoothing: antialiased;
  }
  h1,h2,h3,h4 { font-family: 'Fraunces', Georgia, serif; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; margin: 0; color: var(--green-900); }
  p { margin: 0; }
  a { color: inherit; text-decoration: none; }
  img { max-width: 100%; display: block; }
  button { font-family: inherit; cursor: pointer; border: 0; }
  .num { font-variant-numeric: tabular-nums; }

  /* TOP BAR */
  .topbar { background: var(--green-900); color: #fff; }
  .topbar .inner { max-width: 1280px; margin: 0 auto; padding: 8px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .topbar .tagline { font-family: var(--font-dancing), cursive; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.01em; line-height: 1.3; }
  .topbar .links { display: flex; gap: 24px; color: rgba(255,255,255,.75); font-size: 12px; font-weight: 500; letter-spacing: .02em; }
  .topbar .links a:hover { color: #fff; }

  /* NAV */
  .nav { position: sticky; top: 0; z-index: 50; background: rgba(251,249,243,.92); backdrop-filter: blur(14px); border-bottom: 1px solid var(--gray-200); }
  .nav .inner { max-width: 1280px; margin: 0 auto; height: var(--nav-h); padding: 0 24px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 28px; }
  .logo { display: inline-flex; align-items: center; gap: 10px; font-family: 'Fraunces', serif; font-weight: 700; font-size: 22px; color: var(--green-900); letter-spacing: -0.01em; }
  .logo img { height: 52px; width: auto; display: block; }
  .search-box { position: relative; max-width: 480px; width: 100%; }
  .search-box input { width: 100%; height: 44px; padding: 0 16px 0 44px; border-radius: 100px; border: 1px solid var(--gray-300); background: var(--surface); font-size: 14px; color: var(--ink); transition: all .15s ease; }
  .search-box input:focus { outline: none; border-color: var(--green-500); box-shadow: 0 0 0 3px rgba(82,183,136,.15); }
  .search-box .ico { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--gray-500); pointer-events: none; }
  .nav-right { display: flex; align-items: center; gap: 8px; }
  .nav-btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px; border-radius: 100px; background: transparent; color: var(--green-900); font-size: 14px; font-weight: 500; transition: all .15s ease; border: 0; cursor: pointer; }
  .nav-btn:hover { background: var(--green-50); color: var(--green-700); }
  .nav-btn.cart { background: var(--green-700); color: #fff; padding: 0 18px; font-weight: 600; }
  .nav-btn.cart:hover { background: var(--green-800); }
  .badge { display: inline-grid; place-items: center; min-width: 20px; height: 20px; background: var(--warm); color: #fff; font-size: 11px; font-weight: 700; border-radius: 100px; padding: 0 6px; }

  /* CATEGORY PILLS */
  .cats-nav { border-bottom: 1px solid var(--gray-200); background: var(--surface); }
  .cats-nav .inner { max-width: 1280px; margin: 0 auto; padding: 12px 24px; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
  .cats-nav .inner::-webkit-scrollbar { display: none; }
  .cat-pill { flex-shrink: 0; display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 100px; font-size: 13px; font-weight: 500; color: var(--gray-700); background: var(--gray-50); transition: all .15s ease; border: 0; cursor: pointer; }
  .cat-pill:hover { background: var(--green-50); color: var(--green-700); }
  .cat-pill.active { background: var(--green-900); color: #fff; }

  /* LAYOUT */
  .container { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
  section { padding: 56px 0; }
  .section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
  .section-head h2 { font-size: clamp(28px,3vw,40px); }
  .section-head .view-all { display: inline-flex; align-items: center; gap: 6px; color: var(--green-700); font-weight: 600; font-size: 14px; }
  .section-head .view-all:hover { color: var(--green-900); }
  .section-eye { font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--green-700); margin-bottom: 8px; display: inline-block; }

  /* HERO DUAL */
  .hero { padding: 40px 0 24px; }
  .hero-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .hero-door { position: relative; border-radius: var(--radius-xl); overflow: hidden; padding: 48px 44px; min-height: 460px; display: flex; flex-direction: column; justify-content: space-between; transition: transform .25s ease, box-shadow .25s ease; box-shadow: var(--shadow-sm); }
  .hero-door:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
  .hero-door::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0); background-size: 22px 22px; pointer-events: none; opacity: .04; }
  .hero-door .door-eye { position: relative; font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; padding: 7px 13px; border-radius: 100px; }
  .hero-door .door-emoji { position: relative; font-size: 72px; line-height: 1; margin-top: 22px; }
  .hero-door h2 { position: relative; font-size: clamp(32px, 3.6vw, 46px); line-height: 1; margin-top: 16px; max-width: 12ch; }
  .hero-door h2 em { font-style: italic; font-weight: 500; }
  .hero-door .door-desc { position: relative; margin-top: 14px; max-width: 36ch; font-size: 15px; line-height: 1.5; }
  .hero-door .door-meta { position: relative; margin-top: 22px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; font-weight: 500; }
  .hero-door .door-meta span { display: inline-flex; align-items: center; gap: 10px; }
  .hero-door .door-meta .chk { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; }
  .hero-door .door-cta { position: relative; display: inline-flex; align-items: center; gap: 10px; margin-top: 28px; height: 52px; padding: 0 26px; border-radius: 100px; font-weight: 600; font-size: 15px; align-self: flex-start; transition: all .15s ease; box-shadow: var(--shadow-sm); }
  .hero-door .door-cta:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

  .hero-door.retail { background: radial-gradient(circle at 85% 15%, rgba(116,198,157,.32), transparent 55%), linear-gradient(135deg, #EFF8F1 0%, #D8F3DC 100%); color: var(--green-900); }
  .hero-door.retail .door-eye { background: rgba(45,106,79,.12); color: var(--green-700); }
  .hero-door.retail h2 em { color: var(--green-700); }
  .hero-door.retail .door-desc { color: var(--gray-700); }
  .hero-door.retail .door-meta .chk { background: rgba(45,106,79,.15); color: var(--green-700); }
  .hero-door.retail .door-cta { background: var(--green-700); color: #fff; }
  .hero-door.retail .door-cta:hover { background: var(--green-900); }

  .hero-door.wholesale { background: radial-gradient(circle at 85% 15%, rgba(196,129,26,.22), transparent 55%), linear-gradient(135deg, #FBF6E9 0%, #FDF1DC 100%); color: #5C3E0A; }
  .hero-door.wholesale h2 { color: #5C3E0A; }
  .hero-door.wholesale .door-eye { background: rgba(196,129,26,.14); color: var(--gold-700); }
  .hero-door.wholesale h2 em { color: var(--gold-700); }
  .hero-door.wholesale .door-desc { color: #7A5719; }
  .hero-door.wholesale .door-meta .chk { background: rgba(196,129,26,.18); color: var(--gold-700); }
  .hero-door.wholesale .door-cta { background: var(--gold-700); color: #fff; }
  .hero-door.wholesale .door-cta:hover { background: #9C660E; }

  /* SEARCH STRIP under hero */
  .hero-search-strip { margin-top: 28px; display: flex; gap: 10px; background: #fff; padding: 8px; border-radius: 100px; box-shadow: var(--shadow-md); max-width: 720px; margin-left: auto; margin-right: auto; }
  .hero-search-strip input { flex: 1; height: 48px; padding: 0 20px; border: 0; background: transparent; font-size: 15px; color: var(--ink); outline: none; }
  .hero-search-strip button { height: 48px; padding: 0 26px; background: var(--green-900); color: #fff; border-radius: 100px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; transition: all .15s ease; }
  .hero-search-strip button:hover { background: var(--green-700); }

  /* TRUST STRIP */
  .trust-strip { background: var(--surface); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); padding: 28px 36px; display: grid; grid-template-columns: repeat(4,1fr); gap: 28px; box-shadow: var(--shadow-xs); }
  .trust-item { display: flex; gap: 14px; align-items: flex-start; }
  .trust-item .ico-wrap { flex-shrink: 0; width: 44px; height: 44px; border-radius: 12px; background: var(--green-50); color: var(--green-700); display: grid; place-items: center; }
  .trust-item h4 { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 700; color: var(--green-900); margin-bottom: 4px; }
  .trust-item p { font-size: 13px; color: var(--gray-500); line-height: 1.45; }


  /* SEASON */
  .season-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 18px; }
  .season-card { position: relative; background: var(--surface); border: 1px solid var(--gray-200); border-radius: var(--radius-lg); padding: 16px; transition: all .2s ease; cursor: pointer; }
  .season-card:hover { border-color: var(--green-500); transform: translateY(-4px); box-shadow: var(--shadow-md); }
  .season-card .peak { position: absolute; top: 12px; left: 12px; display: inline-flex; align-items: center; gap: 4px; background: var(--green-500); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 5px 10px; border-radius: 100px; z-index: 2; }
  .season-card .img { position: relative; aspect-ratio: 1; border-radius: var(--radius-md); background: linear-gradient(145deg, var(--green-50), var(--green-100)); display: grid; place-items: center; font-size: 64px; margin-bottom: 14px; overflow: hidden; }
  .season-card .origin { font-size: 11px; color: var(--green-700); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; display: inline-flex; align-items: center; gap: 4px; }
  .season-card .name { font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; color: var(--green-900); line-height: 1.2; margin-bottom: 6px; }
  .season-card .desc { font-size: 12px; color: var(--gray-500); line-height: 1.45; }

  /* PRODUCT CARDS (carousel) */
  .products { display: grid; grid-template-columns: repeat(5,1fr); gap: 18px; }
  .product { position: relative; background: var(--surface); border: 1px solid var(--gray-200); border-radius: var(--radius-lg); padding: 16px; display: flex; flex-direction: column; transition: all .2s ease; }
  .product:hover { border-color: var(--green-500); transform: translateY(-4px); box-shadow: var(--shadow-md); }
  .product .img { position: relative; aspect-ratio: 1; border-radius: var(--radius-md); background: var(--green-50); margin-bottom: 14px; overflow: hidden; display: grid; place-items: center; font-size: 64px; }
  .product .flag { position: absolute; top: 10px; left: 10px; background: var(--green-900); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: 5px 10px; border-radius: 100px; }
  .product .flag.warm { background: var(--warm); }
  .product .flag.fresh { background: var(--green-500); }
  .product .fav { position: absolute; top: 10px; right: 10px; width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.9); color: var(--gray-500); display: grid; place-items: center; transition: all .15s ease; border: 0; cursor: pointer; }
  .product .fav:hover { color: var(--danger); background: #fff; }
  .product .brand { font-size: 11px; color: var(--gray-500); letter-spacing: .06em; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
  .product .name { font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; color: var(--green-900); line-height: 1.2; margin-bottom: 4px; min-height: 2.4em; }
  .product .unit { font-size: 12px; color: var(--gray-500); margin-bottom: 10px; }
  .product-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .product .price { font-family: 'Fraunces', serif; font-weight: 700; font-size: 20px; color: var(--green-900); }
  .product .price small { font-size: 13px; font-weight: 500; color: var(--gray-500); margin-left: 2px; }
  .product .price .old { display: block; font-size: 12px; color: var(--gray-500); text-decoration: line-through; font-weight: 500; }
  .product .add-yellow { width: 100%; height: 40px; border-radius: 10px; background: var(--yellow); color: #422006; font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all .15s ease; border: 0; cursor: pointer; }
  .product .add-yellow:hover { background: var(--yellow-hover); transform: translateY(-1px); }
  .product-foot.col { flex-direction: column; align-items: stretch; gap: 10px; }

  /* AI SECTION */
  .ai-section { background: radial-gradient(circle at 10% 10%,rgba(116,198,157,.18),transparent 45%), linear-gradient(140deg,#0F2A1A,#1F4B35); border-radius: var(--radius-xl); padding: 64px 48px; color: #fff; overflow: hidden; position: relative; }
  .ai-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
  .ai-tag { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; background: rgba(233,162,59,.15); color: var(--warm); border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 24px; }
  .ai-section h2 { color: #fff; font-size: clamp(32px,3.5vw,48px); }
  .ai-section h2 em { font-style: italic; font-weight: 500; color: var(--green-400); }
  .ai-desc { margin-top: 20px; color: rgba(255,255,255,.78); font-size: 16px; max-width: 48ch; }
  .ai-features { margin-top: 28px; display: flex; flex-direction: column; gap: 12px; }
  .ai-feat { display: flex; align-items: flex-start; gap: 12px; font-size: 14px; color: rgba(255,255,255,.88); }
  .ai-feat .chk { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: rgba(116,198,157,.2); color: var(--green-400); display: grid; place-items: center; margin-top: 1px; }

  /* CHAT */
  .chat { background: rgba(255,255,255,.04); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.08); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-lg); }
  .chat-head { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .chat-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,var(--green-400),var(--green-500)); display: grid; place-items: center; color: #fff; position: relative; }
  .chat-avatar::after { content: ""; position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; border-radius: 50%; background: #22C55E; border: 2px solid #0F2A1A; }
  .chat-head .info .n { font-size: 14px; font-weight: 600; color: #fff; }
  .chat-head .info .s { font-size: 11px; color: var(--green-400); }
  .msg { max-width: 80%; padding: 12px 16px; border-radius: 18px; font-size: 14px; line-height: 1.45; }
  .msg.bot { align-self: flex-start; background: rgba(255,255,255,.08); color: rgba(255,255,255,.92); border-bottom-left-radius: 4px; }
  .msg.user { align-self: flex-end; background: var(--green-500); color: #fff; border-bottom-right-radius: 4px; }
  .msg .suggest { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
  .msg .suggest span { background: rgba(116,198,157,.15); color: var(--green-400); padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }
  .typing { display: inline-flex; gap: 4px; padding: 14px 18px; background: rgba(255,255,255,.08); border-radius: 18px; border-bottom-left-radius: 4px; align-self: flex-start; }
  .typing span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.5); animation: typing 1.2s infinite; }
  .typing span:nth-child(2) { animation-delay: .15s; }
  .typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes typing { 0%,60%,100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }

  /* B2B */
  .b2b { background: linear-gradient(135deg, #FBF6E9 0%, #FDF1DC 100%); border: 1px solid rgba(196,129,26,.18); border-radius: var(--radius-xl); padding: 48px; display: grid; grid-template-columns: 1fr auto; gap: 40px; align-items: center; }
  .b2b .lead h2 { font-size: clamp(28px,3vw,36px); color: #5C3E0A; }
  .b2b .lead p { color: #7A5719; margin-top: 12px; max-width: 52ch; font-size: 15px; }
  .b2b-stats { display: flex; gap: 28px; margin-top: 28px; }
  .b2b-stats .stat .n { font-family: 'Fraunces', serif; font-size: 32px; font-weight: 700; color: var(--gold-700); }
  .b2b-stats .stat .l { font-size: 12px; color: #7A5719; text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
  .b2b-cta { display: flex; flex-direction: column; gap: 12px; }
  .btn-primary { display: inline-flex; align-items: center; gap: 10px; justify-content: center; height: 52px; padding: 0 28px; border-radius: 100px; background: var(--gold-700); color: #fff; font-weight: 600; font-size: 15px; transition: all .15s ease; box-shadow: var(--shadow-sm); border: 0; cursor: pointer; text-decoration: none; }
  .btn-primary:hover { background: #9C660E; transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .btn-ghost { display: inline-flex; align-items: center; gap: 10px; justify-content: center; height: 52px; padding: 0 28px; border-radius: 100px; background: transparent; color: var(--gold-700); font-weight: 600; font-size: 15px; border: 1px solid rgba(196,129,26,.4); cursor: pointer; text-decoration: none; }
  .btn-ghost:hover { background: rgba(196,129,26,.08); }

  /* PRODUCERS */
  .producers { display: grid; grid-template-columns: repeat(4,1fr); gap: 18px; }
  .producer { position: relative; border-radius: var(--radius-lg); overflow: hidden; aspect-ratio: 4/5; padding: 24px; display: flex; flex-direction: column; justify-content: space-between; color: #fff; transition: all .25s ease; box-shadow: var(--shadow-sm); }
  .producer:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
  .producer::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,.06) 1px, transparent 0); background-size: 20px 20px; pointer-events: none; }
  .producer.q { background: linear-gradient(160deg, #2D6A4F 0%, #1F4B35 100%); }
  .producer.s { background: linear-gradient(160deg, #52B788 0%, #2D6A4F 100%); }
  .producer.l { background: linear-gradient(160deg, #74C69D 0%, #2D6A4F 100%); }
  .producer.c { background: linear-gradient(160deg, #1F4B35 0%, #0F2A1A 100%); }
  .producer .pin { position: relative; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.85); }
  .producer .producer-emoji { position: relative; font-size: 64px; line-height: 1; }
  .producer h3 { position: relative; color: #fff; font-size: 24px; margin-top: 8px; }
  .producer p { position: relative; font-size: 13px; color: rgba(255,255,255,.78); margin-top: 6px; max-width: 26ch; line-height: 1.4; }

  /* TESTIMONIALS */
  .testis { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
  .testi { background: var(--surface); border: 1px solid var(--gray-200); border-radius: var(--radius-lg); padding: 28px; }
  .testi .stars { color: var(--warm); font-size: 14px; letter-spacing: 2px; margin-bottom: 12px; }
  .testi p { font-size: 15px; line-height: 1.55; color: var(--gray-700); margin-bottom: 20px; }
  .testi-user { display: flex; align-items: center; gap: 12px; }
  .testi-user .av { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg,var(--green-400),var(--green-700)); color: #fff; display: grid; place-items: center; font-weight: 700; }
  .testi-user .n { font-size: 14px; font-weight: 600; color: var(--green-900); }
  .testi-user .m { font-size: 12px; color: var(--gray-500); }

  /* NEWSLETTER / WHATSAPP */
  .newsletter { background: linear-gradient(120deg, var(--wa) 0%, var(--wa-700) 100%); border-radius: var(--radius-xl); padding: 48px; display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: center; color: #fff; position: relative; overflow: hidden; }
  .newsletter::before { content: ""; position: absolute; right: -80px; top: -80px; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,.18), transparent 70%); pointer-events: none; }
  .newsletter .eye { position: relative; font-size: 11px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: rgba(255,255,255,.92); display: inline-flex; align-items: center; gap: 8px; }
  .newsletter h2 { position: relative; color: #fff; font-size: clamp(24px,2.6vw,34px); margin-top: 10px; }
  .newsletter p { position: relative; margin-top: 8px; color: rgba(255,255,255,.92); font-size: 15px; max-width: 52ch; }
  .newsletter-form { position: relative; display: flex; gap: 10px; background: #fff; padding: 8px; border-radius: 100px; min-width: 380px; box-shadow: var(--shadow-md); }
  .newsletter-form input { flex: 1; height: 48px; padding: 0 18px; border: 0; background: transparent; font-size: 15px; color: var(--ink); outline: none; }
  .newsletter-form button { height: 48px; padding: 0 24px; background: var(--green-900); color: #fff; border-radius: 100px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; transition: all .15s ease; }
  .newsletter-form button:hover { background: #000; }
  .newsletter .thanks { position: relative; padding: 14px 22px; background: rgba(255,255,255,.18); border-radius: 100px; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; }

  /* FAQ */
  .faqs { max-width: 760px; margin: 0 auto; }
  .faq { background: var(--surface); border: 1px solid var(--gray-200); border-radius: var(--radius-md); margin-bottom: 12px; overflow: hidden; transition: border-color .2s ease; }
  .faq:hover { border-color: var(--green-500); }
  .faq summary { padding: 20px 24px; font-weight: 600; font-size: 15px; color: var(--green-900); cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::after { content: "+"; font-size: 26px; font-weight: 300; color: var(--green-700); transition: transform .2s ease; line-height: 1; }
  .faq[open] summary::after { transform: rotate(45deg); }
  .faq[open] summary { border-bottom: 1px solid var(--gray-200); }
  .faq .body { padding: 18px 24px 22px; color: var(--gray-700); font-size: 14px; line-height: 1.6; }
  .faq .body a { color: var(--green-700); font-weight: 600; text-decoration: underline; }

  /* FOOTER */
  footer { background: var(--green-900); color: rgba(255,255,255,.7); padding: 64px 0 32px; margin-top: 56px; }
  .foot-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 48px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .foot-brand .logo { color: #fff; margin-bottom: 16px; }
  .foot-brand p { font-size: 14px; max-width: 34ch; margin-bottom: 20px; }
  .foot-brand .socials { display: flex; gap: 10px; }
  .foot-brand .socials a { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,.06); display: grid; place-items: center; color: #fff; transition: all .15s ease; }
  .foot-brand .socials a:hover { background: var(--green-500); }
  .foot-col h5 { color: #fff; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; margin-bottom: 16px; }
  .foot-col a, .foot-col span { display: block; padding: 6px 0; font-size: 14px; color: rgba(255,255,255,.7); }
  .foot-col a:hover { color: #fff; }
  .foot-bottom { padding-top: 28px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-size: 13px; }
  .pays { display: flex; gap: 10px; align-items: center; }
  .pay-chip { padding: 6px 12px; border-radius: 8px; background: rgba(255,255,255,.08); font-size: 11px; font-weight: 600; color: #fff; letter-spacing: .04em; }

  /* MARQUEE */
  @keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
  .marquee { position: relative; height: 48px; overflow: hidden; background: linear-gradient(90deg,var(--green-grad-50),var(--lime-50),var(--green-grad-50)); border-top: 1px solid rgba(22,101,52,.08); border-bottom: 1px solid rgba(22,101,52,.08); }
  .marquee-track { display: flex; width: max-content; align-items: center; height: 100%; animation: marquee-scroll 28s linear infinite; will-change: transform; }
  .marquee:hover .marquee-track { animation-play-state: paused; }
  .marquee-group { display: flex; align-items: center; gap: 4rem; padding-right: 4rem; color: #166534; font-weight: 600; font-size: 14px; letter-spacing: -0.01em; white-space: nowrap; }
  .marquee-group span { display: inline-flex; align-items: center; gap: 8px; }

  /* FADE UP */
  @keyframes fadeUpIn { 0% { opacity: 0; transform: translateY(22px); } 100% { opacity: 1; transform: translateY(0); } }
  .fade-up { animation: fadeUpIn 0.55s ease both; }
  .fade-up-on-view { opacity: 0; transform: translateY(22px); transition: opacity .6s ease, transform .6s ease; will-change: opacity, transform; }
  .fade-up-on-view.is-visible { opacity: 1; transform: none; }

  /* SIDE DRAWER (menú lateral) */
  .menu-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: transparent; color: var(--green-900); transition: all .15s ease; }
  .menu-btn:hover { background: var(--green-50); color: var(--green-700); }
  .drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 100; opacity: 0; pointer-events: none; transition: opacity .25s ease; }
  .drawer-backdrop.open { opacity: 1; pointer-events: auto; }
  .drawer { position: fixed; top: 0; left: 0; bottom: 0; width: 360px; max-width: 92vw; background: #fff; z-index: 101; transform: translateX(-100%); transition: transform .3s cubic-bezier(.22,.61,.36,1); box-shadow: 12px 0 32px rgba(0,0,0,.12); display: flex; flex-direction: column; }
  .drawer.open { transform: translateX(0); }
  .drawer-head { padding: 22px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-200); }
  .drawer-head h3 { font-size: 22px; font-family: 'Fraunces', serif; color: var(--green-900); }
  .drawer-close { width: 36px; height: 36px; border-radius: 50%; background: var(--gray-50); display: grid; place-items: center; color: var(--gray-700); transition: all .15s ease; }
  .drawer-close:hover { background: var(--gray-100); color: var(--green-900); }
  .drawer-list { flex: 1; overflow-y: auto; padding: 10px 0; }
  .drawer-item { display: flex; align-items: center; gap: 14px; padding: 14px 24px; font-size: 15px; font-weight: 500; color: var(--green-900); cursor: pointer; transition: background .15s ease, border-left-color .15s ease; border-left: 3px solid transparent; width: 100%; background: transparent; text-align: left; }
  .drawer-item:hover { background: var(--green-50); border-left-color: var(--green-500); color: var(--green-700); }
  .drawer-item .ico-circle { width: 36px; height: 36px; border-radius: 50%; background: var(--gray-50); display: grid; place-items: center; color: var(--green-700); border: 1px solid var(--gray-200); flex-shrink: 0; }
  .drawer-item:hover .ico-circle { background: #fff; border-color: var(--green-400); }
  .drawer-item .grow { flex: 1; min-width: 0; }
  .drawer-item .new-tag { display: inline-flex; align-items: center; gap: 6px; background: var(--green-100); color: var(--green-700); font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 100px; }
  .drawer-item .new-tag::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--green-500); }
  .drawer-foot { padding: 18px 24px 22px; border-top: 1px solid var(--gray-200); background: var(--gray-50); }
  .drawer-foot .label { font-size: 11px; color: var(--gray-500); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }
  .drawer-foot a { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--green-700); font-weight: 600; padding: 4px 0; }
  .drawer-foot a:hover { color: var(--green-900); }

  .zones-hint-mobile { display: none; }
  .nav-hamburger-m { display: none; }

  /* ZONES SECTION */
  .zones-frame { border-radius: var(--radius-xl); overflow: hidden; box-shadow: 0 20px 56px rgba(27,43,30,.09), 0 4px 16px rgba(27,43,30,.05); height: 500px; position: relative; background: #F0F4F0; }
  .zones-frame .leaflet-container { width: 100%; height: 100%; z-index: 1; }
  .zones-frame .leaflet-control-attribution { font-size: 10px; background: rgba(255,255,255,.6); }
  .zm-popup .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.12); border: 1px solid rgba(27,43,30,.08); }
  .zm-popup .leaflet-popup-tip-container { display: none; }
  .zones-legend { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin-top: 14px; padding: 0 2px; }
  .zl-item { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 500; color: var(--gray-700); }
  .zl-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .zl-sep { flex: 1; }
  .zl-price { font-size: 13px; color: var(--gray-500); }
  .zl-price strong { color: var(--green-700); font-weight: 700; }
  .zones-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--green-700); background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.18); padding: 5px 14px; border-radius: 20px; cursor: pointer; transition: background .15s; }
  .zones-toggle:hover { background: rgba(34,197,94,.15); }
  .zones-commune-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 16px; margin-top: 14px; padding: 16px 20px; background: rgba(34,197,94,.04); border-radius: 14px; border: 1px solid rgba(34,197,94,.12); }
  .zc-item { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--gray-700); font-weight: 500; }

  /* RESPONSIVE */
  @media (max-width: 1024px) {
    .hero-dual { grid-template-columns: 1fr; }
    .trust-strip { grid-template-columns: 1fr 1fr; }
    .zones-frame { height: 460px; }
    .zones-commune-grid { grid-template-columns: repeat(3, 1fr); }
    .ai-grid { grid-template-columns: 1fr; }
    .b2b { grid-template-columns: 1fr; }
    .producers { grid-template-columns: 1fr 1fr; }
    .testis { grid-template-columns: 1fr 1fr; }
    .newsletter { grid-template-columns: 1fr; }
    .newsletter-form { min-width: auto; }
    .foot-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
  }
  @media (max-width: 640px) {
    section { padding: 40px 0; }
    .container { padding: 0 16px; }
    .zones-frame { height: 390px; border-radius: var(--radius-lg); }
    .zones-legend { gap: 12px; }
    .zones-commune-grid { grid-template-columns: repeat(2, 1fr); padding: 14px 16px; }
    .zl-sep { display: none; }
    .nav .inner { display: flex; align-items: center; gap: 8px; padding: 0 16px; }
    .search-box { display: none; }
    .nav-hamburger-m { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; color: var(--green-900); flex-shrink: 0; }
    .menu-btn { display: none; }
    .nav-right { order: 2; margin-left: auto; }
    .logo { order: 3; }
    .hero-door { padding: 32px 24px; min-height: 380px; }
    .trust-strip { grid-template-columns: 1fr; padding: 22px 24px; }
    .ai-section { padding: 40px 24px; }
    .b2b { padding: 28px; }
    .b2b-stats { flex-wrap: wrap; gap: 18px; }
    .producers { grid-template-columns: 1fr; }
    .testis { grid-template-columns: 1fr; }
    .newsletter { padding: 32px 24px; }
    .foot-grid { grid-template-columns: 1fr; gap: 28px; padding-bottom: 28px; }
    .nav-btn span { display: none; }
    .marquee-group { gap: 2.5rem; padding-right: 2.5rem; font-size: 13px; }
    .hero-search-strip { flex-direction: row; padding: 6px; }
    .hero-search-strip button { padding: 0 18px; font-size: 13px; }
    .drawer { width: 88vw; }
    /* — topbar mobile — */
    .topbar .links { display: none; }
    .topbar .inner { justify-content: center; }
    /* — search strip mobile: icon only — */
    .hero-search-strip .btn-txt { display: none; }
    .hero-search-strip button { padding: 0 14px; min-width: 52px; justify-content: center; }
    /* — hero CTA full width — */
    .hero-door .door-cta { align-self: stretch; justify-content: center; }
    /* — cat pills fade indicator — */
    .cats-nav { position: relative; }
    .cats-nav::after { content: ''; position: absolute; right: 0; top: 0; bottom: 1px; width: 52px; background: linear-gradient(to right, transparent, white 85%); pointer-events: none; z-index: 1; }
    /* — zones text mobile — */
    .zones-hint-desktop { display: none; }
    .zones-hint-mobile { display: inline; }
  }
  @media (prefers-reduced-motion: reduce) {
    .marquee-track, .typing span { animation: none !important; }
    .fade-up, .fade-up-on-view { animation: none !important; opacity: 1 !important; transform: none !important; transition: none !important; }
    .drawer { transition: none !important; }
  }

  /* CAROUSEL TABS */
  .carousel-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--gray-200); margin-bottom: 24px; overflow-x: auto; scrollbar-width: none; }
  .carousel-tabs::-webkit-scrollbar { display: none; }
  .carousel-tab { flex-shrink: 0; padding: 12px 22px; font-size: 14px; font-weight: 600; color: var(--gray-500); background: transparent; border: 0; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .15s ease; }
  .carousel-tab.active { color: var(--green-700); border-bottom-color: var(--green-700); }
  .carousel-tab:hover:not(.active) { color: var(--green-900); background: var(--green-50); }

  /* RECIPES SECTION */
  .recipes-section { background: linear-gradient(180deg, var(--green-50) 0%, var(--cream) 100%); border-top: 1px solid var(--green-100); border-bottom: 1px solid var(--green-100); }
  .recipes-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }

  /* recipe card */
  .recipe-card { background: var(--surface); border: 1px solid var(--gray-200); border-radius: var(--radius-lg); padding: 26px; transition: all .25s ease; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow-xs); }
  .recipe-card:hover { border-color: var(--green-400); box-shadow: var(--shadow-md); transform: translateY(-3px); }

  /* card header: emoji box + meta */
  .recipe-head { display: flex; align-items: flex-start; gap: 16px; }
  .recipe-emoji-box { width: 64px; height: 64px; border-radius: var(--radius-md); background: linear-gradient(135deg, var(--green-50) 0%, var(--green-100) 100%); display: grid; place-items: center; font-size: 34px; flex-shrink: 0; border: 1px solid var(--green-100); }
  .recipe-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .recipe-tag { display: inline-flex; align-items: center; background: var(--green-100); color: var(--green-700); font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; padding: 3px 9px; border-radius: 100px; align-self: flex-start; }
  .recipe-title { font-family: 'Fraunces', serif; font-weight: 700; font-size: 17px; color: var(--green-900); line-height: 1.25; }
  .recipe-badges { display: flex; gap: 12px; font-size: 11px; color: var(--gray-500); font-weight: 600; flex-wrap: wrap; }

  /* description */
  .recipe-desc { font-size: 13px; color: var(--gray-500); line-height: 1.6; }

  /* divider */
  .recipe-divider { border: 0; border-top: 1px solid var(--gray-100); margin: 0; }

  /* ingredients */
  .recipe-ings-label { font-size: 10px; font-weight: 800; color: var(--gray-500); text-transform: uppercase; letter-spacing: .1em; margin-bottom: 6px; }
  .recipe-ings { display: flex; flex-wrap: wrap; gap: 6px; }
  .recipe-ing { display: inline-flex; align-items: center; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 100px; padding: 5px 12px; font-size: 12px; color: var(--gray-700); font-weight: 500; text-decoration: none; transition: all .15s ease; white-space: nowrap; }
  .recipe-ing:hover { background: var(--green-50); border-color: var(--green-400); color: var(--green-700); }
  .recipe-ing-more { background: transparent; border: 1px dashed var(--gray-300); border-radius: 100px; padding: 5px 12px; font-size: 12px; color: var(--gray-500); font-weight: 500; }

  /* CTA */
  .recipe-foot { margin-top: auto; }
  .recipe-add { width: 100%; height: 44px; border-radius: var(--radius-md); background: var(--green-900); color: #fff; font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all .15s ease; border: 0; cursor: pointer; letter-spacing: -.01em; }
  .recipe-add:hover { background: var(--green-700); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
  .recipe-add:disabled { background: var(--gray-200); color: var(--gray-500); cursor: default; transform: none; box-shadow: none; }

  @media (max-width: 1024px) {
    .recipes-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 640px) {
    .products { grid-template-columns: repeat(2,1fr); }
    .carousel-tab { padding: 10px 14px; font-size: 13px; }
    .recipes-grid { grid-template-columns: 1fr; }
    .recipe-card { padding: 20px; }
  }
`

/* ── SVG icons inline ─────────────────────────────── */
const IcoLeaf = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3c.5.12 1 .18 1.5.18C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/></svg>
const IcoSearch = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoCart = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
const IcoMap = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
const IcoArrow = ({ size = 14 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
const IcoCheck = ({ size = 12 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
const IcoTruck = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
const IcoShield = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const IcoBot = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="M12 8V4M8 4h8"/></svg>
const IcoSparkles = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>
const IcoWa = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
const IcoIg = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
const IcoFb = () => <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
const IcoStore = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l1-6h16l1 6"/><path d="M3 9v11a1 1 0 001 1h16a1 1 0 001-1V9"/><path d="M8 21V13h8v8"/></svg>
const IcoHouse = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V9.5z"/></svg>
const IcoCard = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
const IcoMenu = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
const IcoX = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

/* ── DATA ─────────────────────────────────────────── */
const HOW_STEPS = [
  { cls: 'q', emoji: '🛒', num: '01', title: 'Elige tu pedido', desc: 'En la web o por WhatsApp. Con Meni, nuestro asistente IA, o armándolo tú mismo.' },
  { cls: 's', emoji: '💳', num: '02', title: 'Paga en segundos', desc: 'Webpay Plus de Transbank. Confirmación instantánea, sin esperas ni sorpresas.' },
  { cls: 'l', emoji: '🚚', num: '03', title: 'Despachamos ese día', desc: 'Pedidos antes de las 16:00 salen ese mismo día a las 27 comunas que cubrimos.' },
  { cls: 'c', emoji: '🌿', num: '04', title: 'Recibes fresco', desc: 'Garantía de frescura. Si algo no llega en punto, lo cambiamos o te devolvemos el dinero.' },
]

const MENU_ITEMS: { icon: React.ReactNode; label: string; href: string; isExternal?: boolean; tag?: string }[] = [
  { icon: '🥬', label: 'Catálogo minorista', href: '/catalogo' },
  { icon: '🏪', label: 'Catálogo mayorista', href: '/mayorista', tag: 'Empresas' },
  { icon: '🏢', label: 'Registra tu negocio', href: '/mayorista/registro' },
  { icon: '🤖', label: 'Asistente IA · Meni', href: 'https://wa.me/56954952395?text=Hola%20Meni!%20Necesito%20armar%20un%20pedido', isExternal: true, tag: 'Nuevo' },
  { icon: '📦', label: 'Seguir mi pedido', href: '/mi-cuenta#pedidos' },
  { icon: '🚚', label: 'Zonas de despacho', href: '#zonas' },
  { icon: '❓', label: 'Preguntas frecuentes', href: '#faq' },
  { icon: '💬', label: 'Contacto', href: 'https://wa.me/56954952395', isExternal: true },
]

const FAQS = [
  { q: '¿A qué comunas despachan?', a: 'Despachamos a comunas seleccionadas de la Región Metropolitana de Santiago. El despacho tiene un costo único de $2.990 y el pedido mínimo es $20.000. Revisa la sección de Zonas de despacho para ver si tu comuna está incluida.' },
  { q: '¿Cuánto tarda mi pedido en llegar?', a: 'Los pedidos confirmados antes de las 16:00 llegan ese mismo día. Después de las 16:00 entregamos al día siguiente. También puedes programar la fecha que prefieras al hacer checkout.' },
  { q: '¿Cómo accedo a precios mayoristas?', a: 'Si tienes restaurante, almacén, verdulería u otro negocio, regístrate en <a href="/mayorista/registro">/mayorista/registro</a> con tu RUT comercial. Validamos y activamos tu cuenta en menos de 24 horas hábiles.' },
  { q: '¿Qué pasa si un producto no llega fresco?', a: 'Tenemos garantía de frescura: si algo no cumple, lo cambiamos o devolvemos el dinero. Escríbenos por <a href="https://wa.me/56954952395">WhatsApp</a> con foto y lo resolvemos de inmediato.' },
  { q: '¿Qué medios de pago aceptan?', a: 'Aceptamos Webpay Plus de Transbank (débito, crédito y prepago). Es el único medio de pago disponible por ahora.' },
]

function fmt(price: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(price)
}

function FadeUp({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('is-visible'); io.unobserve(el) }
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`fade-up-on-view ${className}`} style={style}>{children}</div>
}

/* ── Newsletter form (WhatsApp opt-in, local-only por ahora) ── */
function NewsletterForm() {
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!phone.trim()) return
    // TODO: enviar a Supabase (tabla newsletter_subscriptions o similar).
    // Por ahora abre WhatsApp con un mensaje pre-cargado, así el cliente confirma manualmente.
    const wa = `https://wa.me/56954952395?text=${encodeURIComponent(`Hola! Quiero recibir las ofertas de la semana por WhatsApp. Mi número: ${phone}`)}`
    window.open(wa, '_blank', 'noopener,noreferrer')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="thanks"><IcoCheck size={14} /> ¡Listo! Te escribimos por WhatsApp.</div>
    )
  }
  return (
    <form className="newsletter-form" onSubmit={handleSubmit}>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+56 9 ..."
        value={phone}
        onChange={e => setPhone(e.target.value)}
        aria-label="Número de WhatsApp"
        required
      />
      <button type="submit"><IcoWa size={16} /> Suscribirme</button>
    </form>
  )
}

/* ── MAIN PAGE ────────────────────────────────────── */
export default function HomeClient({ featuredProducts, recipes }: { featuredProducts: Product[]; recipes: Recipe[] }) {
  const router = useRouter()
  const [role, setRole] = useState<UserRole | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [zonesOpen, setZonesOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'ofertas' | 'populares' | 'nuevos'>('ofertas')
  const { addItem } = useCart()

  // Cargar rol del usuario para condicionar la banda B2B.
  useEffect(() => {
    let active = true
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user) { setRole(null); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!active) return
      setRole((profile?.role as UserRole) ?? 'minorista')
    }
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) setRole(null)
      else load()
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  // Mostrar banda B2B salvo a mayoristas/admin ya logueados.
  const showB2B = role !== 'mayorista' && role !== 'admin'

  // Bloquear scroll del body cuando el drawer está abierto + cerrar con Escape.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onEsc)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  const tabProducts = {
    ofertas: [...featuredProducts].sort((a, b) => b.price - a.price),
    populares: featuredProducts,
    nuevos: featuredProducts,
  }

  const categories: { id: string; label: string; href: string }[] = [
    { id: 'offers',     label: '🔥 Ofertas de hoy',      href: '/catalogo' },
    { id: 'verduras',   label: '🥬 Verduras',            href: '/catalogo?cat=verduras' },
    { id: 'frutas',     label: '🍎 Frutas',              href: '/catalogo?cat=frutas' },
    { id: 'hierbas',    label: '🌿 Hierbas',             href: '/catalogo?cat=hierbas' },
    { id: 'palta',      label: '🥑 Palta & aguacates',   href: '/catalogo?q=palta' },
    { id: 'pimentones', label: '🫑 Pimentones',          href: '/catalogo?q=pimenton' },
    { id: 'tomates',    label: '🍅 Tomates',             href: '/catalogo?q=tomate' },
    { id: 'tuberculos', label: '🥔 Tubérculos',          href: '/catalogo?cat=tuberculos' },
    { id: 'citricos',   label: '🍋 Cítricos',            href: '/catalogo?cat=citricos' },
    { id: 'berries',    label: '🍓 Berries',             href: '/catalogo?q=frutilla' },
    { id: 'temporada',  label: '⭐ Temporada',           href: '/catalogo?cat=temporada' },
  ]

  function onSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = ((fd.get('q') as string) || '').trim()
    router.push(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo')
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* TOP BAR */}
      <div className="topbar">
        <div className="inner">
          <span className="tagline">Tenemos esa Oferta que Sorprende🤩</span>
          <div className="links">
            <Link href="/mi-cuenta#pedidos">Seguir mi pedido</Link>
            <a href="https://wa.me/56954952395?text=Hola!%20Necesito%20ayuda" target="_blank" rel="noopener noreferrer">Ayuda</a>
            <Link href="/mayorista">Mayorista →</Link>
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav className="nav">
        <div className="inner">
          {/* Mobile hamburger — izquierda, oculto en desktop */}
          <button
            type="button"
            className="nav-hamburger-m"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <IcoMenu />
          </button>
          <Link href="/" className="logo" aria-label="El Menú — inicio">
            <img src="/logo/elmenu-color.png" alt="El Menú" />
          </Link>
          <form className="search-box" onSubmit={onSearchSubmit} role="search">
            <span className="ico"><IcoSearch /></span>
            <input
              type="search"
              name="q"
              placeholder="Busca paltas, tomates, lechugas..."
              aria-label="Buscar productos"
            />
          </form>
          <div className="nav-right">
            <UserMenu className="nav-btn" />
            <button
              type="button"
              className="menu-btn"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
            >
              <IcoMenu />
            </button>
          </div>
        </div>
      </nav>

      {/* CATEGORY PILLS */}
      <div className="cats-nav">
        <div className="inner">
          {categories.map(cat => (
            <Link key={cat.id} href={cat.href} className="cat-pill">
              {cat.label}
            </Link>
          ))}
        </div>
      </div>

      {/* MARQUEE */}
      <div className="marquee">
        <div className="marquee-track">
          {[0, 1].map(i => (
            <div key={i} className="marquee-group" aria-hidden={i === 1 ? true : undefined}>
              <span><IcoLeaf /> Expertos en frutas y verduras frescas</span>
              <span><IcoSparkles /> Más de 600 productos seleccionados cada mañana</span>
              <span><IcoTruck size={16} /> Pide hoy, recibe hoy o cuando quieras</span>
              <span><IcoShield size={16} /> Garantía de frescura: si no te gusta, te devolvemos el dinero</span>
              <span><IcoBot size={16} /> Asistente IA que arma tu pedido por WhatsApp</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 1. HERO DUAL ═══ */}
      <section className="hero">
        <div className="container">
          <div className="hero-dual">
            {/* Puerta 1 · Minorista */}
            <Link href="/catalogo" className="hero-door retail">
              <div>
                <span className="door-eye"><IcoHouse size={14} /> Para mi casa</span>
                <div className="door-emoji">🥑</div>
                <h2>Frescos <em>directo</em> a tu puerta.</h2>
                <p className="door-desc">Frutas y verduras seleccionadas cada mañana en Lo Valledor, despachadas a 27 comunas seleccionadas de Santiago.</p>
                <div className="door-meta">
                  <span><span className="chk"><IcoCheck /></span> Pedido mínimo $20.000</span>
                  <span><span className="chk"><IcoCheck /></span> Despacho $2.990 en 27 comunas</span>
                  <span><span className="chk"><IcoCheck /></span> Pide hasta las 16:00, recibe hoy</span>
                </div>
              </div>
              <span className="door-cta">Ver catálogo minorista <IcoArrow size={16} /></span>
            </Link>

            {/* Puerta 2 · Mayorista */}
            <Link href="/mayorista" className="hero-door wholesale">
              <div>
                <span className="door-eye"><IcoStore size={14} /> Para mi negocio</span>
                <div className="door-emoji">🏪</div>
                <h2>Precios <em>mayoristas</em> con servicio de oficina.</h2>
                <p className="door-desc">Restaurantes, almacenes y verdulerías: compra por caja o bulto con facturación electrónica inmediata.</p>
                <div className="door-meta">
                  <span><span className="chk"><IcoCheck /></span> Precios por caja y volumen</span>
                  <span><span className="chk"><IcoCheck /></span> Factura electrónica al instante</span>
                  <span><span className="chk"><IcoCheck /></span> Entrega antes de las 7:00 AM</span>
                </div>
              </div>
              <span className="door-cta">Ver catálogo mayorista <IcoArrow size={16} /></span>
            </Link>
          </div>

          {/* Search strip global */}
          <form className="hero-search-strip" onSubmit={onSearchSubmit} role="search">
            <input type="text" name="q" placeholder="¿Qué buscas hoy? Paltas, tomates, lechugas…" aria-label="Buscar productos" />
            <button type="submit"><IcoSearch size={16} /><span className="btn-txt"> Buscar</span></button>
          </form>
        </div>
      </section>

      {/* ═══ 2. TRUST STRIP ═══ */}
      <FadeUp style={{ paddingTop: 8 }}>
        <div className="container">
          <div className="trust-strip">
            {[
              { icon: <IcoTruck />, title: 'Despacho mismo día', desc: 'Pedidos antes de las 16:00 llegan hoy en toda la RM.' },
              { icon: <IcoLeaf />, title: 'Cosechado <48h', desc: 'Compramos cada mañana en Lo Valledor. Si no es fresco, no lo vendemos.' },
              { icon: <IcoShield />, title: 'Garantía de frescura', desc: 'Si algún producto no cumple, lo cambiamos o devolvemos la plata.' },
              { icon: <IcoCard />, title: 'Pago seguro', desc: 'Webpay Plus de Transbank. Débito, crédito y prepago.' },
            ].map(v => (
              <div key={v.title} className="trust-item">
                <div className="ico-wrap">{v.icon}</div>
                <div><h4>{v.title}</h4><p>{v.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      {/* ═══ 3. CARRUSEL DE PRODUCTOS ═══ */}
      {featuredProducts.length > 0 && (
        <FadeUp>
          <section>
            <div className="container">
              <div className="section-head">
                <div>
                  <span className="section-eye">🌿 Lo más fresco</span>
                  <h2>Productos de temporada</h2>
                </div>
                <Link href="/catalogo" className="view-all">Ver catálogo completo <IcoArrow /></Link>
              </div>
              <div className="carousel-tabs">
                {([
                  ['ofertas', '🔥 Ofertas de la semana'],
                  ['populares', '⭐ Más populares'],
                  ['nuevos', '🌱 Recién llegados'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`carousel-tab${activeTab === key ? ' active' : ''}`}
                    onClick={() => setActiveTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="products">
                {tabProducts[activeTab].slice(0, 10).map(p => (
                  <div key={p.id} className="product">
                    <div className="img">
                      {p.images?.[0]
                        ? <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span>{(p as Product & { category?: { emoji?: string } }).category?.emoji ?? '🥬'}</span>
                      }
                    </div>
                    <div className="name">{p.name}</div>
                    <div className="unit">{p.unit}</div>
                    <div className="product-foot col">
                      <div className="price">{fmt(p.price)}</div>
                      <button type="button" className="add-yellow" onClick={() => addItem(p)}>+ Agregar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </FadeUp>
      )}

      {/* ═══ 4. ZONAS DE DESPACHO ═══ */}
      <FadeUp>
        <div className="container" id="zonas">
          <div className="section-head">
            <div>
              <span className="section-eye"><IcoTruck size={14} /> Cobertura</span>
              <h2>¿Llegamos a tu comuna?</h2>
              <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 8 }}>
                Cubrimos 27 comunas de Santiago. Búscala directamente en el mapa.
              </p>
            </div>
          </div>
          <div className="zones-frame">
            <ZonesMap />
          </div>
          <div className="zones-legend">
            <div className="zl-item">
              <span className="zl-dot" style={{ background: '#22C55E' }} />
              Con despacho
            </div>
            <div className="zl-item">
              <span className="zl-dot" style={{ background: '#94A3B8' }} />
              Sin cobertura aún
            </div>
            <div className="zl-sep" />
            <button className="zones-toggle" onClick={() => setZonesOpen(v => !v)}>
              Ver las 27 comunas {zonesOpen ? '▲' : '▼'}
            </button>
            <div className="zl-price">
              Despacho <strong>$2.990</strong> · Mínimo $20.000
            </div>
          </div>
          {zonesOpen && (
            <div className="zones-commune-grid">
              {COMMUNES_WITH_DELIVERY.map(c => (
                <div key={c} className="zc-item">
                  <span className="zl-dot" style={{ background: '#22C55E' }} />
                  {c}
                </div>
              ))}
            </div>
          )}
        </div>
      </FadeUp>

      {/* ═══ 5. AI AGENT ═══ */}
      <FadeUp>
        <div className="container">
          <div className="ai-section">
            <div className="ai-grid">
              <div>
                <span className="ai-tag">
                  <span style={{ width: 6, height: 6, background: 'var(--warm)', borderRadius: '50%', display: 'inline-block' }} />
                  Nuevo · Solo en El Menú
                </span>
                <h2>Pide tu verdura hablando, no <em>tipeando</em>.</h2>
                <p className="ai-desc">Nuestro asistente IA conoce el stock en tiempo real, tus compras anteriores y las recetas de la semana.</p>
                <div className="ai-features">
                  {[
                    '"Hazme una caja para ensaladas de la semana" — listo.',
                    'Sugiere sustitutos cuando hay stock limitado.',
                    'Recuerda tu dirección, zona y preferencias.',
                    'Atiende 24/7 por chat, WhatsApp o voz.',
                  ].map(f => (
                    <div key={f} className="ai-feat">
                      <span className="chk"><IcoCheck /></span> {f}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
                  {/* TODO Step 7: este botón debe abrir el ChatModal de Meni.
                      Mientras no exista, manda a WhatsApp con un mensaje pre-cargado. */}
                  <a
                    href="https://wa.me/56954952395?text=Hola%20Meni!%20Necesito%20armar%20un%20pedido"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ background: 'var(--warm)' }}
                  >
                    <IcoBot size={18} /> Chatear con el asistente
                  </a>
                  <a href="https://wa.me/56954952395" target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}><IcoWa /> Pedir por WhatsApp</a>
                </div>
              </div>
              <div className="chat">
                <div className="chat-head">
                  <div className="chat-avatar"><IcoBot size={20} /></div>
                  <div className="info">
                    <div className="n">Menú · Asistente IA</div>
                    <div className="s">● En línea · Responde en 2 segundos</div>
                  </div>
                </div>
                <div className="msg bot">¡Hola! Soy el asistente de El Menú. ¿En qué te ayudo hoy?</div>
                <div className="msg user">Necesito verduras para una ensalada para 4 personas</div>
                <div className="msg bot">
                  Perfecto. Te armé esta selección con productos frescos de hoy:
                  <div className="suggest">
                    <span>🥬 Lechuga x2</span><span>🍅 Tomate 500g</span><span>🥒 Pepino x1</span><span>🥑 Palta 2u</span><span>🧅 Cebolla morada</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13 }}><strong>Total: $7.890</strong> · ¿Lo confirmo?</div>
                </div>
                <div className="typing"><span /><span /><span /></div>
              </div>
            </div>
          </div>
        </div>
      </FadeUp>

      {/* ═══ 6. RECETAS IA ═══ */}
      {recipes.length > 0 && (
        <RecipesSection recipes={recipes} products={featuredProducts} />
      )}

      {/* ═══ 7. BANDA B2B (condicional, oculta a mayoristas logueados) ═══ */}
      {showB2B && (
        <FadeUp>
          <div className="container" id="b2b">
            <div className="b2b">
              <div className="lead">
                <span style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--gold-700)' }}>Para restaurantes & minimarkets</span>
                <h2 style={{ marginTop: 12 }}>Mayorista con precios de feria<br />y servicio de oficina.</h2>
                <p>Somos el eslabón entre Lo Valledor y tu cocina. Compramos en volumen cada madrugada, entregamos antes de las 7 AM con factura electrónica al instante.</p>
                <div className="b2b-stats">
                  <div className="stat"><div className="n num">127+</div><div className="l">Restaurantes activos</div></div>
                  <div className="stat"><div className="n num">30 días</div><div className="l">Crédito disponible</div></div>
                  <div className="stat"><div className="n num">&lt; 7 AM</div><div className="l">Entrega garantizada</div></div>
                </div>
              </div>
              <div className="b2b-cta">
                <Link href="/mayorista" className="btn-primary">Ir al catálogo mayorista <IcoArrow size={18} /></Link>
                <Link href="/mayorista/registro" className="btn-ghost"><IcoStore size={16} /> Registrar mi negocio</Link>
              </div>
            </div>
          </div>
        </FadeUp>
      )}

      {/* ═══ 8. CÓMO FUNCIONA ═══ */}
      <FadeUp>
        <div className="container">
          <div className="section-head">
            <div>
              <span className="section-eye">¿Cómo funciona?</span>
              <h2>Del campo a tu puerta, sin complicaciones</h2>
              <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 8 }}>Cuatro pasos. Sin app que bajar. Sin letra chica.</p>
            </div>
          </div>
          <div className="producers">
            {HOW_STEPS.map(s => (
              <article key={s.num} className={`producer ${s.cls}`}>
                <span className="pin">{s.num}</span>
                <div>
                  <div className="producer-emoji">{s.emoji}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </FadeUp>

      {/* ═══ 9. TESTIMONIOS ═══ */}
      <FadeUp style={{ background: 'var(--surface)', borderTop: '1px solid var(--gray-200)', borderBottom: '1px solid var(--gray-200)' }}>
        <div className="container">
          <div className="section-head"><h2>Lo que dicen nuestros clientes</h2></div>
          <div className="testis">
            {[
              { initials: 'CM', name: 'Carolina Muñoz', meta: 'Cliente desde 2025 · Ñuñoa', quote: '"La frescura no se compara con el supermercado. Llevo 6 meses pidiendo todas las semanas y nunca me ha fallado un pedido. Además el asistente IA me recuerda cosas que siempre olvido."' },
              { initials: 'PR', name: 'Paulina Rojas', meta: 'Restaurant La Mesa · Providencia', quote: '"Como dueña de restaurant, que lleguen antes de las 7 AM con factura ya emitida me cambió la operación. Y los precios son 18% más bajos que mi proveedor anterior."' },
              { initials: 'JV', name: 'Javier Vergara', meta: 'Cliente frecuente · Macul', quote: '"Nunca pensé que iba a pedirle verduras a una IA por WhatsApp, pero es lo más cómodo que he usado. Le digo \'lo de siempre\' y arma el pedido."' },
            ].map(t => (
              <div key={t.name} className="testi">
                <div className="stars">★★★★★</div>
                <p>{t.quote}</p>
                <div className="testi-user">
                  <div className="av">{t.initials}</div>
                  <div><div className="n">{t.name}</div><div className="m">{t.meta}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      {/* ═══ 10. NEWSLETTER / WHATSAPP ═══ */}
      <FadeUp>
        <div className="container">
          <div className="newsletter">
            <div>
              <span className="eye"><IcoWa size={14} /> Lista de WhatsApp</span>
              <h2>Recibe las ofertas de la semana directo a tu WhatsApp.</h2>
              <p>Un solo mensaje los lunes con lo de temporada, descuentos exclusivos y novedades. Sin spam, puedes darte de baja cuando quieras.</p>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </FadeUp>

      {/* ═══ 11. FAQ MINI ═══ */}
      <FadeUp>
        <div className="container">
          <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ margin: '0 auto' }}>
              <span className="section-eye">Preguntas frecuentes</span>
              <h2>Antes de comprar, lo más preguntado</h2>
            </div>
          </div>
          <div className="faqs">
            {FAQS.map(item => (
              <details key={item.q} className="faq">
                <summary>{item.q}</summary>
                <div className="body" dangerouslySetInnerHTML={{ __html: item.a }} />
              </details>
            ))}
          </div>
        </div>
      </FadeUp>

      {/* FOOTER */}
      <footer>
        <div className="container">
          <div className="foot-grid">
            <div className="foot-brand">
              <div className="logo" style={{ marginBottom: 8 }}>
                <img src="/logo/elmenu-white.png" alt="El Menú" style={{ height: 64 }} />
              </div>
              <p>Del huerto a tu puerta. Frutas y verduras frescas seleccionadas cada mañana en Lo Valledor, despachadas a toda la Región Metropolitana.</p>
              <div className="socials">
                <a href="https://www.instagram.com/el_menu._" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IcoIg /></a>
                <a href="https://www.facebook.com/share/17gVgD319J/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><IcoFb /></a>
                <a href="https://wa.me/56954952395" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><IcoWa /></a>
              </div>
            </div>
            <div className="foot-col">
              <h5>Tienda</h5>
              <Link href="/catalogo?cat=verduras">Verduras</Link>
              <Link href="/catalogo?cat=frutas">Frutas</Link>
              <Link href="/catalogo?cat=hierbas">Hierbas</Link>
              <Link href="/catalogo">Catálogo completo</Link>
              <Link href="/mayorista">Mayorista</Link>
            </div>
            <div className="foot-col">
              <h5>Ayuda</h5>
              <a href="https://wa.me/56954952395?text=Hola!%20%C2%BFC%C3%B3mo%20funciona%20el%20pedido%3F" target="_blank" rel="noopener noreferrer">¿Cómo comprar?</a>
              <a href="https://wa.me/56954952395?text=Hola!%20%C2%BFA%20qu%C3%A9%20comunas%20despachan%3F" target="_blank" rel="noopener noreferrer">Zonas de despacho</a>
              <Link href="/mi-cuenta#pedidos">Seguir mi pedido</Link>
              <a href="https://wa.me/56954952395?text=Hola!%20Tengo%20una%20pregunta" target="_blank" rel="noopener noreferrer">Preguntas frecuentes</a>
              <a href="https://wa.me/56954952395?text=Hola!%20Necesito%20cambiar%20un%20producto" target="_blank" rel="noopener noreferrer">Garantía de frescura</a>
            </div>
            <div className="foot-col">
              <h5>Contacto</h5>
              <a href="https://maps.google.com/?q=Los+Olmos+3967+Macul" target="_blank" rel="noopener noreferrer">Los Olmos 3967, Macul</a>
              <a href="https://wa.me/56954952395" target="_blank" rel="noopener noreferrer">+56 9 5495 2395</a>
              <a href="mailto:verduleriaelmenu@gmail.com">verduleriaelmenu@gmail.com</a>
              <span>Lun–Sáb · 8:00 a 20:00</span>
            </div>
          </div>
          <div className="foot-bottom">
            <div>© 2026 El Menú SpA · Todos los derechos reservados</div>
            <div className="pays">
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginRight: 6 }}>Pagamos con:</span>
              <span className="pay-chip">Webpay</span>
              <span className="pay-chip">Khipu</span>
              <span className="pay-chip">Flow</span>
              <span className="pay-chip">Mercado Pago</span>
            </div>
          </div>
        </div>
      </footer>

      {/* SIDE DRAWER · menú lateral con accesos directos */}
      <div
        className={`drawer-backdrop ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />
      <aside
        className={`drawer ${menuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú principal"
        aria-hidden={!menuOpen}
      >
        <div className="drawer-head">
          <h3>Entradas</h3>
          <button
            type="button"
            className="drawer-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <IcoX />
          </button>
        </div>
        <nav className="drawer-list" aria-label="Navegación lateral">
          {MENU_ITEMS.map(item => {
            const content = (
              <>
                <span className="ico-circle" aria-hidden>{item.icon}</span>
                <span className="grow">{item.label}</span>
                {item.tag && <span className="new-tag">{item.tag}</span>}
              </>
            )
            return item.isExternal ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="drawer-item"
                onClick={() => setMenuOpen(false)}
              >
                {content}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className="drawer-item"
                onClick={() => setMenuOpen(false)}
              >
                {content}
              </Link>
            )
          })}
        </nav>
        <div className="drawer-foot">
          <div className="label">Contacto directo</div>
          <a href="https://wa.me/56954952395" target="_blank" rel="noopener noreferrer">
            <IcoWa size={14} /> +56 9 5495 2395
          </a>
          <a href="mailto:verduleriaelmenu@gmail.com">
            ✉️ verduleriaelmenu@gmail.com
          </a>
        </div>
      </aside>

    </>
  )
}
