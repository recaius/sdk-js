// If Node.js, we just use request library
const Util = require('./util')
let requestLib = undefined

try {
    const requestLib = require('request')
} catch(e) {
``}

function requestBrowser(url, method, is_binary, options) {
    let params = {method: method, headers: {}}
    if(options.hasOwnProperty('headers')) params.headers = options.headers
    if(options.hasOwnProperty('json')) {
        params.body = JSON.stringify(options.json)
        params.headers['Content-type'] = 'application/json; charset=utf-8'
    } else if(options.hasOwnProperty('body')) {
        params.body = options.body
    } else if(options.hasOwnProperty('formData')) {
        let formData = new FormData()
        Object.keys(options.formData).forEach(x => {
            if(options.formData[x] instanceof Uint8Array) {
                formData.append(x, new Blob([options.formData[x]]))
            } else {
                formData.append(x, options.formData[x])
            }
        })
        params.body = formData
    } else if(options.hasOwnProperty('qs')) {
        let url = new URL(url)
        Object.keys(options.qs).forEach(x => url.searchParams.append(x, options.qs[x]))
    }

    if(options.hasOwnProperty('timeout')) {
        return Util.withTimeout(fetch(url, params), options.timeout)
    } else {
        return fetch(url, params)
        .then(response => {
            if (!response.ok) {
                return response.text()
                .then(d => Promise.reject({status: response.status, data: d}))
            }
            return Promise.resolve()
            .then(() => {
                if(is_binary) {
                    return response.arrayBuffer()
                } else {
                    return response.text()
                    .then(t => {
                        try {
                            return JSON.parse(t)
                        } catch(e) {
                            return t
                        }
                    })
                }
            })
            .then(d => {
                return {status: response.status, data: d}
            })
        })
    }
}

module.exports = {
    requestJson: function(url, method, options) {
        return module.exports.request(url, method, false, options).then(r => r.data)
    },

    requestRaw: function(url, method, options) {
        return module.exports.request(url, method, true, options).then(r => r.data)
    },

    request: function(url, method, is_binary, options) {
        if(requestLib === undefined) {
            return requestBrowser(url, method, is_binary, options)
        } else {
            return new Promise((resolve, reject) => {
                let params = { url: url, method: method }
                Object.keys(options).forEach(key => params[key] = options[key])

                if(is_binary) {
                    params.encoding = null // response body becomes Buffer
                }
                requestLib(params, (error, response, body) => {
                    if (error) {
                        reject(error)
                    }
                    let robj = {status: response.statusCode}
                    if (robj.status >= 400) {
                        try {
                            robj.detail = JSON.parse(body)
                        } catch(e) {
                            robj.detail = body
                        }
                        reject(robj)
                    }
                    if(is_binary) {
                        robj.data = body
                    } else {
                        if(body.length > 0) {
                            try {
                                robj.data = JSON.parse(body)
                            } catch(e) {
                                if(response.headers['content-type'].indexOf('text') == 0) {
                                    robj.data = body
                                } else {
                                    throw e
                                }
                            }
                        } else {
                            robj.data = null
                        }
                    }
                    resolve(robj)
                })
            })
        }
    }
}