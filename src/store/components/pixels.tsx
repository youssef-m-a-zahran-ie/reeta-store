import Script from "next/script";

// Only well-formed IDs are ever written into a script.
const META_RE = /^\d{8,20}$/;
const TIKTOK_RE = /^[A-Z0-9]{10,30}$/i;
const GA4_RE = /^G-[A-Z0-9]{4,15}$/i;

/** Loads the ad and analytics pixels saved in Settings. Nothing loads until an ID is set. */
export function Pixels({ meta, tiktok, ga4 }: { meta: string | null; tiktok: string | null; ga4: string | null }) {
  const m = meta && META_RE.test(meta) ? meta : null;
  const t = tiktok && TIKTOK_RE.test(tiktok) ? tiktok.toUpperCase() : null;
  const g = ga4 && GA4_RE.test(ga4) ? ga4.toUpperCase() : null;
  return (
    <>
      {m && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${m}');fbq('track','PageView');`}
        </Script>
      )}
      {t && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${t}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
      {g && (
        <>
          <Script id="ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${g}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${g}');`}
          </Script>
        </>
      )}
    </>
  );
}
