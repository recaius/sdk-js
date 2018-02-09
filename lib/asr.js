'use strict';

const Util = require('./util')
const Connect = require('./connect')
const exc = require('./exception')

// constants for upsampling. length=91
const firCoe = [-7.4137037e-4, -1.1531283e-3, -2.1740662e-4, 1.2790698e-3, 1.5922000e-3, -3.4433974e-18, -2.0013065e-3, -2.0233887e-3, 4.3397098e-4, 2.9163663e-3,
    2.3894008e-3, -1.1475103e-3, -4.0206192e-3, -2.6171816e-3, 2.2067504e-3,
    5.2971887e-3, 2.6168107e-3, -3.6817563e-3, -6.7156054e-3, -2.2786677e-3,
    5.6507799e-3, 8.2325512e-3, 1.4663481e-3, -8.2112125e-3, -9.7937101e-3,
    1.0208823e-17, 1.1504166e-2, 1.1336633e-2, -2.3823846e-3, -1.5769542e-2, -1.2794431e-2, 6.1189920e-3, 2.1479134e-2, 1.4100024e-2, -1.2078595e-2, -2.9709077e-2, -1.5190611e-2, 2.2394622e-2, 4.3465990e-2, 1.6012000e-2, -4.4309316e-2, -7.4967798e-2, -1.6522431e-2, 1.2862139e-1, 2.8390915e-1,
    3.5060704e-1, 2.8390915e-1, 1.2862139e-1, -1.6522431e-2, -7.4967798e-2, -4.4309316e-2, 1.6012000e-2, 4.3465990e-2, 2.2394622e-2, -1.5190611e-2, -2.9709077e-2, -1.2078595e-2, 1.4100024e-2, 2.1479134e-2, 6.1189920e-3, -1.2794431e-2, -1.5769542e-2, -2.3823846e-3, 1.1336633e-2, 1.1504166e-2,
    1.0208823e-17, -9.7937101e-3, -8.2112125e-3, 1.4663481e-3, 8.2325512e-3,
    5.6507799e-3, -2.2786677e-3, -6.7156054e-3, -3.6817563e-3, 2.6168107e-3,
    5.2971887e-3, 2.2067504e-3, -2.6171816e-3, -4.0206192e-3, -1.1475103e-3,
    2.3894008e-3, 2.9163663e-3, 4.3397098e-4, -2.0233887e-3, -2.0013065e-3, -3.4433974e-18, 1.5922000e-3, 1.2790698e-3, -2.1740662e-4, -1.1531283e-3, -7.4137037e-4
]


class Asr {
    constructor(config, auth) {
        this._config = config
        this._auth = auth
        this._url = Util.getRecaiusUrl(config.url, config.version, 'asr')
    }

    newSession(params={}) {
        let inputType = params.inputType || 'linear/int16'
        let sampleRate = params.sampleRate || 16000
        let sendInterval = params.sendInterval || 512
        return new Session(this._config, this._auth, this._url, inputType, sampleRate, sendInterval)
    }

    // batch処理モード
    recognize(data, params, options={}) {
        let sess
        let sendBuf = data
        if(options.hasOwnProperty('inputType')) {
            if(options.inputType == 'wave') {
                let parsed = Util.parseWav(data)
                sess = this.newSession({sampleRate: parsed.sampleRate})
                sendBuf = parsed.data
            } else {
                sess = this.newSession({inputType: options.inputType, sampleRate: optoins.sampleRate})
            }
        } else {
            sess = this.newSession()
        }

        let wait = 30000  // 30 sec
        if(options.hasOwnProperty('wait')) {
            wait = options.wait
        }

        let results = []
        sess.setCallback('Result', obj => {
            results.push(obj)
        })

        // sess.setCallback('TmpResult', () => console.log('TmpResult'))
        // sess.setCallback('Send', () => console.log('Send'))
        // sess.setCallback('Reject', () => console.log('Reject'))
        // sess.setCallback('Failure', () => console.log('Failure'))
        // sess.setCallback('SOS', () => console.log('SOS'))
        // sess.setCallback('Timeout', () => console.log('Timeout'))
        // sess.setCallback('TooLong', () => console.log('TooLong'))

        return sess.start(params)
        .then(() => sess.sendData(sendBuf))
        .then(() => sess.flush())
        .then(() => sess.checkResultFor('NoData', wait))
        .then(() => results)
    }

