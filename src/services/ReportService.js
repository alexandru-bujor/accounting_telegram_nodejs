import PDFDocument from "pdfkit";
import { ProductUtils } from "../utils/ProductUtils.js";

/**
 * Report Service
 * Generates PDF exports for bot data (e.g., sales history)
 */
export class ReportService {
  /**
   * Normalize Romanian characters to simple ASCII for PDF compatibility
   * @param {string} text - Text to normalize
   * @returns {string} - Normalized text
   */
  normalizeText(text) {
    if (!text) return text;
    return String(text)
      .replace(/ă/g, "a")
      .replace(/Ă/g, "A")
      .replace(/â/g, "a")
      .replace(/Â/g, "A")
      .replace(/î/g, "i")
      .replace(/Î/g, "I")
      .replace(/ș/g, "s")
      .replace(/Ș/g, "S")
      .replace(/ț/g, "t")
      .replace(/Ț/g, "T");
  }
  /**
   * Generate a PDF with sales in table format
   * @param {Array} sales - sales array
   * @param {Array} products - products array
   * @param {string} title - Report title
   * @param {string} period - Period description
   * @param {Array} clients - clients array (optional)
   * @param {Array} users - users array (optional)
   * @returns {Promise<Buffer>}
   */
  async generateSalesPdf(sales, products, title = "Raport vânzări", period = "", clients = [], users = []) {
    const productMap = new Map(products.map(p => [p.id, p]));
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const userMap = new Map(users.map(u => [u.id, u]));

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];

