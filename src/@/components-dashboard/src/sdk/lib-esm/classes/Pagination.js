const Pagination = /** @class */ (function () {
  function Pagination (pagination) {
    this.back_page = pagination.back_page
    this.current_page = pagination.current_page
    this.fisrt_page = pagination.fisrt_page
    this.from = pagination.from
    this.last_page = pagination.last_page
    this.next_page = pagination.next_page
    this.page_size = pagination.page_size
    this.to = pagination.to
    this.total = pagination.total
    this.total_pages = pagination.total_pages
  }
  return Pagination
}())
export { Pagination }
// # sourceMappingURL=Pagination.js.map
