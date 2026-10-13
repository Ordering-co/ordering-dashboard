import { Model } from './Model'
import { Product } from './Product'
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
const Menu = /** @class */ (function (_super) {
  __extends(Menu, _super)
  function Menu (menu, api) {
    if (menu === void 0) { menu = {} }
    if (api === void 0) { api = null }
    let _a
    const _this = _super.call(this, menu, api, ['products']) || this
    Object.entries(menu).map(function (_a) {
      const key = _a[0]; const value = _a[1]
      _this[key] = value
    })
    _this.products = (_a = _this.products) === null || _a === void 0 ? void 0 : _a.map(function (product) { return new Product(product) })
    return _this
  }
  /**
     * Get indentifier of model
     */
  Menu.prototype.getId = function () {
    return this.id
  }
  return Menu
}(Model))
export { Menu }
// # sourceMappingURL=Menu.js.map
