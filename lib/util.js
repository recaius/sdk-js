'use strict'

const exception = require('./exception');


module.exports = {
    /// join two path with slash
    urlJoin: function(p1, p2) {
        return p1.replace(/\/{1,}$/, "") + "/" + p2.replace(/^\/{1,}/, "")
    },

    getRecaiusUrl: function(base, version, kind) {
        return module.exports.urlJoin(base, kind) + `/${version}`
    },

    /// http://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-deep-clone-an-object-in-javascript
    clone: function(obj) {
        if (obj === null || typeof(obj) !== 'object' || 'isActiveClone' in obj)
            return obj;

        if (obj instanceof Date)
            var temp = new obj.constructor(); //or new Date(obj);
        else
            var temp = obj.constructor();

        for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                obj['isActiveClone'] = null;
                temp[key] = module.exports.clone(obj[key]);
                delete obj['isActiveClone'];
            }
        }
        return temp;
    },

    throwError: function(obj) {
        throw obj
    },

    /// typedArrayのバッファを共有する新しいViewを返す。
    typedArrayView: function(arr, start, length) {
        if(length === undefined) {
            return new arr.constructor(arr.buffer, arr.BYTES_PER_ELEMENT * start)
        } else {
            return new arr.constructor(arr.buffer, arr.BYTES_PER_ELEMENT * start, length)
        }
    },

    /// return true if copied
    copyItemIfPresent: function(fromObj, toObj, key) {
        if(fromObj.hasOwnProperty(key)) {
            toObj[key] = fromObj[key]
            return true
        }
        return false
    },

    waitFor: function(condition, n=0) {
        let waitId = setInterval(() => {
            if (condition()) {
                clearInterval(waitId);
            }
        }, n)
    },

    sleep: function(interval) {
        return new Promise((resolve, reject) => {
            setTimeout(() => resolve(), interval)
        })
    },

    withTimeout: function(promise, msec) {
        return Promise.race([
            promise,
            new Promise((resolve, reject) => setTimeout(() => reject(new exception.TimeoutError(msec)), msec))
        ]);
    },

    downloadBuffer: function(buffer) {
        let encodedData = this.encodeWAV(buffer)
            // let encodedData = this.encodeWAV(new Int16Array(data))
        let wavBlob = new Blob([encodedData], {
            type: 'audio/wav'
        })
        forceDownload(wavBlob, "out.wav")
    },

    forceDownload: function(blob, filename) {
        let url = (window.URL || window.webkitURL)
            .createObjectURL(blob);
        let link = window.document.createElement('a');
        link.href = url;
        link.download = filename || 'output.wav';
        let click = document.createEvent("Event");
        click.initEvent("click", true, true);
        link.dispatchEvent(click);
    },

    floatTo16BitPCM: function(output, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    },

    writeString: function(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    },

    encodeWav: function(samples) {
        let buffer = new ArrayBuffer(44 + samples.length * 2);
        let view = new DataView(buffer);
        let numChannels = 1
        let sampleRate = 16000

        // Header 12 bytes
        /* RIFF identifier */
        this.writeString(view, 0, 'RIFF');
        /* RIFF chunk length */
        view.setUint32(4, 36 + samples.length * 2, true);
        /* RIFF type */
        this.writeString(view, 8, 'WAVE');

        // fmt 24 byte
        /* format chunk identifier */
        this.writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, numChannels, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * numChannels * 2, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, numChannels * 2, true);
        /* bits per sample */
        view.setUint16(34, 16, true);

        /* data chunk identifier */
        this.writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * 2, true);

        this.floatTo16BitPCM(view, 44, samples);

        return view;
    },

    parseWav(data) {
        let view
        if(data instanceof ArrayBuffer) {
            view = new DataView(data)
        } else {
            view = new DataView(data.buffer)
        }
        // Header 12 bytes
        /* RIFF identifier */
        if(view.getUint32(0, true) != 0x46464952) {  // == 'RIFF'
            throw TypeError('Not a wave format')
        }

        /* RIFF type */
        if(view.getUint32(8, true) != 0x45564157) {  // == 'WAVE'
            throw TypeError('Not a wave format')
        }

        // fmt 24 byte
        /* format chunk identifier */
        if(view.getUint32(12, true) != 0x20746d66) {  // == 'fmt '
            throw TypeError('Not a wave format')
        }

        /* format chunk length */
        let chunkSize = view.getUint32(16, true)
        /* channel count */
        let channelNum = view.getUint16(22, true)
        /* sample rate */
        let sampleRate = view.getUint32(24, true)
        /* byte rate per sec */
        let bytePerSec = view.getUint32(28, true)
        /* block align (channel count * bytes per sample) */
        let blockAlign = view.getUint16(32, true)
        /* bits per sample */
        let bitsWidth = view.getUint16(34, true)

        let dataStart = 16 + chunkSize + 8

        let robj = {channelNum: channelNum, sampleRate: sampleRate}

        robj.data = new Int16Array(view.buffer, dataStart)

        if(bitsWidth == 16) {
            robj.type = 'linear'
            if(channelNum == 2) {
                robj.data = module.exports.convertStereoToMonoral(robj.data)
            }
        } else if(bitsWidth == 4) {
            robj.type == 'adpcm'
        } else {
            robj.type == 'unknown'
        }

        return robj
    },

    convertStereoToMonoral(data) {
        let newBuffer = new Int16Array(data.length / 2)
        for(var i = 0; i < data.length; i += 2) {
            newBuffer[i] = data[i] + data[i + 1] / 2
        }
        return newBuffer
    }
}
