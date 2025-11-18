/**
 * Product Utility Functions
 * Helper functions for product calculations and formatting
 */
export class ProductUtils {
  static remainingOf(product) {
    return product.qty_total - (product.qty_sold || 0);
  }

  static listProducts(products, includeZero = false) {
    const arr = products
      .map(p => ({ ...p, remaining: this.remainingOf(p) }))
      .sort((a, b) => a.id - b.id);
    return includeZero ? arr : arr.filter(p => p.remaining > 0);
  }

  static productLine(product) {
    return `#${product.id}) ${product.name} — total: ${product.qty_total}, vândut: ${product.qty_sold || 0}, rămase: ${this.remainingOf(product)}`;
  }
}

