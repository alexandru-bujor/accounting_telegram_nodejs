import { MenuBuilder, removeKeyboard } from "../menus/MenuBuilder.js";
import { TableBuilder } from "../utils/TableBuilder.js";
import { ProductUtils } from "../utils/ProductUtils.js";
import { Config } from "../config/config.js";

/**
 * Menu Handler
 * Handles all menu-related actions
 */
export class MenuHandler {
  constructor(databaseService, userState, reportService, adminHandler = null, salesHandler = null) {
    this.db = databaseService;
    this.userState = userState;
    this.reportService = reportService;
    this.adminHandler = adminHandler;
    this.salesHandler = salesHandler;
  }

  setAdminHandler(adminHandler) {
    this.adminHandler = adminHandler;
  }

  setSalesHandler(salesHandler) {
    this.salesHandler = salesHandler;
  }

  async showMenu(ctx, preface = null) {
    this.userState.clearState(ctx.from.id);
    const text = preface ?? "Alege o acțiune din meniu:";
    return ctx.reply(text, MenuBuilder.mainMenu(ctx));
  }

  async handleLista(ctx) {
    // Check if user is admin (only admins can use Lista)
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni pentru această funcție.", MenuBuilder.mainMenu(ctx));
    }

    const products = this.db.getAllProducts();
    if (!products.length) {
      return ctx.reply("Nu există produse în listă.", MenuBuilder.mainMenu(ctx));
    }

    // Show simple list of all products with edit options
    const lines = products.map(p => {
      const remaining = ProductUtils.remainingOf(p);
      return `#${p.id} ${p.name} (${p.type}) — Total: ${p.qty_total}, Vândut: ${p.qty_sold || 0}, Rămas: ${remaining}`;
    });

