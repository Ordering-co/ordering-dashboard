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
const Session = /** @class */ (function () {
  function Session (session) {
    if (session === void 0) { session = {} }
    this.access_token = session.access_token
    this.expires_in = session.expires_in
    this.token_type = session.token_type
  }
  return Session
}())
export { Session }
const User = /** @class */ (function (_super) {
  __extends(User, _super)
  function User (user, api) {
    if (user === void 0) { user = {} }
    const _this = _super.call(this, user, api, ['session', 'addresses']) || this
    Object.entries(user).map(function (_a) {
      const key = _a[0]; const value = _a[1]
      _this[key] = value
    })
    if (user.session) {
      _this.session = new Session(user.session)
    }
    return _this
  }
  User.prototype.isAdministrator = function () {
    return this.level === 0
  }
  User.prototype.isDriver = function () {
    return this.level === 4
  }
  User.prototype.isBusinessOwner = function () {
    return this.level === 2
  }
  User.prototype.isCustomer = function () {
    return this.level === 3
  }
  User.prototype.getAccessToken = function () {
    let _a
    return (_a = this.session) === null || _a === void 0 ? void 0 : _a.access_token
  }
  /**
     * Get indentifier of model
     */
  User.prototype.getId = function () {
    return this.id
  }
  return User
}(Model))
export { User }
// # sourceMappingURL=User.js.map
