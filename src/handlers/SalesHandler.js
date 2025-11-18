import { MenuBuilder, removeKeyboard } from "../menus/MenuBuilder.js";
import { ProductUtils } from "../utils/ProductUtils.js";
import { Pagination } from "../utils/Pagination.js";
import { Config } from "../config/config.js";

/**
 * Sales Handler
 * Handles sales-related operations
 */
export class SalesHandler {
  constructor(databaseService, userState) {
    this.db = databaseService;
    this.userState = userState;
  }

  async showProductPicker(ctx, page = 1, includeZero = true, onPickPrefix, title, backAction = "menu:home") {
    if (!Config.hasAccess(ctx.from?.id)) {
      return ctx.reply("Nu aveți acces la această funcție.", removeKeyboard());
    }
    const products = this.db.getAllProducts();
    const items = includeZero 
      ? ProductUtils.listProducts(products, true) 
      : ProductUtils.listProducts(products, false);
    
    if (!items.length) {
      return ctx.reply("Nu există produse.", MenuBuilder.mainMenu(ctx));
    }

    const { slice, page: p, pages } = Pagination.paginate(items, page);
    const keyboard = MenuBuilder.productPickerMenu(slice, p, pages, onPickPrefix, backAction);
    return ctx.reply(title, keyboard);
  }

  async handleSellPick(ctx, productId, page) {
    const product = this.db.getProductById(productId);
    if (!product) {
      return ctx.answerCbQuery("Produs inexistent.", { show_alert: true });
    }

    const remaining = ProductUtils.remainingOf(product);
    if (remaining <= 0) {
      await ctx.answerCbQuery("Nu mai sunt bucăți pe stoc.", { show_alert: true });
      return;
    }

    // Start the sale flow: ask for quantity first
    this.userState.setState(ctx.from.id, { 
      mode: "await_qty_for_sale", 
      productId: productId 
    });
    
    const keyboard = MenuBuilder.inlineBackMenu("menu:product_list_back");
    await ctx.reply(
      `📦 Produs selectat: ${product.name}\n` +
      `📊 Stoc disponibil: ${remaining} bucăți\n\n` +
      `Introduceți cantitatea (ex. 5):`,
      { ...keyboard, ...removeKeyboard() }
    );
  }

  async handleSellQty(ctx, productId, qty, clientName = null) {
    // This method is for quick quantity buttons
    // After selecting quick qty, ask for client name
    const product = this.db.getProductById(productId);
    if (!product) {
      return ctx.answerCbQuery("Produs inexistent.", { show_alert: true });
    }

    const left = ProductUtils.remainingOf(product);
    if (qty > left) {
      return ctx.answerCbQuery(`Mai sunt doar ${left}.`, { show_alert: true });
    }

    // Move to client name step
    this.userState.setState(ctx.from.id, { 
      mode: "await_client_name", 
      productId: productId,
      qty: qty 
    });
    
    const keyboard = MenuBuilder.inlineBackMenu("menu:product_list_back");
    return ctx.reply(
      `Cantitate: ${qty} × ${product.name}\n\n` +
      `Introduceți numele clientului:`,
      { ...keyboard, ...removeKeyboard() }
    );
  }

  async handleSellOther(ctx, productId) {
    const product = this.db.getProductById(productId);
    if (!product) {
      return ctx.answerCbQuery("Produs inexistent.", { show_alert: true });
    }

    this.userState.setState(ctx.from.id, { mode: "await_qty", productId });
    const keyboard = MenuBuilder.inlineBackMenu("menu:product_list_back");
    await ctx.reply(
      `Introduceți cantitatea pentru: ${product.name}\nScrieți un număr (ex. 7).`,
      { ...keyboard, ...removeKeyboard() }
    );
  }

  async handleCustomQty(ctx, qty, clientName = null) {
    const state = this.userState.getState(ctx.from.id);
    if (!state || state.mode !== "await_qty") return;

    const product = this.db.getProductById(state.productId);
    if (!product) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Produs inexistent.", MenuBuilder.mainMenu(ctx));
    }

    const left = ProductUtils.remainingOf(product);
    if (qty > left) {
      return ctx.reply(`Cantitatea depășește stocul. Mai sunt ${left}.`);
    }

    this.db.addSale({ product_id: product.id, qty, client_name: clientName || null });
    this.db.updateProduct(product.id, { qty_sold: (product.qty_sold || 0) + qty });
    await this.db.save();

