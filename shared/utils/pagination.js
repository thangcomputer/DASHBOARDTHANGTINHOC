const SYSTEM = require('../constants/system');

/**
 * Pagination helper calculations and meta-response builder.
 */
const pagination = {
  getPaginationParams: (query) => {
    const page = Math.max(
      1,
      parseInt(query.page, 10) || SYSTEM.PAGINATION.DEFAULT_PAGE
    );
    const limit = Math.min(
      SYSTEM.PAGINATION.MAX_LIMIT,
      Math.max(1, parseInt(query.limit, 10) || SYSTEM.PAGINATION.DEFAULT_LIMIT)
    );
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  },

  buildMeta: (total, page, limit) => {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
    };
  },
};

module.exports = pagination;
