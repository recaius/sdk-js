'use strict'

const Util = require('./util')
const Connect = require('./connect')
const exc = require('./exception')

class Tts {
    constructor(config, auth) {
        this._auth = auth
        this._config = config
        this._url = Util.getRecaiusUrl(config.url, config.version, 'tts')
    }

    getSound(params) {
        if (!params.hasOwnProperty('lang')) Util.throwError(new exc.RequireArgumentError('lang'))
        if (!params.hasOwnProperty('speaker_id')) Util.throwError(new exc.RequireArgumentError('speaker_id'))

        if (params.hasOwnProperty('phonetic_text')) {
            return this._request('phonetictext2speechwave', { params: params }, false)
        } else {
            return this._request('plaintext2speechwave', { params: params }, false)
        }
    }

    getPhoneticText(params) {
        if (!params.hasOwnProperty('plain_text')) Util.throwError(new exc.RequireArgumentError('plain_text'))
        if (!params.hasOwnProperty('lang')) Util.throwError(new exc.RequireArgumentError('lang'))

        return this._request('plaintext2phonetictext', { params: params })
    }

    getSpeakers() {
        return this._request('speakers', { method: 'GET' })
    }

    getLexiconDictList(lexiconId, params = null) {
        return this._request('userlexicons/${lexiconId}', { method: 'GET', params: params })
    }

    updateLexicon(lexiconId, params = null) {
        return this._request('userlexicons/${lexiconId}', { method: 'PUT', params: params }, false)
    }

    copyLecixonWords(lexiconId, params) {
        if (!params.hasOwnProperty('user_lang_dic_id')) Util.throwError(new exc.RequireArgumentError('user_lang_dic_id'))
        if (!params.hasOwnProperty('dest_user_lang_dic_id')) Util.throwError(new exc.RequireArgumentError('dest_user_lang_dic_id'))

        return this._request('userlexicons/copy', { params: params })
    }

    getLexiconWords(lexiconId, params = null) {
        let isJson = (params.response_time == 'binary')
        return this._request('userlexicons/${lexiconId}/words', { method: 'GET', parmas: params }, isJson)
    }

    deleteAllLexiconWords(lexiconId, params = null) {
        return this._request('userlexicons/${lexiconId}/words', { method: 'DELETE', params: params })
    }

    addWord(lexiconId, params) {
        if (!params.hasOwnProperty('ulex')) Util.throwError(new exc.RequireArgumentError('ulex'))

        return this._request('userlexicons/${lexiconId}/words', {method: 'PUT', params: params})
    }

    deleteWord(lexiconId, params) {
        if (!params.hasOwnProperty('ulex')) Util.throwError(new exc.RequireArgumentError('ulex'))

        return this._request('userlexicons/${lexiconId}/words', {method: 'POST', params: params})
    }

    getProgress(lexiconId, pid, params=null) {
        return this._request('userlexicons/${lexiconId}/${pid}', {method: 'GET', params: params})
    }

    _request(name, options, returnJson=true) {
        let url = Util.urlJoin(this._url, name)
        let sendOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-Token': this._auth.token()
            },
            proxy: this._config.proxy
        }

        let method = options.method || 'POST'
        if (options.hasOwnProperty('params')) {
            sendOptions.body = JSON.stringify(options.params)
        }

        if(returnJson) {
            return Connect.requestJson(url, method, sendOptions);
        } else {
            return Connect.requestRaw(url, method, sendOptions);
        }
    }
}

module.exports = Tts
