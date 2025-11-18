import { ProductUtils } from "./ProductUtils.js";

/**
 * Table Builder
 * Creates formatted ASCII tables for product listings
 */
export class TableBuilder {
  static COLS = { id: 4, name: 28, type: 12, total: 5, sold: 5, left: 6 };

  static repeat(ch, n) {
    return ch.repeat(Math.max(0, n));
  }

  static cut(s, n) {
    return String(s).length <= n ? String(s) : String(s).slice(0, n - 1) + "…";
  }

  static padEnd(s, n) {
    return this.cut(String(s), n).padEnd(n, " ");
  }

  static padStart(s, n) {
    return String(s).slice(0, n).padStart(n, " ");
  }

  static boxLine(left, fill, sep, right, widths) {
    return left + Object.values(widths).map(w => this.repeat(fill, w + 2)).join(sep) + right;
  }

  static buildTable(items) {
    const { COLS } = this;
    const top = this.boxLine("┌", "─", "┬", "┐", COLS);
    const mid = this.boxLine("├", "─", "┼", "┤", COLS);
    const bot = this.boxLine("└", "─", "┴", "┘", COLS);
    
    const header =
      "│ " + this.padEnd("ID", COLS.id) +
      " │ " + this.padEnd("Denumire", COLS.name) +
      " │ " + this.padEnd("Tip", COLS.type) +
      " │ " + this.padStart("Tot", COLS.total) +
      " │ " + this.padStart("Vând", COLS.sold) +
      " │ " + this.padStart("Răm", COLS.left) + " │";
    
    const rows = (items.length ? items : [{
      id: "-", name: "Nu există produse.", type: "-", qty_total: "-", qty_sold: "-", left: "-"
    }]).map(p => {
      const left = (typeof p === "object" && p.qty_total !== "-") 
        ? ProductUtils.remainingOf(p) 
        : p.left;
      return "│ " + this.padEnd(p.id, COLS.id) +
             " │ " + this.padEnd(p.name, COLS.name) +
             " │ " + this.padEnd(p.type ?? "", COLS.type) +
             " │ " + this.padStart(p.qty_total, COLS.total) +
             " │ " + this.padStart(p.qty_sold || 0, COLS.sold) +
             " │ " + this.padStart(left, COLS.left) + " │";
    });
    
    const body = [top, header, mid, ...rows, bot].join("\n");
    return `<pre>${body}</pre>`;
  }
}

