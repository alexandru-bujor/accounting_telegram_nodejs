import { Config } from "../config/config.js";

/**
 * Pagination Utility
 * Handles pagination logic for lists
 */
export class Pagination {
  static paginate(arr, page = 1, perPage = Config.perPage) {
    const total = arr.length;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const p = Math.min(Math.max(1, page), pages);
    const start = (p - 1) * perPage;
    return {
      page: p,
      pages,
      slice: arr.slice(start, start + perPage),
      total
    };
  }
}

