export type Listing = { id: string; sku: string; retailer: string; identity: string[]; required: string[]; url: string; name: string; specs: string; note: string };
export type Offer = { price_cents: number | null; stock: string; seller: string; condition: string };
export type Preferences = { target_cents: number | null; drop_percent: number; target_alert: boolean; drop_alert: boolean; low_alert: boolean; restock_alert: boolean };
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function cents(s: string) {
  const value = Math.round(Number(s.replace(/[$, ]/g, '')) * 100);
  if (!Number.isSafeInteger(value) || value < 10000 || value > 2000000) throw new Error('Price outside laptop range');
  return value;
}
// Ported from the local MVP. Only the primary product/offer may supply identity or price.
export function parsePage(item: Listing, markdown: string): Offer {
  const text = markdown.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
  const heading = item.retailer === 'MSI US' ? new RegExp('^##? ([^\\n]*' + escape(item.sku) + '[^\\n]*)', 'm').exec(text)
    : item.retailer === 'Best Buy' ? /^([^\n]*Legion[^\n]+)\n\nModel:/m.exec(text) : /^# ([^\n]+)/m.exec(text);
  if (!heading) throw new Error('Product heading missing; page may be blocked or changed');
  const primary = text.slice(heading.index).split(/\n(?:## |Overview\n|Reviews\n|See all specifications)/)[0]!;
  if (!item.identity.every(x => normalized(primary.slice(0,1800)).includes(normalized(x)))) throw new Error('Exact SKU mismatch');
  if (!item.required.every(x => normalized(primary.slice(0,3500)).includes(normalized(x)))) throw new Error('Configuration mismatch');
  let price_cents: number | null = null, seller = item.retailer, condition = 'new', block = primary;
  if (item.retailer === 'MSI US') {
    const match = /\$[\d,]+\.\d{2}(?:\s*\$[\d,]+\.\d{2})?\s*\n\n(?:Out of Stock|In Stock|Add to Cart)/i.exec(primary);
    if (!match) throw new Error('MSI primary price/stock block missing');
    block = match[0]; price_cents = cents([...block.matchAll(/\$([\d,]+\.\d{2})/g)].at(-1)![1]!);
  } else if (item.retailer === 'B&H') {
    block = primary.split(/\n(?:Color|CPU|Protect Your Gear|Shipping Restrictions|Chat)\n/)[0]!;
    const prices = [...block.matchAll(/^\$([\d,]+\.\d{2})\s*$/gm)];
    if (prices.length > 1) throw new Error('Multiple primary prices; review required');
    if (prices[0]) price_cents = cents(prices[0][1]!);
  } else if (item.retailer === 'Newegg') {
    block = text.slice(0,text.includes('## Meet Your Seller') ? text.indexOf('## Meet Your Seller') : heading.index);
    const sm = /Sold by \[\*\*([^*]+)\*\*\]/.exec(block);
    if (!sm) throw new Error('Seller missing');
    seller = sm[1]!.trim();
    const prices = [...block.matchAll(/^\$ \*\*([\d,]+)\*\*\.(\d{2})\s*$/gm)];
    if (prices.length > 1) throw new Error('Multiple primary prices');
    if (prices[0]) price_cents = cents(prices[0][1]+'.'+prices[0][2]);
  } else {
    const match = /(?:The price was|current price is|Your price for this item is)\s*\$([\d,]+\.\d{2})/i.exec(block);
    if (match && !/The price was/i.test(match[0])) price_cents = cents(match[1]!);
  }
  if (/^\s*(?:Used|Refurbished|Open[ -]Box)\s*$/im.test(block) || /\b(?:refurbished|open[ -]box)\b/i.test(heading[0])) condition = 'non_new';
  const stock = /\bDiscontinued\b/i.test(block) ? 'discontinued' : /out of stock|sold out|no longer available in new condition/i.test(block) ? 'out_of_stock'
    : /pre.?order|back.?order/i.test(block) ? 'preorder' : /\bIn Stock\b|\bAdd to cart\b/i.test(block) ? 'in_stock' : 'unknown';
  if (price_cents === null && ['unknown','in_stock'].includes(stock)) throw new Error('Primary USD price could not be verified');
  return {price_cents,stock,seller,condition};
}
export function alertReasons(next: Offer, history: Offer[], p: Preferences): string[] {
  const latest = history[0];
  if (!latest || latest.seller !== next.seller || latest.condition !== next.condition) return [];
  const same = history.filter(x=>x.seller===next.seller && x.condition===next.condition);
  const prev = same.find(x=>x.price_cents!==null), known = same.find(x=>x.stock!=='unknown');
  const reasons: string[] = [];
  if (next.stock !== 'in_stock' || next.condition !== 'new' || next.price_cents === null) return reasons;
  const price = next.price_cents;
  const restock = !!known && ['out_of_stock','discontinued','preorder'].includes(known.stock);
  if (restock && p.restock_alert) reasons.push(`Back in stock: $${(price/100).toLocaleString('en-US',{minimumFractionDigits:2})} (${p.target_cents === null ? 'no target set' : price <= p.target_cents ? 'within target' : 'above target'})`);
  if (!prev || prev.price_cents === null) return reasons;
  if (p.target_alert && p.target_cents !== null && price <= p.target_cents && (prev.price_cents > p.target_cents || restock)) reasons.push('Target reached');
  const drop = 100*(prev.price_cents-price)/prev.price_cents;
  if (p.drop_alert && price < prev.price_cents && drop >= p.drop_percent) reasons.push(`Price dropped ${drop.toFixed(1)}%`);
  if (p.low_alert && price < Math.min(...same.flatMap(x=>x.price_cents===null?[]:[x.price_cents]))) reasons.push('New low in our tracked history');
  return reasons;
}
