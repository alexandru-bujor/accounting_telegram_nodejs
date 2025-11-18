import { JSONFilePreset } from "lowdb/node";

const db = await JSONFilePreset("db.json", { products: [], sales: [] });
const initial = [
  { name: "Prosecco Montelliana DOCG Extra Dry", type: "Spumant", qty_total: 50 },
  { name: "Prosecco Montelliana DOCG Extra Brut", type: "Spumant", qty_total: 40 },
  { name: "Prosecco Montelliana DOC Extra Dry", type: "Spumant", qty_total: 45 },
  { name: "Prosecco Montelliana DOCG 57", type: "Spumant", qty_total: 30 }
];

db.data.products = [];
let id = 0;
for (const p of initial) {
  db.data.products.push({ id: ++id, name: p.name, type: p.type, qty_total: p.qty_total, qty_sold: 0 });
}
db.data.sales = [];
await db.write();
console.log("Seed complet.");
