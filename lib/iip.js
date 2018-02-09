'use strict'

const Util = require('./util')
const Connect = require('./connect')
const exc = require('./exception')

class Iip {
    constructor(config, auth) {
        this._auth = auth
        this._config = config
        this._url = Util.getRecaiusUrl(config.url, config.version, 'iip')
    }

    addDatabase(user, name) {
        return this._request('databases', {
            method: 'POST',
            headers: { 'X-User': user },
            params: {
                dbname: name
            },
        })
    }

    getDatabases(user) {
        return this._request('databases', {
            method: 'GET',
            headers: { 'X-User': user }
        })
    }

    deleteDatabase(user, dbid) {
        return this._request(`databases/${dbid}`, {
            method: 'DELETE',
            headers: { 'X-User': user }
        })
    }

    getDatabaseProperty(user, dbid) {
        return this._request(`databases/${dbid}/properties`, {
            method: 'GET',
            headers: { 'X-User': user }
        })
    }

    updateVocabulary(user, dbid) {
        return this._request(`databases/${dbid}/dictionaries`, {
            headers: { 'X-Users': user}
        })
    }

    getDatabaseKeywords(user, dbid) {
        return this._request(`databases/${dbid}/keywords`, {
            method: 'GET',
            headers: { 'X-User': user}
        })
    }

    addDocument(user, dbid, params) {
        let options = {}
        if(!Util.copyItemIfPresent(params, options, 'name')) Util.throwError(new exc.RequireArgumentError('name'))

        Util.copyItemIfPresent(params, options, 'text')
        Util.copyItemIfPresent(params, options, 'file')

        if(options.hasOwnProperty('file')) {
            Util.copyItemIfPresent(params, options, 'filename')
        } else if(!options.hasOwnProperty('text')) {
            Util.throwError(new exc.RequireArgumentError('text or file'))
        }

        Util.copyItemIfPresent(params, options, 'length')
        Util.copyItemIfPresent(params, options, 'tags')
        Util.copyItemIfPresent(params, options, 'uri')

        return this._request(`databases/${dbid}`, {
            headers: { 'X-User': user },
            formData: options
        })
    }

    findDocument(user, dbid, params) {
        let options = {}
        if(!Util.copyItemIfPresent(params, options, 'query')) Util.throwError(new exc.RequireArgumentError('query'))
        Util.copyItemIfPresent(params, options, 'type')
        Util.copyItemIfPresent(params, options, 'count')
        Util.copyItemIfPresent(params, options, 'length')

        return this._request(`databases/${dbid}`, {
            method: 'GET',
            headers: { 'X-User': user },
            params: options
        })
    }

    getDocumentProperty(user, dbid) {
        return this._request(`databases/${dbid}/properties`, {
            method: 'GET',
            headers: { 'X-User': user}
        })
    }

    deleteDocument(user, dbid, docid) {
        return this._request(`databases/${dbid}/${docid}/`, {
            method: 'DELETE',
            headers: { 'X-User': user}
        })
    }

    updateDocumentProperty(user, dbid, docid, params) {
        let options = {}
        Util.copyItemIfPresent(params, options, 'name')
        Util.copyItemIfPresent(params, options, 'tags')
        Util.copyItemIfPresent(params, options, 'uri')
        Util.copyItemIfPresent(params, options, 'length')

        return this._request(`databases/${dbid}/${docid}/properties`, {
            method: 'PUT',
            headers: { 'X-User': user},
            params: options
        })
    }

    getDocument(user, dbid, docid) {
        return this._request(`databases/${dbid}/${docid}/file`, {
            method: 'GET',
            headers: { 'X-User': user}
        }, false)
    }

    extractDatabaseKeyword(user, dbid, params) {
        let options = {}
        if(!Util.copyItemIfPresent(params, options, 'text')) Util.throwError(new exc.RequireArgumentError('name'))
        Util.copyItemIfPresent(params, options, 'count')
        return this._request(`databases/${dbid}/search_words`, {
            method: 'GET',
            headers: { 'X-User': user},
            params: options
        })
    }

    getDocumentKeywords(user, dbid, params) {
        let options = {}
        if(!Util.copyItemIfPresent(params, options, 'docids')) Util.throwError(new exc.RequireArgumentError('docids'))
        Util.copyItemIfPresent(params, options, 'count')
        return this._request(`/databases/${dbid}/documents/specific_words`, {
            method: 'GET',
            headers: { 'X-User': user},
            params: options
        })
    }

    tokenizeText(user, text) {
        return this._request(`/texts/tokens`, {
            method: 'GET',
            headers: { 'X-User': user},
            params: {
                text: text
            }
        })
    }

    getTextImportance(user, params) {
        let options = {}
        Util.copyItemIfPresent(params, options, 'text')
        Util.copyItemIfPresent(params, options, 'sentences')
        if(!options.hasOwnProperty('text') && !options.hasOwnProperty('sentences')) Util.throwError(new exc.RequireArgumentError('text or sentences'))
        if(options.hasOwnProperty('text') && options.hasOwnProperty('sentences')) Util.throwError(new exc.RequireArgumentError('set just one parameter: text or sentences'))
        return this._request(`/texts/ranks`, {
            method: 'GET',
            headers: { 'X-User': user},
            params: options
        })
    }

    extractKeyword(user, params) {
        let options = {}
        if(!Util.copyItemIfPresent(params, options, 'text')) Util.throwError(new exc.RequireArgumentError('text'))
        Util.copyItemIfPresent(params, options, 'count')
        return this._request(`/texts/keywords`, {
            method: 'GET',
            headers: { 'X-User': user },
            params: options
        })
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
            if(method == 'POST' || method == 'PUT') {
                sendOptions.body = JSON.stringify(options.params)
            } else {
                sendOptions.qs = options.params
            }
        } else if(options.hasOwnProperty('formData')) {
            sendOptions.formData = options.formData
            sendOptions.headers['Content-Type'] = 'multipart/form-data'
        }

        if (options.hasOwnProperty('headers')) {
            Object.keys(options.headers).forEach(x => {
                sendOptions.headers[x] = options.headers[x]
            })
        }

        if(returnJson) {
            return Connect.requestJson(url, method, sendOptions);
        } else {
            return Connect.requestRaw(url, method, sendOptions);
        }
    }
}


module.exports = Iip
