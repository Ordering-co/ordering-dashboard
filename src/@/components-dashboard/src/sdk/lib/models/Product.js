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
const Product = /** @class */ (function (_super) {
  __extends(Product, _super)
  function Product (product, api) {
    if (product === void 0) { product = {} }
    if (api === void 0) { api = null }
    const _this = _super.call(this, product, api) || this
    Object.entries(product).map(function (_a) {
      const key = _a[0]; const value = _a[1]
      _this[key] = value
    })
    return _this
  }
  /**
     * Get indentifier of model
     */
  Product.prototype.getId = function () {
    return this.id
  }
  return Product
}(Model))
export { Product }
// # sourceMappingURL=Product.js.map