    const clientInfo = clientName ? `\nClient: ${clientName}` : "";
    this.userState.clearState(ctx.from.id);
    return ctx.reply(
      `✅ Vândut ${qty} × ${product.name}${clientInfo}\nRămase: ${ProductUtils.remainingOf(product)}.`,
      MenuBuilder.mainMenu(ctx)
    );
  }

  async handleProductSelectionForSale(ctx, productId) {
    const product = this.db.getProductById(productId);
    if (!product) {
      return ctx.reply("Produs inexistent. Te rog să introduci un număr valid de produs.");
    }

    const remaining = ProductUtils.remainingOf(product);
    if (remaining <= 0) {
      return ctx.reply(
        `❗ ${ProductUtils.productLine(product)}\nNu mai sunt bucăți pe stoc.`,
        MenuBuilder.vanzariSubmenu(ctx)
      );
    }

    this.userState.setState(ctx.from.id, { 
      mode: "await_qty_for_sale", 
      productId: productId 
    });
    
    const keyboard = MenuBuilder.inlineBackMenu("menu:product_list_back");
    await ctx.reply(
      `Produs selectat: ${product.name}\nStoc disponibil: ${remaining} bucăți\n\nIntroduceți cantitatea (ex. 5):`,
      { ...keyboard, ...removeKeyboard() }
    );
  }

  async handleQtyForSale(ctx, qty) {
    const state = this.userState.getState(ctx.from.id);
    if (!state || state.mode !== "await_qty_for_sale") return;

    const product = this.db.getProductById(state.productId);
    if (!product) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Produs inexistent.", MenuBuilder.mainMenu(ctx));
    }

    const left = ProductUtils.remainingOf(product);
    if (qty > left) {
      const keyboard = MenuBuilder.inlineBackMenu("menu:product_list_back");
      return ctx.reply(`Cantitatea depășește stocul. Mai sunt ${left} bucăți disponibile.`, keyboard);
    }

    // Move to next step: ask for client name
    this.userState.setState(ctx.from.id, { 
      mode: "await_client_name", 
      productId: state.productId,
      qty: qty 
    });
    
    const keyboard = MenuBuilder.inlineBackMenu("menu:product_list_back");
    return ctx.reply(
      `Cantitate: ${qty} × ${product.name}\n\nIntroduceți numele clientului:`,
      { ...keyboard, ...removeKeyboard() }
    );
  }

  async handleClientName(ctx, clientName) {
    const state = this.userState.getState(ctx.from.id);
    if (!state || state.mode !== "await_client_name") return;

    if (!clientName || !clientName.trim()) {
      const keyboard = MenuBuilder.inlineBackMenu("menu:product_list_back");
      return ctx.reply("Te rog să introduci un nume valid pentru client.", keyboard);
    }

    const product = this.db.getProductById(state.productId);
    if (!product) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Produs inexistent.", MenuBuilder.mainMenu(ctx));
    }

    const left = ProductUtils.remainingOf(product);
    if (state.qty > left) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply(`Cantitatea depășește stocul. Mai sunt ${left} bucăți disponibile.`, MenuBuilder.mainMenu(ctx));
    }

    // Get or create client (normalizes name for case-insensitive matching)
    const client = this.db.getOrCreateClient(clientName.trim());
    
    // Save the sale with client and seller info
    this.db.addSale({ 
      product_id: product.id, 
      qty: state.qty, 
      client_name: clientName.trim(),
      client_id: client ? client.id : null,
      seller_id: ctx.from?.id ? String(ctx.from.id) : null
    });
    this.db.updateProduct(product.id, { qty_sold: (product.qty_sold || 0) + state.qty });
    await this.db.save();

    // Show client info (use display name if available, otherwise use entered name)
    const clientDisplayName = client ? client.name_display : clientName.trim();
    
    this.userState.clearState(ctx.from.id);
    return ctx.reply(
      `✅ Vânzare înregistrată!\n\n` +
      `Produs: ${product.name}\n` +
      `Cantitate: ${state.qty} bucăți\n` +
      `Client: ${clientDisplayName}\n` +
      `Stoc rămas: ${ProductUtils.remainingOf(product)} bucăți`,
      MenuBuilder.mainMenu(ctx)
    );
  }
}

