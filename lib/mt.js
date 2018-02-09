'use strict'

const Util = require('./util')
const Connect = require('./connect')
const exc = require('./exception')

class Mt {
    constructor(config, auth) {
        this._auth = auth
        this._config = config
        this._url = Util.getRecaiusUrl(config.url, config.version, 'mt')
    }

    translate(params) {
        return this._translate(params)
    }

    arrange(params) {
        return this._arrange(params)
    }

    _translate(params) {

        if(!params.hasOwnProperty('query')) Util.throwError(new exc.RequireArgumentError('query'))
        if(!params.hasOwnProperty('src_lang')) Util.throwError(new exc.RequireArgumentError('src_lang'))
        if(!params.hasOwnProperty('tgt_lang')) Util.throwError(new exc.RequireArgumentError('tgt_lang'))
        // optionals
        params.mode = params.mode || 'spoken_language'

        return this._requestJson('translate', params)
    }

    _arrange(params) {
        let src_lang = params.src_lang || Util.throwError(new exc.RequireArgumentError('src_lang'))
        let query = params.query || Util.throwError(new exc.RequireArgumentError('query'))
        let sendParams = {src_lang: src_lang, query: query}

        return this._requestJson('arrange', sendParams)
    }

    _requestJson(name, params) {
        let url = Util.urlJoin(this._url, name)
        return Connect.requestJson(url, 'POST', {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Token': this._auth.token()
                },
                body: JSON.stringify(params),
                proxy: this._config.proxy
            })
    }
}


module.exports = Mt
