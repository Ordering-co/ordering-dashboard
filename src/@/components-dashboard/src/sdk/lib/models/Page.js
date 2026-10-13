import { Model } from './Model'
const __extends = (this && this.__extends) || (function () {
  let extendStatics = function (d, b) {
    extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b }) ||
            function (d, b) { for (const p in b) if (b.hasOwnProperty(p)) d[p] = b[p] }
    return extendStatics(d, b)
  }
  return function (d, b) {
    extendStatics(d, b)
    function __ () { this.constructor = d }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __())
  }
})()
const Page = /** @class */ (function (_super) {
  __extends(Page, _super)
  function Page (config, api) {
    if (config === void 0) { config = {} }
    const _this = _super.call(this, config, api, ['created_at', 'updated_at']) || this
    Object.entries(config).map(function (_a) {
      const key = _a[0]; const value = _a[1]
      _this[key] = value
      if (['updated_at', 'created_at'].includes(key)) {
        _this[key] = new Date(value)
      }
    })
    return _this
  }
  /**
     * Get indentifier of model
     */
  Page.prototype.getId = function () {
    return this.id
  }
  return Page
}(Model))
export { Page }
// # sourceMappingURL=Page.js.map
