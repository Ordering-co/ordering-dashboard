import { Pagination } from './Pagination'
const ApiResponse = /** @class */ (function () {
  function ApiResponse (response, options, api) {
    if (options === void 0) { options = {} }
    if (api === void 0) { api = undefined }
    this.response = response
    this.options = options
    this.api = api
  }
  Object.defineProperty(ApiResponse.prototype, 'content', {
    get: function () {
      const _this = this
      if (this.options.json) {
        const json = this.response.data
        if (this.response.status === 200) {
          if (json.pagination) {
            json.pagination = new Pagination(json.pagination)
          }
          if (this.options.CastClass) {
            if (json.result === null) {
              json.result = null
            } else if (Array.isArray(json.result)) {
              json.result = json.result.map(function (model) {
                return new _this.options.CastClass(model, _this.api)
              })
            } else if (typeof json === 'object') {
              if (this.options.mode === 'dictionary') {
                for (const key in json.result) {
                  if (typeof json.result[key] === 'object') {
                    json.result[key] = new this.options.CastClass(json.result[key], this.api)
                  }
                }
              } else {
                json.result = new this.options.CastClass(json.result, this.api)
              }
            }
          }
        }
        return json
      }
      return this.response.data
    },
    enumerable: false,
    configurable: true
  })
  Object.defineProperty(ApiResponse.prototype, 'status', {
    get: function () {
      return this.response.status
    },
    enumerable: false,
    configurable: true
  })
  return ApiResponse
}())
export { ApiResponse }
// # sourceMappingURL=ApiResponse.js.map