    // It assumes Uint8Array
    getRawFromWave(data) {
        let parsedWav = Util.parseWav(data)
        return parsedWav.data
    }
}

/// 音声認識の１セッションを表す
class Session {
    constructor(config, auth, url, inputType, sampleRate, sendInterval) {
        this._config = config
        this._auth = auth
        this._url = url

        this._uuid = null
        this._asrParams = null // start時の設定

        this._sampleRate = sampleRate;
        this._targetRate = 16000;
        this._rateRatio = this._sampleRate / this._targetRate;
        this._voiceId = 0;

        this._setInputType(inputType)
        this._setSendInterval(sendInterval)

        if(this._sampleRate < this._targetRate) {
            throw new TypeError('Upsampling is not supported yet.')
        }

        // 途中のバッファ
        this._pushedBuffer = null
        this._pushedDataStack = []
        this._pushedBufferCount = 0

        this._eventCallbacks = {}
        this._internalEventCallbacks = {}

        // state handling
        this._canRequest = false
        this._isStarted = false;
    }

    // Result/NoData/TmpResult/Send/Reject/Failure/SOS/Timeout/TooLong
    setCallback(name, callback) {
        if(this._eventCallbacks.hasOwnProperty(name)) {
            this._eventCallbacks[name].push(callback)
        } else {
            this._eventCallbacks[name] = [callback]
        }
    }

    unsetCallback(name, callback) {
        if(this._eventCallbacks.hasOwnProperty(name)) {
            for(var i = 0; i < this._eventCallbacks[name].length; ++i) {
                if(callback === this._eventCallbacks[name[i]]) {
                    this._eventCallbacks[name].splice(i, 1)
                    return
                }
            }
        }
    }

    start(params) {
        if (!params.hasOwnProperty('model_id')) Util.throwError(new exc.RequireArgumentError('model_id'))
        this._canRequest = true
        return this._request('voices', {
                method: 'POST',
                params: params
            })
            .then(j => {
                this._uuid = j.uuid;
                this._voiceId = 1;
                this._asrParams = params
                if(this._inputType != 'speex') {
                    this._pushedBuffer = new this._InputTypeClass(this._storeSize)
                }
                this._pushedDataStack = []
                this._pushedBufferCount = 0
                this._isStarted = true
                return j
            })
    }

    stop() {
        if (this._uuid === null) {
            Util.throwError(new exc.NotStartedError)
        }
        let uuid = this._uuid
        this._uuid = null
        this._voiceId = 0
        this._asrParams = null // start時の設定
        this._pushedBuffer = null
        this._pushedDataStack = []
        this._pushedBufferCount = 0

        let r = this._request(`voices/${uuid}`, { method: 'DELETE' })
        this._canRequest = false
        this._isStarted = false
        return r
    }


    // pushする要素によって対応を変える。
    //
    push(buffer) {
        if(!this._isStarted) return
        if (this._uuid === null) {
            Util.throwError(new exc.NotStartedError)
        }
        if (this._rateRatio < 1) {
            throw new Error("downsampling rate should be smaller than original sample rate");
        }
        if (!(buffer instanceof this._InputTypeClass)) {
            throw new Error(`You can only push ${this._InputTypeClass}, or use setInputType()`)
        }

        if (this._inputType == 'speex') {
            this._send(buffer)
        } else {
            this._pushedDataStack.push(buffer.slice(0))
            this._push()  // check to send
        }
    }

    flush() {
        if (this._uuid === null) {
            Util.throwError(new exc.NotStartedError)
        }
        // バッファに残っているデータを強制送信
        this._pushedDataStack.push(null)
        this._push()

        let options = { method: 'PUT', params: { voice_id: this._voiceId } }
        this._voiceId += 1
        return this._request(`voices/${this._uuid}/flush`, options).then(j => {
            this._parseAsrResult(j)
            return j
        })
    }

