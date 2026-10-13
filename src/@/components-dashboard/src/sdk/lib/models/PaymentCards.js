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
const PaymentCards = /** @class */ (function (_super) {
  __extends(PaymentCards, _super)
  function PaymentCards (cards, api) {
    if (cards === void 0) { cards = {} }
    const _this = _super.call(this, cards, api, []) || this
    Object.entries(cards).map(function (_a) {
      const key = _a[0]; const value = _a[1]
      _this[key] = value
    })
    return _this
  }
  return PaymentCards
}(Model))
export { PaymentCards }
// # sourceMappingURL=PaymentCards.js.map
