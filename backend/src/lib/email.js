import { env } from '../config/env.js';

// Anything that comes from data (customer names, product descriptions) must be escaped before it goes into HTML.
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const money = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Shared look for every system e-mail. `tone` colours the heading: info | warn | danger.
export function emailLayout({ heading, bodyHtml, cta, tone = 'info' }) {
  const color = { info: '#714b67', warn: '#b45309', danger: '#b91c1c' }[tone] || '#714b67';
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1d1d1f;line-height:1.55">
    <div style="padding:20px 0;border-bottom:1px solid #e5e5ea;font-weight:600;color:#714b67">${esc(env.COMPANY_NAME)}</div>
    <h2 style="color:${color};margin:24px 0 8px;font-size:20px">${esc(heading)}</h2>
    ${bodyHtml}
    ${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="display:inline-block;padding:11px 22px;background:#714b67;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">${esc(cta.label)}</a></p>` : ''}
    <p style="color:#86868b;font-size:12px;margin-top:32px">You are receiving this because you are a customer of ${esc(env.COMPANY_NAME)}.</p>
  </div>`;
}
