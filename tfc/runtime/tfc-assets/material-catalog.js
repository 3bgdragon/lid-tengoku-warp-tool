'use strict';
const {FIRST_ID, END_ID} = {FIRST_ID:1900000000,END_ID:1900010000};
const defaultPrices = require('./material-prices.json');
function planMaterialCatalog(db, prices = defaultPrices) {
  const existing = db.prepare('SELECT goods_id FROM master_automaticshop_lineup WHERE goods_id >= ? AND goods_id < ?').all(FIRST_ID, END_ID);
  if (existing.length) throw new Error('Reserved experimental goods IDs are already in use');
  const materials = db.prepare('SELECT itemid, rarity FROM master_item WHERE itemtype = ? ORDER BY itemid').all('ITTP_MATERIAL');
  if (!materials.length || materials.length > END_ID-FIRST_ID) throw new Error('Unexpected material count');
  const seen = new Set();
  return materials.map((item,i) => {
    if (!/^ITMT_[A-Z0-9_]+$/.test(item.itemid) || seen.has(item.itemid))
      throw new Error('Unknown or duplicated material ID: '+item.itemid);
    seen.add(item.itemid);
    const price = prices[item.rarity];
    if (!Number.isInteger(price) || price <= 0 || price > 2147483647)
      throw new Error('Missing/invalid pack price for rarity '+item.rarity);
    return {goods_id:FIRST_ID+i, lineup_id:'COMMON', entity_type:'ITEM', type_id:item.itemid,
      is_stable:0, freq:1, is_special:0, display_priority:100+i, currency_type:0,
      stock:1, pack_count:5, pack_money:price, pack_metal:0, pack_recycle_point:0,
      pack_bloodnium:0, money_discount_rate:0, metal_discount_rate:0,
      recycle_point_discount_rate:0, bloodnium_discount_rate:0};
  });
}
module.exports = {planMaterialCatalog};