    const message = "📋 Lista produselor:\n\n" + lines.join("\n");
    await ctx.reply(message, MenuBuilder.listaEditMenu());
  }

  async handleEditor(ctx) {
    // Only admins can use Editor
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni pentru această funcție.", MenuBuilder.mainMenu(ctx));
    }
    await ctx.reply("Alege acțiunea:", removeKeyboard());
    await ctx.reply("Acțiuni:", MenuBuilder.editorSubmenu());
  }

  async handleAdauga(ctx) {
    // Only admins can add quantity
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni pentru această funcție.", MenuBuilder.mainMenu(ctx));
    }
    const products = this.db.getAllProducts();
    
    if (!products.length) {
      return ctx.reply("Nu există produse.", removeKeyboard());
    }

    // Show all products as inline buttons (not just those with stock)
    const items = ProductUtils.listProducts(products, true);
    const keyboard = MenuBuilder.productListForEdit(items, "add");
    await ctx.reply("Selectează produsul pentru a adăuga cantitate:", keyboard);
  }

  async handleScoate(ctx) {
    // Only admins can remove quantity
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni pentru această funcție.", MenuBuilder.mainMenu(ctx));
    }
    const products = this.db.getAllProducts();
    const productsWithStock = ProductUtils.listProducts(products, false);
    
    if (!productsWithStock.length) {
      return ctx.reply("Nu există produse cu stoc disponibil.", removeKeyboard());
    }

    const keyboard = MenuBuilder.productListForEdit(productsWithStock, "remove");
    await ctx.reply("Selectează produsul pentru a scădea cantitate:", keyboard);
  }

  async handleProdusNou(ctx) {
    // Only admins can add new products
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni pentru această funcție.", MenuBuilder.mainMenu(ctx));
    }
    this.userState.clearState(ctx.from.id);
    this.userState.setState(ctx.from.id, { mode: "add_name" });
    const keyboard = MenuBuilder.inlineBackMenu("menu:lista_back");
    await ctx.reply("Introduceți numele produsului nou:", { ...keyboard, ...removeKeyboard() });
  }

  async handleStoc(ctx) {
    if (!Config.hasAccess(ctx.from?.id)) {
      return ctx.reply("Nu aveți acces la această funcție.", removeKeyboard());
    }
    const products = this.db.getAllProducts();
    if (!products.length) {
      return ctx.reply("Nu există produse în stoc.", MenuBuilder.mainMenu(ctx));
    }

    const items = ProductUtils.listProducts(products, false);
    const lines = items.map(p => {
      const remaining = ProductUtils.remainingOf(p);
      return `#${p.id} ${p.name} — Stoc: ${remaining} bucăți`;
    });

    const message = "📦 Stoc disponibil:\n\n" + lines.join("\n");
    await ctx.reply(message, MenuBuilder.mainMenu(ctx));
  }

  async handleEditare(ctx) {
    if (!Config.isAdmin(ctx.from?.id)) {
      await ctx.reply("Nu aveți permisiuni pentru editare.", removeKeyboard());
      return;
    }
    await ctx.reply("Alege opțiunea de editare:", removeKeyboard());
    await ctx.reply("Opțiuni:", MenuBuilder.editareSubmenu(ctx));
  }

  async handleManageUsers(ctx) {
    if (!this.adminHandler) {
      return ctx.reply("Handler indisponibil.", removeKeyboard());
    }
    return this.adminHandler.handleManageUsers(ctx);
  }

  async handleList(ctx) {
    const products = this.db.getAllProducts();
    const items = ProductUtils.listProducts(products, false);
    const table = TableBuilder.buildTable(items);
    await ctx.reply(table, {
      ...MenuBuilder.listaSubmenu(),
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
  }

  async handleListAll(ctx) {
    const products = this.db.getAllProducts();
    const items = ProductUtils.listProducts(products, true);
    const table = TableBuilder.buildTable(items);
    await ctx.reply(table, {
      ...MenuBuilder.listaSubmenu(),
      parse_mode: "HTML",
      disable_web_page_preview: true
    });
  }

  async handleSales(ctx) {
    if (!Config.hasAccess(ctx.from?.id)) {
      return ctx.reply("Nu aveți acces la această funcție.", removeKeyboard());
    }
    const isAdmin = Config.isAdmin(ctx.from?.id);
    if (isAdmin) {
      await ctx.reply("Alege perioada pentru raport:", removeKeyboard());
    }
    await ctx.reply("Alege opțiunea:", MenuBuilder.vanzariSubmenu(ctx));
  }

  async handleVinde(ctx) {
    if (!Config.hasAccess(ctx.from?.id)) {
      return ctx.reply("Nu aveți acces la această funcție.", removeKeyboard());
    }
    
    // Use SalesHandler's showProductPicker with inline buttons
    // Only show products with stock (includeZero = false)
    // Use "sellpick" prefix for the actions
    // Back action returns to vanzari submenu
    return this.salesHandler.showProductPicker(
      ctx,
      1,
      false, // Only products with stock
      "sellpick",
      "📦 Selectează produsul pentru vânzare:",
      "menu:vanzari_back"
    );
  }

  async handleSalesLastWeek(ctx) {
    // Only admins can view reports
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni pentru această funcție.", MenuBuilder.mainMenu(ctx));
    }
    const allSales = this.db.getAllSales();
    if (!allSales.length) {
      return ctx.reply("Nu există vânzări încă.", MenuBuilder.mainMenu(ctx));
    }

    const days = this.reportService.getDaysInLastWeek();
    const products = this.db.getAllProducts();

    await ctx.reply(`Generând ${days.length} rapoarte pentru ultima săptămână...`, MenuBuilder.vanzariSubmenu(ctx));

    for (const day of days) {
      const daySales = this.reportService.getSalesForDay(allSales, day);
      if (daySales.length === 0) continue;

      const dayStr = day.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
      const clients = this.db.getAllClients();
      const users = this.db.getAllUsers();
      const buffer = await this.reportService.generateSalesPdf(
        daySales,
        products,
        "Raport vânzări",
        `Ziua: ${dayStr}`,
        clients,
        users
      );
      const filename = `raport_vanzari_${day.toISOString().split("T")[0]}.pdf`;

      await ctx.replyWithDocument(
        { source: buffer, filename },
        {
          ...MenuBuilder.vanzariSubmenu(ctx),
          caption: `Raport pentru ${dayStr}`
        }
      );
    }

    await ctx.reply("Toate rapoartele pentru ultima săptămână au fost generate.", MenuBuilder.mainMenu(ctx));
  }

  async handleSalesLastMonth(ctx) {
    // Only admins can view reports
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni pentru această funcție.", MenuBuilder.mainMenu(ctx));
    }
    const allSales = this.db.getAllSales();
    if (!allSales.length) {
      return ctx.reply("Nu există vânzări încă.", MenuBuilder.mainMenu(ctx));
    }

    const weeks = this.reportService.getWeeksInLastMonth();
    const products = this.db.getAllProducts();

    await ctx.reply(`Generând ${weeks.length} rapoarte pentru ultima lună...`, MenuBuilder.vanzariSubmenu(ctx));

    for (let i = 0; i < weeks.length; i++) {
      const weekStart = weeks[i];
      const weekSales = this.reportService.getSalesForWeek(allSales, weekStart);
      if (weekSales.length === 0) continue;

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekStr = `${weekStart.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" })} - ${weekEnd.toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
      
      const clients = this.db.getAllClients();
      const users = this.db.getAllUsers();
      const buffer = await this.reportService.generateSalesPdf(
        weekSales,
        products,
        "Raport vânzări",
        `Săptămâna: ${weekStr}`,
        clients,
        users
      );
      const filename = `raport_vanzari_saptamana_${i + 1}_${weekStart.toISOString().split("T")[0]}.pdf`;

      await ctx.replyWithDocument(
        { source: buffer, filename },
        {
          ...MenuBuilder.vanzariSubmenu(ctx),
          caption: `Raport pentru săptămâna ${i + 1}: ${weekStr}`
        }
      );
    }

    await ctx.reply("Toate rapoartele pentru ultima lună au fost generate.", MenuBuilder.mainMenu(ctx));
  }

  async handleSalesTotal(ctx) {
    // Only admins can view reports
    if (!Config.isAdmin(ctx.from?.id)) {
      return ctx.reply("Nu aveți permisiuni pentru această funcție.", MenuBuilder.mainMenu(ctx));
    }
    const allSales = this.db.getAllSales();
    if (!allSales.length) {
      return ctx.reply("Nu există vânzări încă.", MenuBuilder.mainMenu(ctx));
    }

    const months = this.reportService.getLast6Months();
    const products = this.db.getAllProducts();

    await ctx.reply(`Generând ${months.length} rapoarte pentru ultimele 6 luni...`, MenuBuilder.vanzariSubmenu(ctx));

    for (const { year, month } of months) {
      const monthSales = this.reportService.getSalesForMonth(allSales, year, month);
      if (monthSales.length === 0) continue;

      const monthStr = new Date(year, month, 1).toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
      const clients = this.db.getAllClients();
      const users = this.db.getAllUsers();
      const buffer = await this.reportService.generateSalesPdf(
        monthSales,
        products,
        "Raport vânzări",
        `Luna: ${monthStr}`,
        clients,
        users
      );
      const filename = `raport_vanzari_${year}_${String(month + 1).padStart(2, "0")}.pdf`;

      await ctx.replyWithDocument(
        { source: buffer, filename },
        {
          ...MenuBuilder.vanzariSubmenu(ctx),
          caption: `Raport pentru ${monthStr}`
        }
      );
    }

    await ctx.reply("Toate rapoartele pentru ultimele 6 luni au fost generate.", MenuBuilder.mainMenu(ctx));
  }

  async replyInChunks(ctx, lines, keyboard) {
    const MAX_LEN = 3500;
    let chunk = "";
    for (const line of lines) {
      if ((chunk + line + "\n").length > MAX_LEN) {
        await ctx.reply(chunk.trim(), keyboard);
        chunk = "";
      }
      chunk += line + "\n";
    }
    if (chunk.trim().length) {
      await ctx.reply(chunk.trim(), keyboard);
    }
  }
}
