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
const Address = /** @class */ (function (_super) {
  __extends(Address, _super)
  // Use name 'address' because has 'default' attribute and is a javascript keyword
  function Address (address, api) {
    if (address === void 0) { address = {} }
    const _this = _super.call(this, address, api, []) || this
    Object.entries(address).map(function (_a) {
      const key = _a[0]; const value = _a[1]
      _this[key] = value
    })
    return _this
  }
  /**
     * Get indentifier of model
     */
  Address.prototype.getId = function () {
    return this.id
  }
  return Address
}(Model))
export { Address }
// # sourceMappingURL=Address.js.map