    checkResult() {
        return this._request(`voices/${this._uuid}/results`, { method: 'GET' }).then(j => {
            this._parseAsrResult(j)
            return j
        })
    }

    checkResultFor(name, timeout=10000, interval=500) {
        let promise = new Promise((resolve, reject) => {
            let done = false
            this._setCallback(name, obj => {
                done = true
                resolve(obj)
            })

            this.checkResult().then(() => {
                if(done) return
                // re-check
                Util.sleep(interval).then(() => this.checkResult())
            })
        })
        return Util.withTimeout(promise, timeout)
    }

    // It sends voice data immediately
    sendData(buf, voiceId=null) {
        if(voiceId == null) {
            voiceId = this._voiceId
        }
        let sendBuf = this._preprocessBeforeSend(buf)
        let voice = new Uint8Array(sendBuf.buffer)
        let formData = {
            voice_id: voiceId,
            voice: voice
        }
        this._voiceId += 1
        return this._request(`voices/${this._uuid}`, {
            method: 'PUT',
            formData: formData
        }).then(j => {
            this._emit('Send', j)
            this._parseAsrResult(j)
        })
    }

    getBaseModels() {
        return this._request('models', { method: 'GET' })
    }

    getBaseModelConf(modelId) {
        return this._request(`models/${modelId}/configuration`, { method: 'GET' })
    }

    updateBaseModelConf(modelId, conf) {
        return this._request(`models/${modelId}/configuration`, { method: 'PUT', params: conf })
    }

    getUserModels() {
        return this._request('userlexicons', { method: 'GET' })
    }

    createUserModel(baseId) {
        return this._request('userlexicons', { method: 'POST', params: { base_model_id: baseId } })
    }

    deleteUserModel(modelId) {
        return this._request(`userlexicons/${modelId}`, { method: 'DELETE' })
    }

    updateUserModelDescription(modelId, desc) {
        return this._request(`userlexicons/${modelId}`, { method: 'PUT', params: { description: desc } })
    }


    getUserModelConf(modelId) {
        return this._request(`userlexicons/${modelId}/configuration`, { method: 'GET' })
    }

    updateUserModelConf(modelId, conf) {
        return this._request(`userlexicons/${modelId}/configuration`, { method: 'PUT', params: conf })
    }

    getLexicon(modelId) {
        return this._request(`userlexicons/${modelId}/contents`, { method: 'GET' })
    }

    updateLexicon(modelId, lexicons) {
        return this._request(`userlexicons/${modelId}/contents`, { method: 'PUT', params: { ulex: lexicons } })
    }

    getDomainTypes() {
        return this._request(`domainlexicons`, { method: 'GET' })
    }

    _setCallback(name, callback) {
        if(!this._internalEventCallbacks.hasOwnProperty(name)) {
            this._internalEventCallbacks[name] = callback
        }
    }

    _unsetCallback(name) {
        if(!this._internalEventCallbacks.hasOwnProperty(name)) {
            delete this._internalEventCallbacks[name]
        }
    }

    _emit(name, obj) {
        if(this._eventCallbacks.hasOwnProperty(name)) {
            this._eventCallbacks[name].forEach(callback => {
                callback(obj)
            })
        }
        if(this._internalEventCallbacks.hasOwnProperty(name)) {
            this._internalEventCallbacks[name](obj)
        }
    }

    // msec (変更不可)
    _setSendInterval(n) {
        if (this._inputType == 'linear/float32' || this._inputType == 'linear/int16') {
            this._storeSize = n * this._sampleRate / 1000
            if(this._sampleRate != this._targetRate) {
                this._storeSize = n * this._sampleRate / 1000 + firCoe.length - 1
            }
        } else if (this._inputType == 'adpcm') {
            this._storeSize = n * this._sampleRate / 1000 / 2 // 一つのバイトに２つの要素
        } else if (this._inputType == 'speex') {
            this._storeSize = null // not supported. Always send if pushed
        }
    }

