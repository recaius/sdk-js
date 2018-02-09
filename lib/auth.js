'use strict'

const Util = require('./util')
const Connect = require('./connect')
const exc = require('./exception')

class Auth {
    constructor(config) {
        this._token = null
        this._config = config
        this._url = Util.getRecaiusUrl(config.url, config.version, 'auth')
        this._lastLogin = null
        this._expire = null
    }

    setConfig(config) {
        this._params = config
    }

    login() {
        let url = Util.urlJoin(this._url, 'tokens')
        let params = this._config.auth

        return this._requestJson(url, 'POST', JSON.stringify(params))
            .then(j => {
                this._token = j.token
                this._lastLogin = Date.now()
                this._expire = j.expiry_sec * 1000 // to msec
            })
    }

    logout() {
        let url = Util.urlJoin(this._url, 'tokens')
        return this._requestJson(url, 'DELETE', null, this.token(false)).then(() => {
            this._token = null
        })
    }

    // strict=false: _tokenの存在のみをチェックする
    // strict=true: 有効期限が切れそうな場合でもエラーにする
    token(strict=true) {
        if (this._token === null || (strict && this.needLogin())) {
            throw new exc.NeedLoginError()
        }
        return this._token
    }

    needLogin() {
        if (!this._token || !this._lastLogin) return true;
        let now = Date.now();
        // Notify 30[sec] before expiring
        if (this._lastLogin + this._expire < now + 30000) {
            return true;
        }
        return false;
    }

    _requestJson(url, method, body = null, token = null) {
        let params = {
            headers: {
                'Content-Type': 'application/json'
            },
            body: body,
            proxy: this._config.proxy
        }
        if(token != null) params.headers['X-Token'] = token
        return Connect.requestJson(url, method, params)
    }
}

module.exports = Auth
