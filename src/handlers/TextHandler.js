import { MenuBuilder } from "../menus/MenuBuilder.js";
import { Config } from "../config/config.js";

/**
 * Text Handler
 * Handles text input from users for multi-step operations and menu buttons
 */
export class TextHandler {
  constructor(databaseService, userState, adminHandler, salesHandler, menuHandler, productEditHandler) {
    this.db = databaseService;
    this.userState = userState;
    this.adminHandler = adminHandler;
    this.salesHandler = salesHandler;
    this.menuHandler = menuHandler;
    this.productEditHandler = productEditHandler;
  }

  async handleText(ctx) {
    const text = ctx.message.text.trim();
    const state = this.userState.getState(ctx.from.id);

    // Handle empty messages - go to main menu
    if (!text || text.length === 0) {
      this.userState.clearState(ctx.from.id);
      return this.menuHandler.showMenu(ctx);
    }

    // Handle menu buttons first (even if in state, to allow navigation)
    // Check if text matches any menu button
    const isMenuButton = this.isMenuButton(text);
    if (isMenuButton) {
      // Clear state when navigating via menu buttons
      if (state) {
        this.userState.clearState(ctx.from.id);
      }
      return this.handleMenuButtons(ctx, text);
    }

    // If no state and not a menu button, ignore
    if (!state) {
      return;
    }

    // Handle state-based flows

    // Sales: custom quantity
    if (state.mode === "await_qty") {
      const qty = Number(text);
      if (!Number.isFinite(qty) || qty <= 0) {
        const keyboard = MenuBuilder.inlineBackMenu("menu:product_list_back");
        return ctx.reply("Introduceți o cantitate validă (ex. 5).", keyboard);
      }
      return this.salesHandler.handleCustomQty(ctx, qty);
    }

    // Admin: add product flow
    if (state.mode === "add_name") {
      return this.adminHandler.handleAddName(ctx, text);
    }
    if (state.mode === "add_type") {
      return this.adminHandler.handleAddType(ctx, text);
    }
    if (state.mode === "add_qty") {
      const qty = Number(text);
      if (!Number.isFinite(qty) || qty <= 0) {
        const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
        return ctx.reply("Cantitate invalidă. Scrie un număr (ex. 20).", keyboard);
      }
      return this.adminHandler.handleAddQty(ctx, qty);
    }

    // Admin: rename product
    if (state.mode === "rename_wait") {
      if (!text) {
        const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
        return ctx.reply("Introdu un nume valid.", keyboard);
      }
      return this.adminHandler.handleRenameWait(ctx, text);
    }

    // Admin: set stock
    if (state.mode === "set_wait") {
      const total = Number(text);
      if (!Number.isFinite(total) || total < 0) {
        const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
        return ctx.reply("Cantitate totală invalidă. Scrie un număr (ex. 50).", keyboard);
      }
      return this.adminHandler.handleSetWait(ctx, total);
    }

    // Admin: delete confirmation
    if (state.mode === "delete_confirm") {
      if (text.toUpperCase() === "DA" || text.toUpperCase() === "YES") {
        return this.adminHandler.handleDeleteConfirm(ctx, state.productId);
      }
      if (text.toUpperCase() === "NU" || text.toUpperCase() === "NO") {
        this.userState.clearState(ctx.from.id);
        return this.menuHandler.showMenu(ctx);
      }
      const keyboard = MenuBuilder.inlineBackMenu("menu:editare_back");
      return ctx.reply('Scrieți "DA" pentru confirmare sau "NU" pentru anulare.', keyboard);
    }

    // Sales: product selection for sale
    if (state.mode === "select_product_for_sale") {
      // Parse product ID from text like "#1" or "1"
      const match = text.match(/^#?(\d+)$/);
      if (!match) {
        const keyboard = MenuBuilder.inlineBackMenu("menu:vanzari_back");
        return ctx.reply("Te rog să introduci un număr valid de produs (ex: #1 sau 1).", keyboard);
      }
      const productId = Number(match[1]);
      return this.salesHandler.handleProductSelectionForSale(ctx, productId);
    }

    // Sales: quantity for sale
    if (state.mode === "await_qty_for_sale") {
      const qty = Number(text);
      if (!Number.isFinite(qty) || qty <= 0) {
        const keyboard = MenuBuilder.inlineBackMenu("menu:product_list_back");
        return ctx.reply("Introduceți o cantitate validă (ex. 5).", keyboard);
      }
      return this.salesHandler.handleQtyForSale(ctx, qty);
    }

    // Sales: client name
    if (state.mode === "await_client_name") {
      return this.salesHandler.handleClientName(ctx, text);
    }

    // Product edit: add quantity
    if (state.mode === "await_qty_add") {
      const qty = Number(text);
      if (!Number.isFinite(qty) || qty <= 0) {
        return ctx.reply("Introduceți o cantitate validă (ex. 5).");
      }
      return this.productEditHandler.handleAddQty(ctx, qty);
    }

    // Product edit: remove quantity
    if (state.mode === "await_qty_remove") {
      const qty = Number(text);
      if (!Number.isFinite(qty) || qty <= 0) {
        return ctx.reply("Introduceți o cantitate validă (ex. 5).");
      }
      return this.productEditHandler.handleRemoveQty(ctx, qty);
    }

    // Admin: add seller chatid
    if (state.mode === "add_seller_chatid") {
      return this.adminHandler.handleAddSellerChatId(ctx, text);
    }

    // Admin: add seller name
    if (state.mode === "add_seller_name") {
      return this.adminHandler.handleAddSellerName(ctx, text);
    }

    // Admin: change role chatid
    if (state.mode === "change_role_chatid") {
      return this.adminHandler.handleChangeRoleChatId(ctx, text);
    }

    // Admin: change role confirmation
    if (state.mode === "change_role_select") {
      return this.adminHandler.handleChangeRoleConfirm(ctx, text);
    }

    // Admin: change user name chatid
    if (state.mode === "change_username_chatid") {
      return this.adminHandler.handleChangeUserNameChatId(ctx, text);
    }

    // Admin: change user name value
    if (state.mode === "change_username_value") {
      return this.adminHandler.handleChangeUserNameValue(ctx, text);
    }

    // User: change my own name
    if (state.mode === "change_myname") {
      return this.adminHandler.handleChangeMyNameValue(ctx, text);
    }

    // Admin: remove seller chatid
    if (state.mode === "remove_seller_chatid") {
      return this.adminHandler.handleRemoveSellerChatId(ctx, text);
    }

    // Access request: await name
    if (state.mode === "await_access_name") {
      return this.adminHandler.handleAccessRequestName(ctx, text);
    }
  }

  async handleMenuButtons(ctx, text) {
    // Main menu buttons
    if (text === "Lista") {
      return this.menuHandler.handleLista(ctx);
    }
    if (text === "Stoc") {
      return this.menuHandler.handleStoc(ctx);
    }
    if (text === "Vinde") {
      return this.menuHandler.handleVinde(ctx);
    }
    if (text === "Vanzari") {
      return this.menuHandler.handleSales(ctx);
    }
    if (text === "Editare") {
      return this.menuHandler.handleEditare(ctx);
    }
    if (text === "⚙️ Setări" || text === "Setari") {
      return this.adminHandler.handleSettings(ctx);
    }
    if (text === "✏️ Schimbă numele meu") {
      return this.adminHandler.handleChangeMyName(ctx);
    }
    if (text === "Inapoi" || text === "Meniu principal") {
      return this.menuHandler.showMenu(ctx);
    }

    // Lista submenu buttons
    if (text === "Editor") {
      return this.menuHandler.handleEditor(ctx);
    }
    if (text === "➕ Adauga") {
      return this.menuHandler.handleAdauga(ctx);
    }
    if (text === "➖ Scoate") {
      return this.menuHandler.handleScoate(ctx);
    }

    // Editor submenu buttons (from Lista)
    if (text === "Adauga") {
      return this.menuHandler.handleAdauga(ctx);
    }
    if (text === "Scoate") {
      return this.menuHandler.handleScoate(ctx);
    }
    if (text === "Produs nou") {
      return this.menuHandler.handleProdusNou(ctx);
    }

    // Vanzari submenu buttons
    if (text === "🛒 Vinde") {
      return this.menuHandler.handleVinde(ctx);
    }
    if (text === "📅 Ultima săptămână") {
      return this.menuHandler.handleSalesLastWeek(ctx);
    }
    if (text === "📆 Ultima lună") {
      return this.menuHandler.handleSalesLastMonth(ctx);
    }
    if (text === "📊 Total (6 luni)") {
      return this.menuHandler.handleSalesTotal(ctx);
    }

    // Users management submenu buttons (admin only) - check before general Inapoi
    if (Config.isAdmin(ctx.from?.id)) {
      if (text === "➕ Adaugă vânzător") {
        return this.adminHandler.handleAddSeller(ctx);
      }
      if (text === "📋 Listă utilizatori") {
        return this.adminHandler.handleListUsers(ctx);
      }
      if (text === "✏️ Schimbă nume") {
        return this.adminHandler.handleChangeUserName(ctx);
      }
      if (text === "🔄 Schimbă rol") {
        return this.adminHandler.handleChangeRole(ctx);
      }
      if (text === "➖ Șterge vânzător") {
        return this.adminHandler.handleRemoveSeller(ctx);
      }
    }

    // Editare submenu buttons (admin only)
    if (Config.isAdmin(ctx.from?.id)) {
      if (text === "➕ Adaugă") {
        return this.adminHandler.handleAdd(ctx);
      }
      if (text === "✏️ Redenumește") {
        return this.adminHandler.handleRename(ctx, 1);
      }
      if (text === "🔢 Setează stoc") {
        return this.adminHandler.handleSet(ctx, 1);
      }
      if (text === "🗑️ Șterge") {
        return this.adminHandler.handleDelete(ctx, 1);
      }
      if (text === "👥 Utilizatori") {
        return this.adminHandler.handleManageUsers(ctx);
      }
    }
    
    if (text === "⬅️ Înapoi") {
      return this.menuHandler.showMenu(ctx);
    }

    // Ignore other text if no state is active
    return;
  }

  isMenuButton(text) {
    const menuButtons = [
      "Lista", "Stoc", "Vinde", "Vanzari", "Editare", "Inapoi", "Meniu principal",
      "Editor", "➕ Adauga", "➖ Scoate", "Adauga", "Scoate", "Produs nou",
      "🛒 Vinde", "📅 Ultima săptămână", "📆 Ultima lună", "📊 Total (6 luni)",
      "➕ Adaugă vânzător", "📋 Listă utilizatori", "✏️ Schimbă nume", "🔄 Schimbă rol", "➖ Șterge vânzător",
      "➕ Adaugă", "✏️ Redenumește", "🔢 Setează stoc", "🗑️ Șterge", "👥 Utilizatori",
      "⚙️ Setări", "Setari", "✏️ Schimbă numele meu",
      "⬅️ Înapoi"
    ];
    return menuButtons.includes(text);
  }
}