    // linear/int16, linear/float32, adpcm, speex以外は認めない
    _setInputType(tp) {
        this._inputType = tp;
        if (tp == 'linear/int16') {
            this._InputTypeClass = Int16Array
            this._inputTypeClassName = 'i16'
        } else if ('linear/float32') {
            this._InputTypeClass = Float32Array
            this._inputTypeClassName = 'f32'
        } else if ('adpcm') {
            this._InputTypeClass = Uint8Array
            this._inputTypeClassName = 'u8'
            if(this._sampleRate != this._targetRate) {
                throw new TypeError('We only support adpcm with 16000Hz sampling.')
            }
        } else if ('speex') {
            this._InputTypeClass = Uint8Array
            this._inputTypeClassName = 'u8'
        } else {
            throw new TypeError('Select linear/int16, linear/float32, adpcm, or speex')
        }
    }

    _push() {
        if(this._pushedDataStack.length == 0) return

        // null element indicates to be flushed
        if(this._pushedDataStack[0] == null) {
            this._prepareToSend()
            return
        }

        if(this._inputType == 'speex') {
            throw new TypeError('No speex here')
        }
        console.assert(this._storeSize === this._pushedBuffer.length, "error 1")

        if(this._pushedBufferCount + this._pushedDataStack[0].length < this._storeSize) {
            this._pushedBuffer.set(this._pushedDataStack[0], this._pushedBufferCount)
            this._pushedBufferCount += this._pushedDataStack[0].length
            this._pushedDataStack.shift()
        } else if(this._pushedBufferCount + this._pushedDataStack[0].length == this._storeSize) {
            this._pushedBuffer.set(this._pushedDataStack[0], this._pushedBufferCount)
            this._pushedBufferCount += this._pushedDataStack[0].length
            console.assert(this._storeSize === this._pushedBufferCount, "error 2")
            // FIRするときはフィルタ分を捨ててしまうので、この部分は次のデータで送るので残す必要あり
            if(this._sampleRate != this._targetRate) {
                this._pushedDataStack[0] = Util.typedArrayView(this._pushedBuffer, yhis._pushedBuffer.length - (firCoe.length - 1))
            } else {
                this._pushedDataStack.shift()
            }
            this._prepareToSend()
        } else {
            let view = Util.typedArrayView(this._pushedDataStack[0], 0, this._storeSize - this._pushedBufferCount)
            this._pushedBuffer.set(view, this._pushedBufferCount)
            this._pushedBufferCount += view.length
            console.assert(this._storeSize === this._pushedBufferCount)
            // FIRするときはフィルタ分を捨ててしまうので、この部分は次のデータで送るので残す必要あり
            if(this._sampleRate != this._targetRate) {
                if(view.length < firCoe.length - 1) {
                    this._pushedDataStack[0] = Util.typedArrayView(this._pushedDataStack[0], 0)
                    this._pushedDataStack.unshift(
                        Util.typedArrayView(this._pushedBuffer,
                            this._pushedBuffer.length - (firCoe.length - 1 - view.length))
                    )
                } else {
                    this._pushedDataStack[0] = Util.typedArrayView(
                        this._pushedDataStack[0], view.length - (firCoe.length - 1)
                    )
                }
            } else {
                this._pushedDataStack[0] = Util.typedArrayView(this._pushedDataStack[0], view.length)
            }
            this._prepareToSend()
        }
        this._push() // 送るものがなくなるまで繰り返す
    }

    _request(name, options, returnJson = true) {
        // session has stoped. no more request to.
        if(!this._canRequest) return Promise.resolve()
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
        } else if (options.hasOwnProperty('body')) {
            sendOptions.body = options.body
        } else if(options.hasOwnProperty('formData')) {
            sendOptions.formData = options.formData
            sendOptions.headers['Content-Type'] = 'multipart/form-data'
        }

        if (options.hasOwnProperty('headers')) {
            Object.keys(options.headers).forEach(x => {
                sendOptions.headers[x] = options.headers[x]
            })
        }

