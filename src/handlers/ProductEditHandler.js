import { MenuBuilder, removeKeyboard } from "../menus/MenuBuilder.js";
import { ProductUtils } from "../utils/ProductUtils.js";
import { Config } from "../config/config.js";

/**
 * Product Edit Handler
 * Handles adding/removing quantity from products
 */
export class ProductEditHandler {
  constructor(databaseService, userState) {
    this.db = databaseService;
    this.userState = userState;
  }

  async handleProductSelect(ctx, productId, action) {
    if (!Config.hasAccess(ctx.from?.id)) {
      return ctx.answerCbQuery("Nu aveți acces.", { show_alert: true });
    }
    const product = this.db.getProductById(productId);
    if (!product) {
      return ctx.answerCbQuery("Produs inexistent.", { show_alert: true });
    }

    const remaining = ProductUtils.remainingOf(product);
    const actionText = action === "add" ? "adăuga" : "scădea";
    
    this.userState.setState(ctx.from.id, { 
      mode: `await_qty_${action}`, 
      productId: productId 
    });

    const keyboard = MenuBuilder.inlineBackMenu("menu:lista_back");
    await ctx.reply(
      `Produs selectat: ${product.name}\n` +
      `Stoc curent: ${remaining} bucăți\n` +
      `Stoc total: ${product.qty_total} bucăți\n` +
      `Vândut: ${product.qty_sold || 0} bucăți\n\n` +
      `Introduceți cantitatea de ${actionText} (ex. 5):`,
      { ...keyboard, ...removeKeyboard() }
    );
  }

  async handleAddQty(ctx, qty) {
    if (!Config.hasAccess(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți acces.", MenuBuilder.mainMenu(ctx));
    }
    const state = this.userState.getState(ctx.from.id);
    if (!state || state.mode !== "await_qty_add") return;

    const product = this.db.getProductById(state.productId);
    if (!product) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Produs inexistent.", MenuBuilder.mainMenu(ctx));
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      const keyboard = MenuBuilder.inlineBackMenu("menu:lista_back");
      return ctx.reply("Introduceți o cantitate validă (ex. 5).", keyboard);
    }

    // Add to total quantity
    this.db.updateProduct(product.id, { qty_total: (product.qty_total || 0) + qty });
    await this.db.save();

    this.userState.clearState(ctx.from.id);
    return ctx.reply(
      `✅ Adăugat ${qty} bucăți la ${product.name}\n` +
      `Stoc total: ${product.qty_total} bucăți\n` +
      `Stoc disponibil: ${ProductUtils.remainingOf(product)} bucăți`,
      MenuBuilder.mainMenu(ctx)
    );
  }

  async handleRemoveQty(ctx, qty) {
    if (!Config.hasAccess(ctx.from?.id)) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Nu aveți acces.", MenuBuilder.mainMenu(ctx));
    }
    const state = this.userState.getState(ctx.from.id);
    if (!state || state.mode !== "await_qty_remove") return;

    const product = this.db.getProductById(state.productId);
    if (!product) {
      this.userState.clearState(ctx.from.id);
      return ctx.reply("Produs inexistent.", MenuBuilder.mainMenu(ctx));
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      const keyboard = MenuBuilder.inlineBackMenu("menu:lista_back");
      return ctx.reply("Introduceți o cantitate validă (ex. 5).", keyboard);
    }

    const currentTotal = product.qty_total || 0;
    const remaining = ProductUtils.remainingOf(product);

    // Can't remove more than available
    if (qty > remaining) {
      return ctx.reply(
        `Nu puteți scădea mai mult decât stocul disponibil.\n` +
        `Stoc disponibil: ${remaining} bucăți`
      );
    }

    // Remove from total quantity
    const newTotal = Math.max(0, currentTotal - qty);
    this.db.updateProduct(product.id, { qty_total: newTotal });
    await this.db.save();

    this.userState.clearState(ctx.from.id);
    return ctx.reply(
      `✅ Scăzut ${qty} bucăți din ${product.name}\n` +
      `Stoc total: ${newTotal} bucăți\n` +
      `Stoc disponibil: ${ProductUtils.remainingOf(product)} bucăți`,
      MenuBuilder.mainMenu(ctx)
    );
  }
}