    return new Promise((resolve, reject) => {
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.fontSize(20).text(this.normalizeText(title), { align: "center" });
      if (period) {
        doc.fontSize(14).text(this.normalizeText(period), { align: "center" });
      }
      doc.moveDown();
      doc.fontSize(12).text(this.normalizeText(`Total inregistrari: ${sales.length}`));
      const generatedAt = new Date().toLocaleString("ro-RO")
        .replace(/ă/g, "a").replace(/Ă/g, "A")
        .replace(/â/g, "a").replace(/Â/g, "A")
        .replace(/î/g, "i").replace(/Î/g, "I")
        .replace(/ș/g, "s").replace(/Ș/g, "S")
        .replace(/ț/g, "t").replace(/Ț/g, "T");
      doc.text(this.normalizeText(`Generat la: ${generatedAt}`));
      doc.moveDown(1.5);

      if (!sales.length) {
        doc.fontSize(14).text(this.normalizeText("Nu exista vanzari inregistrate."), { align: "center" });
        doc.end();
        return;
      }

      // Table setup - adjust widths to fit seller column
      const startX = 40;
      const startY = doc.y;
      const colWidths = { id: 30, name: 120, qty: 40, client: 90, seller: 80, date: 70 };
      const rowHeight = 25;
      const headerHeight = 30;
      let currentY = startY;

      // Table header
      doc.fontSize(10).font("Helvetica-Bold");
      doc.rect(startX, currentY, 430, headerHeight).stroke();
      
      doc.text("ID", startX + 3, currentY + 8, { width: colWidths.id, align: "left" });
      doc.text("Produs", startX + colWidths.id + 3, currentY + 8, { width: colWidths.name, align: "left" });
      doc.text("Cant.", startX + colWidths.id + colWidths.name + 3, currentY + 8, { width: colWidths.qty, align: "center" });
      doc.text("Client", startX + colWidths.id + colWidths.name + colWidths.qty + 3, currentY + 8, { width: colWidths.client, align: "left" });
      doc.text("Vanzator", startX + colWidths.id + colWidths.name + colWidths.qty + colWidths.client + 3, currentY + 8, { width: colWidths.seller, align: "left" });
      doc.text("Data", startX + colWidths.id + colWidths.name + colWidths.qty + colWidths.client + colWidths.seller + 3, currentY + 8, { width: colWidths.date, align: "left" });
      
      currentY += headerHeight;
      doc.font("Helvetica");

      // Table rows
      sales.forEach((sale, index) => {
        // Check if we need a new page
        if (currentY + rowHeight > doc.page.height - 60) {
          doc.addPage();
          currentY = 40;
        }

        const product = productMap.get(sale.product_id);
        const productName = product ? product.name : "Produs necunoscut";
        
        // Get client name from clientMap if available, using normalized display name
        let clientName = "-";
        if (sale.client_id && clientMap.has(sale.client_id)) {
          const client = clientMap.get(sale.client_id);
          clientName = client.name_display || client.name_normalized || "-";
        } else if (sale.client_name) {
          clientName = sale.client_name;
        }
        
        // Get seller name - prefer custom name, fallback to ChatID
        let sellerName = "-";
        if (sale.seller_id && userMap.has(sale.seller_id)) {
          const seller = userMap.get(sale.seller_id);
          // Use custom name if available, otherwise show ChatID
          if (seller.name) {
            sellerName = `${seller.name} (${seller.id})`;
          } else {
            sellerName = seller.id || "-";
          }
        } else if (sale.seller_id) {
          sellerName = sale.seller_id;
        }
        
        const saleDate = new Date(sale.ts).toLocaleDateString("ro-RO", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        
        // Normalize all text for PDF
        const normalizedProductName = this.normalizeText(productName);
        const normalizedClientName = this.normalizeText(clientName);
        const normalizedSellerName = this.normalizeText(sellerName);

        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(startX, currentY, 430, rowHeight)
            .fillColor("#f5f5f5")
            .fill()
            .fillColor("black");
        }

        // Draw row border
        doc.rect(startX, currentY, 430, rowHeight).stroke();

        // Row content
        doc.fontSize(8);
        doc.text(`#${sale.id}`, startX + 3, currentY + 8, { width: colWidths.id, align: "left" });
        
        // Truncate long product names
        const maxNameLength = 20;
        const displayName = normalizedProductName.length > maxNameLength 
          ? normalizedProductName.substring(0, maxNameLength - 3) + "..." 
          : normalizedProductName;
        doc.text(displayName, startX + colWidths.id + 3, currentY + 8, { width: colWidths.name, align: "left" });
        doc.text(`${sale.qty}`, startX + colWidths.id + colWidths.name + 3, currentY + 8, { width: colWidths.qty, align: "center" });
        
        // Truncate long client names
        const maxClientLength = 12;
        const displayClient = normalizedClientName.length > maxClientLength 
          ? normalizedClientName.substring(0, maxClientLength - 3) + "..." 
          : normalizedClientName;
        doc.text(displayClient, startX + colWidths.id + colWidths.name + colWidths.qty + 3, currentY + 8, { width: colWidths.client, align: "left" });
        
        // Truncate seller names
        const maxSellerLength = 12;
        const displaySeller = normalizedSellerName.length > maxSellerLength 
          ? normalizedSellerName.substring(0, maxSellerLength - 3) + "..." 
          : normalizedSellerName;
        doc.text(displaySeller, startX + colWidths.id + colWidths.name + colWidths.qty + colWidths.client + 3, currentY + 8, { width: colWidths.seller, align: "left" });
        
        doc.text(saleDate, startX + colWidths.id + colWidths.name + colWidths.qty + colWidths.client + colWidths.seller + 3, currentY + 8, { width: colWidths.date, align: "left" });

        currentY += rowHeight;
      });

      // Summary at the end
      doc.moveDown(1);
      currentY = doc.y;
      if (currentY + 100 > doc.page.height - 60) {
        doc.addPage();
        currentY = 40;
      }

      doc.fontSize(12).font("Helvetica-Bold").text("Sumar:", startX, currentY);
      doc.font("Helvetica").fontSize(10);
      currentY += 20;

      const totalQty = sales.reduce((sum, s) => sum + s.qty, 0);
      doc.text(this.normalizeText(`Total vanzari: ${totalQty} bucati`), startX, currentY);
      currentY += 15;

      // Group by product
      const byProduct = {};
      sales.forEach(sale => {
        const product = productMap.get(sale.product_id);
        const key = product ? product.name : "Necunoscut";
        if (!byProduct[key]) {
          byProduct[key] = { qty: 0, name: key };
        }
        byProduct[key].qty += sale.qty;
      });

      doc.text(this.normalizeText("Vanzari pe produs:"), startX, currentY);
      currentY += 15;
      Object.values(byProduct).forEach(item => {
        doc.text(this.normalizeText(`  • ${item.name}: ${item.qty} bucati`), startX + 10, currentY);
        currentY += 12;
      });

      doc.end();
    });
  }

  /**
   * Filter sales by date range
   */
  filterSalesByDateRange(sales, startDate, endDate) {
    return sales.filter(sale => {
      const saleDate = new Date(sale.ts);
      return saleDate >= startDate && saleDate <= endDate;
    });
  }

  /**
   * Get sales for a specific day
   */
  getSalesForDay(sales, date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return this.filterSalesByDateRange(sales, start, end);
  }

  /**
   * Get sales for a specific week
   */
  getSalesForWeek(sales, weekStart) {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return this.filterSalesByDateRange(sales, start, end);
  }

  /**
   * Get sales for a specific month
   */
  getSalesForMonth(sales, year, month) {
    const start = new Date(year, month, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, month + 1, 0);
    end.setHours(23, 59, 59, 999);
    return this.filterSalesByDateRange(sales, start, end);
  }

  /**
   * Get all days in the last week
   */
  getDaysInLastWeek() {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push(new Date(date));
    }
    return days;
  }

  /**
   * Get all weeks in the last month
   */
  getWeeksInLastMonth() {
    const weeks = [];
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    let currentWeekStart = new Date(firstDayOfMonth);
    // Adjust to Monday
    const dayOfWeek = currentWeekStart.getDay();
    const diff = currentWeekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    currentWeekStart.setDate(diff);

    while (currentWeekStart <= lastDayOfMonth) {
      weeks.push(new Date(currentWeekStart));
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    return weeks;
  }

  /**
   * Get last 6 months
   */
  getLast6Months() {
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({ year: date.getFullYear(), month: date.getMonth() });
    }
    return months;
  }
}