        if (returnJson) {
            return Connect.requestJson(url, method, sendOptions)
        } else {
            return Connect.requestRaw(url, method, sendOptions)
        }
    }

    _prepareToSend() {
        if(this._pushedBufferCount == 0) {
            return
        }
        let sendBuf = this._pushedBuffer
        let voiceId = this._voiceId
        this._pushedBuffer = new this._InputTypeClass(this._storeSize)
        this._pushedBufferCount = 0
        this.sendData(sendBuf, voiceId)
    }

    // bufの内容を送る
    _preprocessBeforeSend(buf) {
        if(this._sampleRate != this._targetRate) {
            buf = this._filterFIRAndDownSampling(buf)  // FIRフィルタをかます
        }
        let sendBuf
        if (this._inputTypeClassName === 'f32') {
            sendBuf = new Int16Array(buf.length)
            for (let i = 0; i < buf.length; ++i) {
                let v = Math.max(-1, Math.min(1, buf[i]))
                if (v < 0) {
                    v *= 0x8000;
                } else {
                    v *= 0x7FFF;
                }
                sendBuf[i] = v
            }
        } else {
            sendBuf = buf
        }
        return sendBuf
    }


    // FIR filterで補完(後にダウンサンプル)
    // 元のデータ    [ooooooo]
    //               [|||] <- 畳み込んでいる
    //                |
    // FIR後のデータ [ooooooo]

    // 元のデータ    [ooooooo]
    //                   [|||]     <- ここまで。つまりFilter配列の長さ-1の要素は捨てられる
    //                    |
    // FIR後のデータ [ooooooo]
    _filterFIRAndDownSampling(ibuf) {
        // ダウンサンプルを行うので、必要な要素数は小さくなる
        let convertedSize = Math.ceil((ibuf.length - (firCoe.length - 1)) / this._rateRatio)
        let obuf = new this._InputTypeClass(convertedSize);
        let csr = 0
        for (var i = 0; ; i += this._rateRatio) {
            let pos = Math.floor(i)
            if(pos + firCoe.length - 1 >= ibuf.length) {
                break
            }
            let v = 0.0
            for (var j = 0; j < firCoe.length; ++j) {
                // firCoeは左右対称の配列(91要素)なのでコレで良い
                v += firCoe[j] * ibuf[pos + j]
            }
            // ここで、InputTypeがint型の場合には型変換が必要になる
            if (this._inputTypeClassName === 'i16') {
                obuf[csr] = Math.round(v)
            } else {
                obuf[csr] = v
            }
            ++csr
        }
        if(obuf.length < csr) {
            throw new Error('Invalid conversion')
        }
        // 最後にもしバッファが余っていたらviewをすげ替える
        if (obuf.length != csr) {
            obuf = Util.typedArrayView(obuf, 0, csr)
        }
        return obuf
    }

    _parseAsrResult(obj) {
        if (!obj) {
            return;
        }

        obj.forEach(v => {
            let type, parseFunc, extractTmp
            if (!this._asrParams.hasOwnProperty('result_type') || this._asrParams.result_type == 'one_best') {
                type = v[0]
                parseFunc = this._parseOnebest
                extractTmp = v => v[1]
            } else if (this._asrParams.result_type == 'nbest') {
                type = v.type
                parseFunc = this._parseNbest
                extractTmp = v => v.result
            } else if (this._asrParams.result_type == 'confnet') {
                type = v.type
                parseFunc = this._parseConfnet
                extractTmp = v => v.result
            }

            if (type == 'RESULT') {
                let robj = parseFunc(v);
                this._emit('Result', robj)
            } else if (type == 'TMP_RESULT') {
                let robj = extractTmp(v);
                this._emit('TmpResult', robj)
            } else if(type == 'SOS') {
                this._emit('SOS')
            } else if(type == 'NO_DATA') {
                this._canRequest = false
                this._emit('NoData')
            } else if (type == 'REJECT') {
                this._emit('Reject')
            } else if (type == 'TIMEOUT') {
                this._emit('Timeout')
            } else if(type == 'TOO_LONG') {
                this._emit('TooLong')
            }
        })
        return obj;
    }

    _parseOnebest(obj) {
        return obj[1]
    }

    _parseNbest(obj) {
        return obj.result
    }

    _parseConfnet(obj) {
        throw new Error("not implemented")
    }
}

module.exports = Asr
