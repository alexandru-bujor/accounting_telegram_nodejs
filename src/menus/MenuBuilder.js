import { Markup } from "telegraf";
import { Config } from "../config/config.js";
import { ProductUtils } from "../utils/ProductUtils.js";

/**
 * Helper to remove keyboard
 */
export function removeKeyboard() {
  return Markup.removeKeyboard();
}

/**
 * Menu Builder
 * Creates reply keyboard menus for the bot
 */
export class MenuBuilder {
  /**
   * Main menu with buttons based on user role (Reply Keyboard)
   */
  static mainMenu(ctx = null) {
    const userId = ctx?.from?.id;
    const isAdmin = Config.isAdmin(userId);
    const isSeller = Config.isSeller(userId);
    
    if (isAdmin) {
      // Admin sees all options (no back/inapoi buttons needed in main menu)
      const rows = [
        ["Lista", "Stoc"],
        ["Vanzari", "Editare"],
        ["⚙️ Setări"]
      ];
      return Markup.keyboard(rows).resize();
    } else if (isSeller) {
      // Sellers only see Stoc and Vinde (direct, no submenu)
      const rows = [
        ["Stoc", "Vinde"],
        ["⚙️ Setări", "Meniu principal"]
      ];
      return Markup.keyboard(rows).resize();
    } else {
      // No access
      const rows = [
        ["Meniu principal"]
      ];
      return Markup.keyboard(rows).resize();
    }
  }

  /**
   * Lista submenu (Reply Keyboard)
   */
  static listaSubmenu() {
    const rows = [
      ["Editor"],
      ["Inapoi", "Meniu principal"]
    ];
    return Markup.keyboard(rows).resize();
  }

  /**
   * Lista edit menu with Adauga/Scoate options (Reply Keyboard)
   */
  static listaEditMenu() {
    const rows = [
      ["➕ Adauga", "➖ Scoate"],
      ["Inapoi", "Meniu principal"]
    ];
    return Markup.keyboard(rows).resize();
  }

  /**
   * Editor submenu (from Lista) (Reply Keyboard)
   */
  static editorSubmenu() {
    const rows = [
      ["Adauga", "Scoate"],
      ["Produs nou"],
      ["Inapoi", "Meniu principal"]
    ];
    return Markup.keyboard(rows).resize();
  }

  /**
   * Product list with inline buttons for add/remove quantity
   */
  static productListForEdit(products, action = "add") {
    const rows = products.map(prod => [
      Markup.button.callback(
        `#${prod.id} ${prod.name} (${ProductUtils.remainingOf(prod)} buc.)`,
        `editprod:${action}:${prod.id}`
      )
    ]);
    rows.push([Markup.button.callback("⬅️ Înapoi", "menu:lista_back")]);
    return Markup.inlineKeyboard(rows);
  }

  /**
   * Vanzari submenu (Reply Keyboard)
   */
  static vanzariSubmenu(ctx = null) {
    const isAdmin = Config.isAdmin(ctx?.from?.id);
    
    if (isAdmin) {
      // Admins see all options including reports
      const rows = [
        ["🛒 Vinde"],
        ["📅 Ultima săptămână", "📆 Ultima lună"],
        ["📊 Total (6 luni)", "⬅️ Înapoi"]
      ];
      return Markup.keyboard(rows).resize();
    } else {
      // Sellers only see "Vinde" option
      const rows = [
        ["🛒 Vinde"],
        ["⬅️ Înapoi"]
      ];
      return Markup.keyboard(rows).resize();
    }
  }

  /**
   * Editare submenu (admin only) (Reply Keyboard)
   */
  static editareSubmenu(ctx) {
    if (!Config.isAdmin(ctx.from?.id)) {
      return Markup.keyboard([["⬅️ Înapoi"]]).resize();
    }
    const rows = [
      ["➕ Adaugă", "✏️ Redenumește"],
      ["🔢 Setează stoc", "🗑️ Șterge"],
      ["👥 Utilizatori"],
      ["⬅️ Înapoi"]
    ];
    return Markup.keyboard(rows).resize();
  }

  /**
   * Users management menu (admin only) (Reply Keyboard)
   */
  static usersManagementMenu() {
    const rows = [
      ["➕ Adaugă vânzător", "📋 Listă utilizatori"],
      ["✏️ Schimbă nume", "🔄 Schimbă rol"],
      ["➖ Șterge vânzător"],
      ["⬅️ Înapoi"]
    ];
    return Markup.keyboard(rows).resize();
  }

  /**
   * Product picker menu for paginated product selection
   */
  static productPickerMenu(products, page, pages, onPickPrefix, backAction = "menu:home") {
    const rows = products.map(prod => [
      Markup.button.callback(
        `${ProductUtils.remainingOf(prod) > 0 ? "🟢" : "🔴"} #${prod.id} ${prod.name}`,
        `${onPickPrefix}:${prod.id}:p${page}`
      )
    ]);

    if (pages > 1) {
      rows.push([
        Markup.button.callback("◀️ Înapoi", `pg:${onPickPrefix}:${page - 1}`),
        Markup.button.callback(`Pagina ${page}/${pages}`, "noop"),
        Markup.button.callback("Înainte ▶️", `pg:${onPickPrefix}:${page + 1}`)
      ]);
    }

    rows.push([Markup.button.callback("⬅️ Meniu", backAction)]);
    return Markup.inlineKeyboard(rows);
  }

  /**
   * Quantity selection menu for sales
   */
  static quantityMenu(productId, remaining, page, backAction) {
    const quick = [1, 2, 3, 4, 5, 10].filter(q => q <= remaining);
    const rows = quick.map(q => [
      Markup.button.callback(`${q}`, `sellqty:${productId}:${q}`)
    ]);
    rows.push([Markup.button.callback("Altă cantitate…", `sellother:${productId}`)]);
    rows.push([Markup.button.callback("⬅️ Înapoi la listă", backAction)]);
    rows.push([Markup.button.callback("⬅️ Meniu", "menu:home")]);
    return Markup.inlineKeyboard(rows);
  }

  /**
   * Confirmation menu for delete operations
   */
  static deleteConfirmationMenu(productId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Da, șterge", `delconfirm:${productId}:yes`),
        Markup.button.callback("❌ Nu", "menu:home")
      ]
    ]);
  }

  /**
   * Simple back button menu
   */
  static backMenu(backAction = "menu:home") {
    return Markup.inlineKeyboard([[Markup.button.callback("⬅️ Înapoi", backAction)]]);
  }

  /**
   * Inline back button menu (alias for consistency)
   */
  static inlineBackMenu(backAction = "menu:home") {
    return Markup.inlineKeyboard([[Markup.button.callback("⬅️ Înapoi", backAction)]]);
  }

  /**
   * Settings menu
   */
  static settingsMenu() {
    const rows = [
      ["✏️ Schimbă numele meu"],
      ["⬅️ Înapoi"]
    ];
    return Markup.keyboard(rows).resize();
  }
}
