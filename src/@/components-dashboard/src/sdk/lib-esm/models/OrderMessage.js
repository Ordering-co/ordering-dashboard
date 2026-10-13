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
const OrderMessage = /** @class */ (function (_super) {
  __extends(OrderMessage, _super)
  function OrderMessage (orderMessage, api) {
    if (orderMessage === void 0) { orderMessage = {} }
    if (api === void 0) { api = null }
    const _this = _super.call(this, orderMessage, api) || this
    Object.entries(orderMessage).map(function (_a) {
      const key = _a[0]; const value = _a[1]
      _this[key] = value
    })
    return _this
  }
  /**
     * Get indentifier of model
     */
  OrderMessage.prototype.getId = function () {
    return this.id
  }
  return OrderMessage
}(Model))
export { OrderMessage }
// # sourceMappingURL=OrderMessage.js.map
