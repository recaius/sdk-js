'use strict'

// modules
const Auth = require('./auth')
const Asr = require('./asr')
const Tts = require('./tts')
const Mt = require('./mt')
const Iip = require('./iip')
const Mic = require('./mic')

// others
const Util = require('./util')
const exception = require('./exception')

const defaultConfig = {
    // url globally set
    url: 'https://api.recaius.jp/',
    version: 'v2',
    proxy: undefined,
    auth: {},
    asr: {},
    tts: {},
    mt: {},
    iip: {},
}

class Recaius {
    /// よく使う項目はオプション引数で指定できるようにする
    constructor(config={}, additional_config={}) {
        // TODO: validation
        this._config = this.readConfig(config, additional_config)

        // delegated objects
        this.auth = new Auth(this._config)

        // this.speech = new Speech(this._config.speech, this.auth)
        this.tts = new Tts(this._config, this.auth)
        this.mt = new Mt(this._config, this.auth)
        this.asr = new Asr(this._config, this.auth)
        this.iip = new Iip(this._config, this.auth)

        this.getMic = Mic.getMic

        // public exception
        this.exceptions = exception
    }


    readConfig(c, ac) {
        let config = Util.clone(defaultConfig)
        // まるごと上書き。細かい調整は無し
        Object.keys(config).forEach(key => {
            if(c.hasOwnProperty(key)) {
                config[key] = Util.clone(c[key])
            }
        })

        if(ac.expire_sec != null) {
            config.auth.expiry_sec = ac.expire_sec;
        }

        return config
    }

}

module.exports = Recaius
